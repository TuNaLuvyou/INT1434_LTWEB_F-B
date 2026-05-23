import prisma from '../config/prisma';
import { getIO } from '../socket';
import { SessionStatus, TableStatus } from '@prisma/client';
import { emitTableStatusChanged, emitSessionClosed } from '../socket/emit.helpers';

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
  // 1. Validate table tồn tại
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) {
    const err = new Error('Bàn không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  // 2. Tìm session OPEN hiện tại
  const existingSession = await prisma.tableSession.findFirst({
    where: { tableId, status: 'OPEN' },
    include: orderItemsInclude,
  });

  if (existingSession) {
    // 3a. Session đã tồn tại — đảm bảo trạng thái bàn là OCCUPIED
    if (table.status !== 'OCCUPIED') {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });
    }
    return { session: existingSession as unknown as SessionWithItems, isNew: false };
  }

  // 3b. Chưa có session — tạo mới trong transaction
  const [newSession] = await prisma.$transaction([
    prisma.tableSession.create({
      data: {
        tableId,
        status: 'OPEN',
        version: 0,
      },
      include: orderItemsInclude,
    }),
    prisma.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' },
    }),
  ]);

  // 4. Emit socket event tới floor-plan (F4) bằng emit helpers mới
  emitTableStatusChanged({
    tableId,
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
