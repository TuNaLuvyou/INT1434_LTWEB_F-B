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
  isExcess?: boolean;
  session: CashierSessionOverview | null;
}

type CashierDisplayStatus = 'CART' | 'PENDING' | 'PREPARING' | 'DONE' | 'VOID';

export interface CashierSessionItemsResponse {
  sessionId: string;
  openedAt: Date;
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  groups: Record<CashierDisplayStatus, Array<{
    id: string;
    sessionId: string;
    menuItemId: string;
    qty: number;
    note: string | null;
    status: CashierDisplayStatus;
    unitPrice: any;
    menuItem: {
      name: string;
      price: any;
      imageUrl: string | null;
    };
    createdAt: Date;
  }>>;
}

export async function getCashierOverview(tenantId: string, branchId?: string): Promise<CashierTableOverview[]> {
  const whereClause: any = { tenantId };
  if (branchId) whereClause.branchId = branchId;

  const tables = await prisma.table.findMany({
    where: whereClause,
    orderBy: { tableNumber: 'asc' },
    select: {
      id: true,
      tableNumber: true,
      label: true,
      status: true,
      createdAt: true,
      sessions: {
        where: { status: 'OPEN' },
        select: {
          id: true,
          openedAt: true,
          lockedAt: true,
        },
        take: 1,
      },
    },
  });

  const maxTables = 5; // FOR TESTING ONLY: Hardcode maxTables to 5
  const allTenantTables = [...tables].sort((a, b) => (a.createdAt as any) - (b.createdAt as any));
  const validTableIds = new Set<string>();
  allTenantTables.slice(0, maxTables).forEach(t => validTableIds.add(t.id));

  const openSessionIds = tables
    .map((t) => t.sessions[0])
    .filter(Boolean)
    .map((s) => s!.id);

  const lockedSessionIds = new Set(
    tables
      .map((t) => t.sessions[0])
      .filter((s) => s?.lockedAt)
      .map((s) => s!.id)
  );

  const pendingSessions = new Map<string, number>();
  const preparingSessions = new Map<string, number>();
  const doneSessions = new Map<string, number>();

  if (openSessionIds.length > 0) {
    const rows = await prisma.$queryRaw<
      Array<{
        sessionId: string;
        status: string;
        qty: bigint;
        createdAt: Date;
        lockedAt: Date | null;
      }>
    >`
      SELECT
        oi."sessionId",
        oi.status,
        oi.qty,
        oi."createdAt",
        s."lockedAt"
      FROM "OrderItem" oi
      JOIN "TableSession" s ON s.id = oi."sessionId"
      WHERE oi."sessionId" IN (${openSessionIds})
        AND oi.status != 'CART'
    `;

    for (const row of rows) {
      const sid = row.sessionId;
      const qty = Number(row.qty);

      if (row.status === 'PREPARING') {
        preparingSessions.set(sid, (preparingSessions.get(sid) || 0) + qty);
      } else if (row.status === 'DONE') {
        doneSessions.set(sid, (doneSessions.get(sid) || 0) + qty);
      } else if (row.status === 'PENDING') {
        const lockedAtTime = row.lockedAt ? new Date(row.lockedAt).getTime() : null;
        const itemTime = new Date(row.createdAt).getTime();
        if (lockedAtTime !== null && itemTime <= lockedAtTime) {
          preparingSessions.set(sid, (preparingSessions.get(sid) || 0) + qty);
        } else {
          pendingSessions.set(sid, (pendingSessions.get(sid) || 0) + qty);
        }
      }
    }
  }

  const excessTableIdsToCancel = tables
    .filter((t: any) => !validTableIds.has(t.id) && t.status !== 'AVAILABLE')
    .map((t: any) => t.id);

  if (excessTableIdsToCancel.length > 0) {
    await prisma.$transaction([
      prisma.tableSession.updateMany({
        where: { tableId: { in: excessTableIdsToCancel }, status: 'OPEN' },
        data: { status: 'CANCELLED', closedAt: new Date() }
      }),
      prisma.table.updateMany({
        where: { id: { in: excessTableIdsToCancel } },
        data: { status: 'AVAILABLE' }
      })
    ]);
    tables.forEach((t: any) => { 
      if (excessTableIdsToCancel.includes(t.id)) { 
        t.status = 'AVAILABLE'; 
        if (t.sessions) t.sessions = []; 
      } 
    });
  }

  return tables.map((table) => {
    const activeSession = table.sessions[0] || null;

    if (!activeSession) {
      return {
        tableId: table.id,
        tableNumber: table.tableNumber,
        tableLabel: table.label,
        tableStatus: table.status,
        isExcess: !validTableIds.has(table.id),
        session: null,
      };
    }

    const sid = activeSession.id;

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableLabel: table.label,
      tableStatus: table.status,
      isExcess: !validTableIds.has(table.id),
      session: {
        sessionId: sid,
        openedAt: activeSession.openedAt,
        pendingCount: pendingSessions.get(sid) || 0,
        preparingCount: preparingSessions.get(sid) || 0,
        doneCount: doneSessions.get(sid) || 0,
        isLocked: lockedSessionIds.has(sid),
      },
    };
  });
}

export async function getCashierSessionItems(sessionId: string): Promise<CashierSessionItemsResponse> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      openedAt: true,
      tableId: true,
      lockedAt: true,
      table: {
        select: {
          tableNumber: true,
          label: true,
        },
      },
      orderItems: {
        where: { status: { not: 'CART' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          sessionId: true,
          menuItemId: true,
          qty: true,
          note: true,
          status: true,
          unitPrice: true,
          createdAt: true,
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
    CART: [],
    PENDING: [],
    PREPARING: [],
    DONE: [],
    VOID: [],
  };

  const lockedAtTime = session.lockedAt ? new Date(session.lockedAt).getTime() : null;

  for (const item of session.orderItems) {
    let displayStatus = item.status as CashierDisplayStatus;
    if (item.status === 'PENDING') {
      const itemTime = new Date(item.createdAt).getTime();
      // Nếu món PENDING được tạo trước/bằng lúc khóa bàn -> Bếp đang làm (PREPARING)
      // Nếu món PENDING được tạo sau lúc khóa bàn -> Đợt đặt mới chưa duyệt, giữ nguyên PENDING
      if (lockedAtTime !== null && itemTime <= lockedAtTime) {
        displayStatus = 'PREPARING';
      }
    }

    groups[displayStatus].push({
      id: item.id,
      sessionId: item.sessionId,
      menuItemId: item.menuItemId,
      qty: item.qty,
      note: item.note,
      status: displayStatus,
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

  // Đã bỏ check lockedAt ném lỗi ALREADY_APPROVED để cho phép duyệt các đợt gọi thêm mới.
  const lockedAtTime = session.lockedAt ? new Date(session.lockedAt).getTime() : null;

  // Lọc các món PENDING chưa duyệt (có createdAt sau thời điểm lockedAt trước đó)
  const pendingItems = session.orderItems.filter(item => {
    if (item.status !== 'PENDING') return false;
    const itemTime = new Date(item.createdAt).getTime();
    if (lockedAtTime !== null && itemTime <= lockedAtTime) {
      return false; // Món đợt cũ đã duyệt
    }
    return true; // Món đợt mới chưa duyệt
  });

  if (pendingItems.length === 0) {
    throw new AppError(400, 'NO_PENDING_ITEMS', 'Không có món ăn mới nào đang chờ duyệt.');
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
  emitTableStatusChanged(session.table.tenantId, session.table.branchId, {
    tableId: session.tableId,
    status: 'OCCUPIED',
    tableNumber: session.table.tableNumber,
    label: session.table.label,
  });

  // Emit Kitchen New Ticket
  emitKitchenNewTicket(session.table.tenantId, session.table.branchId, {
    sessionId,
    tableId: session.tableId,
    tableNumber: session.table.tableNumber,
    items: pendingItems.map(item => ({
      orderItemId: item.id,
      menuItemName: item.menuItem.name,
      qty: item.qty,
      note: item.note || undefined,
      status: 'PENDING', // Gửi PENDING để bếp thấy trong cột "HÀNG CHỜ"
    })),
    createdAt: now.toISOString(),
  });

  // Emit Cart Updated (gửi lock notification cho khách)
  const total = session.orderItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  emitCartUpdated(session.table.tenantId, session.table.branchId, session.tableId, {
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
    approvedItemsCount: pendingItems.reduce((sum, item) => sum + item.qty, 0),
  };
}
