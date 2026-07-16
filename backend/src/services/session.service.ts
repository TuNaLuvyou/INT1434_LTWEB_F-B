import prisma from '../config/prisma';
import { SessionStatus } from '@prisma/client';
import { emitTableStatusChanged, emitSessionClosed, emitKitchenNewTicket } from '../socket/emit.helpers';
import { AppError } from '../utils/app-error';
import { deductInventory, InsufficientStockError } from './inventory.service';

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
export async function joinOrCreateSession(tableId: string, createdViaPos?: boolean): Promise<{
  session: SessionWithItems;
  isNew: boolean;
  table: any;
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
    // Nếu phiên này được tạo từ POS (createdViaPos là true), nhưng request này không từ POS (không gửi createdViaPos)
    // thì chặn khách lại và hiển thị thông báo
    if (existingSession.createdViaPos && !createdViaPos) {
      const err = new Error('Bàn này hiện tại đã có người đặt. Vui lòng liên hệ tại quầy.') as any;
      err.statusCode = 409;
      throw err;
    }

    // Nếu request từ POS và phiên hiện tại chưa đánh dấu createdViaPos, cập nhật lại nó
    if (createdViaPos && !existingSession.createdViaPos) {
      const updated = await prisma.tableSession.update({
        where: { id: existingSession.id },
        data: { createdViaPos: true },
        include: orderItemsInclude,
      });
      return { session: updated as unknown as SessionWithItems, isNew: false, table };
    }

    // 3a. Session đã tồn tại — đảm bảo trạng thái bàn là OCCUPIED
    if (table.status !== 'OCCUPIED') {
      await prisma.table.update({
        where: { id: actualTableId },
        data: { status: 'OCCUPIED' },
      });
    }
    return { session: existingSession as unknown as SessionWithItems, isNew: false, table };
  }

  // 3b. Chưa có session — tạo mới trong transaction
  const [newSession] = await prisma.$transaction([
    prisma.tableSession.create({
      data: {
        tableId: actualTableId,
        status: 'OPEN',
        version: 0,
        createdViaPos: !!createdViaPos,
      },
      include: orderItemsInclude,
    }),
    prisma.table.update({
      where: { id: actualTableId },
      data: { status: 'OCCUPIED' },
    }),
  ]);

  // 4. Emit socket event tới floor-plan (F4) bằng emit helpers mới
  emitTableStatusChanged(table.tenantId, table.branchId, {
    tableId: actualTableId,
    status: 'OCCUPIED',
  });

  return { session: newSession as unknown as SessionWithItems, isNew: true, table };
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
  newStatus: 'PAID' | 'CANCELLED',
  keepOccupied?: boolean
): Promise<SessionWithItems> {
  // 1. Tìm session
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orderItems: {
        include: {
          menuItem: true
        }
      }
    },
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

  const now = new Date();
  let updatedSession: any;

  if (newStatus === 'PAID') {
    // Lấy các món CART và PENDING chưa gửi bếp
    const cartItems = session.orderItems.filter(item => item.status === 'CART');
    const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');

    // Các món cần gửi bếp (nếu session chưa locked thì gửi cả pending, nếu locked rồi thì chỉ gửi cart)
    const itemsToSendToKitchen = [
      ...cartItems,
      ...(!session.lockedAt ? pendingItems : [])
    ];

    // Trạng thái bàn đích: Nếu keepOccupied là true (POS order) thì giữ OCCUPIED, ngược lại AVAILABLE
    const targetTableStatus = keepOccupied ? 'OCCUPIED' : 'AVAILABLE';

    await prisma.$transaction(async (tx) => {
      // 1. Chuyển tất cả CART thành PENDING
      if (cartItems.length > 0) {
        await tx.orderItem.updateMany({
          where: { sessionId, status: 'CART' },
          data:  { status: 'PENDING' },
        });
      }

      // 2. AUTO-DEDUCTION: Trừ tồn kho nguyên liệu theo BOM
      //    Gộp các items CART + PENDING (chưa bị deduct) để tính nguyên liệu.
      //    Chỉ deduct các món có trạng thái CART hoặc PENDING (không deduct DONE/VOID lần 2).
      const itemsToDeduct = session.orderItems
        .filter(i => i.status === 'CART' || i.status === 'PENDING')
        .map(i => ({ menuItemId: i.menuItemId, qty: i.qty }));

      if (itemsToDeduct.length > 0) {
        // Truyền tx vào deductInventory để chạy trong cùng 1 transaction
        // → nếu deduct fail (thiếu stock) toàn bộ PAID operation sẽ rollback
        await deductInventory(itemsToDeduct, sessionId, 'SYSTEM_CASHIER', tx as any);
      }

      // 3. Cập nhật TableSession thành PAID, closedAt, và lockedAt (nếu chưa locked)
      updatedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'PAID',
          closedAt: now,
          lockedAt: session.lockedAt || now,
        },
        include: orderItemsInclude,
      });

      // 4. Cập nhật trạng thái bàn
      await tx.table.update({
        where: { id: session.tableId },
        data: { status: targetTableStatus },
      });
    }, {
      timeout:  15_000, // 15s — đủ cho batch deduction lớn
      maxWait:   5_000,
    });

    // Emit socket events cho floor-plan
    emitTableStatusChanged(session.table.tenantId, session.table.branchId, {
      tableId: session.tableId,
      status: targetTableStatus as any,
    });

    // Emit socket session closed
    emitSessionClosed(session.table.tenantId, session.table.branchId, session.tableId, {
      sessionId,
      tableId: session.tableId,
      status: 'PAID',
      closedAt: now.toISOString(),
    });

    if (itemsToSendToKitchen.length > 0) {
      emitKitchenNewTicket(session.table.tenantId, session.table.branchId, {
        sessionId,
        tableId: session.tableId,
        tableNumber: session.table.tableNumber,
        items: itemsToSendToKitchen.map(item => ({
          orderItemId: item.id,
          menuItemId: item.menuItemId,
          menuItemName: (item as any).menuItem.name,
          qty: item.qty,
          note: item.note || undefined,
          status: 'PENDING',
        })),
        createdAt: now.toISOString(),
      });
    }
  } else {
    // newStatus === 'CANCELLED'
    const [cancelledSession] = await prisma.$transaction([
      prisma.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'CANCELLED',
          closedAt: now,
        },
        include: orderItemsInclude,
      }),
      prisma.table.update({
        where: { id: session.tableId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    updatedSession = cancelledSession;

    emitTableStatusChanged(session.table.tenantId, session.table.branchId, {
      tableId: session.tableId,
      status: 'AVAILABLE',
    });

    emitSessionClosed(session.table.tenantId, session.table.branchId, session.tableId, {
      sessionId,
      tableId: session.tableId,
      status: 'CANCELLED',
      closedAt: now.toISOString(),
    });
  }

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
      include: { table: true }
    });
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    // Removed locked check so customers can continuously place additional orders.

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
      where: {
        sessionId_menuItemId_status: {
          sessionId,
          menuItemId,
          status: 'CART',
        },
      },
    });

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      // Nếu client gửi data CŨ HƠN record trong DB → conflict
      if (dbTimestamp > clientTimestamp) {
        // Lấy toàn bộ cart hiện tại để sync về client
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId, status: 'CART' },
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
        where: { sessionId, menuItemId, status: 'CART' },
      });
    } else {
      await tx.orderItem.upsert({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
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
          status: 'CART',
        },
      });
    }

    // STEP 5: Lấy cart mới nhất sau khi upsert
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId, status: 'CART' },
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
      include: { table: true }
    });
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    // Removed locked check so customers can continuously place additional orders.

    // STEP 2: LWW CONFLICT CHECK
    const existing = await tx.orderItem.findUnique({
      where: {
        sessionId_menuItemId_status: {
          sessionId,
          menuItemId,
          status: 'CART',
        },
      },
    });

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      if (dbTimestamp > clientTimestamp) {
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId, status: 'CART' },
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
      await tx.orderItem.delete({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
      });
    }

    // Lấy cart mới nhất sau khi xóa
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId, status: 'CART' },
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
