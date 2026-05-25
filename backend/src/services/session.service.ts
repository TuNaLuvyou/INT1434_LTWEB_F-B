import prisma from '../config/prisma';
import { SessionStatus } from '@prisma/client';
import { emitTableStatusChanged, emitSessionClosed } from '../socket/emit.helpers';
import { AppError } from '../utils/app-error';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionWithItems {
  id: string;
  tableId: string;
  status: SessionStatus;
  version: number;
  openedAt: Date;
  closedAt: Date | null;
  orderItems: OrderItemWithMenu[];
}

export interface OrderItemWithMenu {
  id: string;
  sessionId: string;
  menuItemId: string;
  qty: number;
  unitPrice: any; // Decimal
  note: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  menuItem: {
    id: string;
    name: string;
    price: any; // Decimal
    imageUrl: string | null;
    isSoldOut: boolean;
  };
}

// ─── Include helper ──────────────────────────────────────────────────────────

const orderItemsInclude = {
  orderItems: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          isSoldOut: true,
        },
      },
    },
  },
} as const;

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * JOIN hoặc TẠO MỚI session cho một bàn.
 * - Nếu đã có session OPEN → trả về session hiện tại (isNew: false)
 * - Nếu chưa có → tạo mới trong transaction, emit socket event (isNew: true)
 */
export async function joinOrCreateSession(tableId: string): Promise<{
  session: SessionWithItems;
  isNew: boolean;
}> {
  // 1. Validate table tồn tại (hỗ trợ cả khóa UUID và số hiệu bàn tableNumber)
  let table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) {
    const parsedNum = parseInt(tableId, 10);
    if (!isNaN(parsedNum)) {
      table = await prisma.table.findUnique({ where: { tableNumber: parsedNum } });
    }
  }

  if (!table) {
    const err = new Error('Bàn không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  const actualTableId = table.id;

  // 2. Tìm session OPEN hiện tại
  const existingSession = await prisma.tableSession.findFirst({
    where: { tableId: actualTableId, status: 'OPEN' },
    include: orderItemsInclude,
  });

  if (existingSession) {
    // 3a. Session đã tồn tại — đảm bảo trạng thái bàn là OCCUPIED
    if (table.status !== 'OCCUPIED') {
      await prisma.table.update({
        where: { id: actualTableId },
        data: { status: 'OCCUPIED' },
      });
    }
    return { session: existingSession as unknown as SessionWithItems, isNew: false };
  }

  // 3b. Chưa có session — tạo mới trong transaction
  const [newSession] = await prisma.$transaction([
    prisma.tableSession.create({
      data: {
        tableId: actualTableId,
        status: 'OPEN',
        version: 0,
      },
      include: orderItemsInclude,
    }),
    prisma.table.update({
      where: { id: actualTableId },
      data: { status: 'OCCUPIED' },
    }),
  ]);

  // 4. Emit socket event tới floor-plan (F4) bằng emit helpers mới
  emitTableStatusChanged({
    tableId: actualTableId,
    status: 'OCCUPIED',
  });

  return { session: newSession as unknown as SessionWithItems, isNew: true };
}

/**
 * Lấy session theo ID, include orderItems với menuItem.
 */
export async function getSessionById(sessionId: string): Promise<SessionWithItems> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: orderItemsInclude,
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  return session as unknown as SessionWithItems;
}

/**
 * Lấy session OPEN đang hoạt động của một bàn — dùng cho màn hình cashier.
 */
export async function getActiveSessionByTableId(tableId: string): Promise<SessionWithItems> {
  const session = await prisma.tableSession.findFirst({
    where: { tableId, status: 'OPEN' },
    include: orderItemsInclude,
  });

  if (!session) {
    const err = new Error('Bàn không có order đang mở') as any;
    err.statusCode = 404;
    throw err;
  }

  return session as unknown as SessionWithItems;
}

/**
 * Cập nhật trạng thái session (PAID | CANCELLED).
 * Chỉ cho phép đóng session đang OPEN.
 * Emit socket events cho floor-plan và table room bằng emit helpers mới.
 */
export async function updateSessionStatus(
  sessionId: string,
  newStatus: 'PAID' | 'CANCELLED'
): Promise<SessionWithItems> {
  // 1. Tìm session
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  // 2. Chỉ được đóng session đang OPEN
  if (session.status !== 'OPEN') {
    const err = new Error(`Session đã được đóng với trạng thái: ${session.status}`) as any;
    err.statusCode = 409;
    throw err;
  }

  // 3. Update session + table trong transaction
  const [updatedSession] = await prisma.$transaction([
    prisma.tableSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus as SessionStatus,
        closedAt: new Date(),
      },
      include: orderItemsInclude,
    }),
    prisma.table.update({
      where: { id: session.tableId },
      data: { status: 'AVAILABLE' },
    }),
  ]);

  // 4. Emit socket events bằng emit helpers mới
  emitTableStatusChanged({
    tableId: session.tableId,
    status: 'AVAILABLE',
  });

  emitSessionClosed(session.tableId, {
    sessionId,
    tableId: session.tableId,
    status: newStatus,
    closedAt: new Date().toISOString(),
  });

  return updatedSession as unknown as SessionWithItems;
}

/**
 * Thêm hoặc cập nhật một item trong giỏ hàng.
 * Sử dụng Last-Write-Wins (LWW) với client timestamp guard.
 */
export async function addToCart(
  sessionId: string,
  menuItemId: string,
  qty: number,
  note: string | undefined,
  clientTimestamp: number
) {
  return await prisma.$transaction(async (tx) => {
    // STEP 1: Verify session còn OPEN
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    // STEP 2: Verify menuItem isActive và không sold out
    const menuItem = await tx.menuItem.findUnique({
      where: { id: menuItemId },
    });
    if (!menuItem || !menuItem.isActive) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Món không còn phục vụ');
    }
    if (menuItem.isSoldOut) {
      throw new AppError(409, 'ITEM_SOLD_OUT', `Món "${menuItem.name}" đã hết`);
    }

    // STEP 3: LWW CONFLICT CHECK
    const existing = await tx.orderItem.findUnique({
      where: { sessionId_menuItemId: { sessionId, menuItemId } },
    });

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      // Nếu client gửi data CŨ HƠN record trong DB → conflict
      if (dbTimestamp > clientTimestamp) {
        // Lấy toàn bộ cart hiện tại để sync về client
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        });
        throw new AppError(409, 'CONFLICT', 'Giỏ hàng đã được cập nhật từ thiết bị khác', { currentCart });
      }
    }

    // STEP 4: Upsert OrderItem
    if (qty <= 0) {
      // qty <= 0 nghĩa là xóa item
      await tx.orderItem.deleteMany({
        where: { sessionId, menuItemId },
      });
    } else {
      await tx.orderItem.upsert({
        where: { sessionId_menuItemId: { sessionId, menuItemId } },
        update: {
          qty,
          note: note ?? '',
        },
        create: {
          sessionId,
          menuItemId,
          qty,
          note: note ?? '',
          unitPrice: menuItem.price,
          status: 'PENDING',
        },
      });
    }

    // STEP 5: Lấy cart mới nhất sau khi upsert
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });

    return { session, updatedCart };
  });
}

/**
 * Xóa một item khỏi giỏ hàng.
 * Sử dụng Last-Write-Wins (LWW) với client timestamp guard.
 */
export async function deleteCartItem(
  sessionId: string,
  menuItemId: string,
  clientTimestamp: number
) {
  return await prisma.$transaction(async (tx) => {
    // STEP 1: Verify session còn OPEN
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    // STEP 2: LWW CONFLICT CHECK
    const existing = await tx.orderItem.findUnique({
      where: { sessionId_menuItemId: { sessionId, menuItemId } },
    });

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      if (dbTimestamp > clientTimestamp) {
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        });
        throw new AppError(409, 'CONFLICT', 'Giỏ hàng đã được cập nhật từ thiết bị khác', { currentCart });
      }

      // Xóa item
      await tx.orderItem.deleteMany({
        where: { sessionId, menuItemId },
      });
    }

    // Lấy cart mới nhất sau khi xóa
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });

    return { session, updatedCart };
  });
}
