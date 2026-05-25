import prisma from '../config/prisma';
import { OrderItemStatus, TableStatus } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { emitKitchenNewTicket, emitCartUpdated, emitTableStatusChanged } from '../socket/emit.helpers';

export interface CashierSessionOverview {
  sessionId: string;
  openedAt: Date;
  pendingCount: number;
  preparingCount: number;
  doneCount: number;
  isLocked: boolean;
}

export interface CashierTableOverview {
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  tableStatus: TableStatus;
  session: CashierSessionOverview | null;
}

export interface CashierSessionItemsResponse {
  sessionId: string;
  openedAt: Date;
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  groups: Record<OrderItemStatus, Array<{
    id: string;
    sessionId: string;
    menuItemId: string;
    qty: number;
    note: string | null;
    status: OrderItemStatus;
    unitPrice: any;
    menuItem: {
      name: string;
      price: any;
      imageUrl: string | null;
    };
    createdAt: Date;
  }>>;
}

export async function getCashierOverview(): Promise<CashierTableOverview[]> {
  const tables = await prisma.table.findMany({
    orderBy: { tableNumber: 'asc' },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        include: {
          orderItems: {
            select: { status: true },
          },
        },
      },
    },
  });

  return tables.map((table) => {
    const activeSession = table.sessions[0] || null;

    if (!activeSession) {
      return {
        tableId: table.id,
        tableNumber: table.tableNumber,
        tableLabel: table.label,
        tableStatus: table.status,
        session: null,
      };
    }

    let pendingCount = 0;
    let preparingCount = 0;
    let doneCount = 0;

    for (const item of activeSession.orderItems) {
      if (item.status === 'PENDING') pendingCount += 1;
      if (item.status === 'PREPARING') preparingCount += 1;
      if (item.status === 'DONE') doneCount += 1;
    }

    const isLocked = Boolean((activeSession as { lockedAt?: Date | null }).lockedAt);

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableLabel: table.label,
      tableStatus: table.status,
      session: {
        sessionId: activeSession.id,
        openedAt: activeSession.openedAt,
        pendingCount,
        preparingCount,
        doneCount,
        isLocked,
      },
    };
  });
}

export async function getCashierSessionItems(sessionId: string): Promise<CashierSessionItemsResponse> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orderItems: {
        orderBy: { createdAt: 'asc' },
        include: {
          menuItem: {
            select: {
              name: true,
              price: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  const groups: CashierSessionItemsResponse['groups'] = {
    PENDING: [],
    PREPARING: [],
    DONE: [],
    VOID: [],
  };

  for (const item of session.orderItems) {
    groups[item.status].push({
      id: item.id,
      sessionId: item.sessionId,
      menuItemId: item.menuItemId,
      qty: item.qty,
      note: item.note,
      status: item.status,
      unitPrice: item.unitPrice,
      menuItem: {
        name: item.menuItem.name,
        price: item.menuItem.price,
        imageUrl: item.menuItem.imageUrl,
      },
      createdAt: item.createdAt,
    });
  }

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    tableId: session.tableId,
    tableNumber: session.table.tableNumber,
    tableLabel: session.table.label,
    groups,
  };
}

export async function approveOrder(sessionId: string, approverId?: string): Promise<any> {
  // 1. Tìm và validate TableSession
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orderItems: {
        include: {
          menuItem: true,
        },
      },
    },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên làm việc.');
  }

  if (session.status !== 'OPEN') {
    throw new AppError(400, 'SESSION_CLOSED', 'Phiên làm việc đã đóng.');
  }

  if (session.lockedAt) {
    throw new AppError(409, 'ALREADY_APPROVED', 'Đơn hàng đã được duyệt trước đó.');
  }

  // Lọc các món PENDING
  const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');
  if (pendingItems.length === 0) {
    throw new AppError(400, 'NO_PENDING_ITEMS', 'Không có món ăn nào đang chờ duyệt.');
  }

  const now = new Date();

  // 2. Chạy transaction để update DB
  const result = await prisma.$transaction(async (tx) => {
    // Lock session
    const updatedSession = await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        lockedAt: now,
      },
    });

    // Chuyển PENDING sang PREPARING
    await tx.orderItem.updateMany({
      where: {
        sessionId,
        status: 'PENDING',
      },
      data: {
        status: 'PREPARING',
        updatedAt: now,
      },
    });

    // Cập nhật trạng thái bàn thành OCCUPIED
    const updatedTable = await tx.table.update({
      where: { id: session.tableId },
      data: {
        status: 'OCCUPIED',
      },
    });

    return { updatedSession, updatedTable };
  });

  // 3. Emit các sự kiện Socket.io và AuditLog TODO
  // TODO: Khi có model AuditLog, hãy thêm ghi chép hành động duyệt đơn ở đây
  console.log(`[AuditLog TODO] Cashier ${approverId || 'system'} approved session ${sessionId} at ${now.toISOString()}`);

  // Emit table status changed
  emitTableStatusChanged({
    tableId: session.tableId,
    status: 'OCCUPIED',
    tableNumber: session.table.tableNumber,
    label: session.table.label,
  });

  // Emit Kitchen New Ticket
  emitKitchenNewTicket({
    sessionId,
    tableId: session.tableId,
    tableNumber: session.table.tableNumber,
    items: pendingItems.map(item => ({
      orderItemId: item.id,
      menuItemName: item.menuItem.name,
      qty: item.qty,
      note: item.note || undefined,
      status: 'PREPARING',
    })),
    createdAt: now.toISOString(),
  });

  // Emit Cart Updated (gửi lock notification cho khách)
  const total = session.orderItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  emitCartUpdated(session.tableId, {
    sessionId,
    tableId: session.tableId,
    orderItems: session.orderItems.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItem.name,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      status: item.status === 'PENDING' ? 'PREPARING' : item.status,
    })),
    total,
    isLocked: true,
    message: '✅ Order của bạn đang được bếp chuẩn bị',
  });

  return {
    sessionId,
    lockedAt: now,
    tableStatus: 'OCCUPIED',
    approvedItemsCount: pendingItems.length,
  };
}
