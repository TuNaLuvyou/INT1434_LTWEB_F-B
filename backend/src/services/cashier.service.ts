import prisma from '../config/prisma';
import { OrderItemStatus, TableStatus, Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { emitKitchenNewTicket, emitCartUpdated, emitTableStatusChanged, emitOrderStatusChanged } from '../socket/emit.helpers';
import { getTenantMaxLimit } from './usage-limit.service';
import { buildVietQrUrl } from '../utils/vietqr';

interface CashierSessionOverview {
  sessionId: string;
  openedAt: Date;
  pendingCount: number;
  preparingCount: number;
  doneCount: number;
  isLocked: boolean;
  pendingPayment?: {
    paymentId: string;
    paymentCode: string;
    subtotal?: number;
    discountAmount?: number;
    pointsDiscountAmount?: number;
    pointsRedeemed?: number;
    customerPhone?: string | null;
    total: number;
    provider: string;
    qrUrl?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;
}

export interface CashierTableOverview {
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  tableStatus: TableStatus;
  isExcess?: boolean;
  session: CashierSessionOverview | null;
}

type CashierDisplayStatus = 'CART' | 'PENDING' | 'PREPARING' | 'DONE' | 'DELIVERED' | 'VOID';

export interface CashierSessionItemsResponse {
  sessionId: string;
  openedAt: Date;
  orderNo?: string;
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
    itemDiscountType: string | null;
    itemDiscountValue: any;
    menuItem: {
      name: string;
      price: any;
      imageUrl: string | null;
    };
    createdAt: Date;
  }>>;
  pendingPayment?: {
    paymentId: string;
    paymentCode: string;
    subtotal?: number;
    discountAmount?: number;
    pointsDiscountAmount?: number;
    pointsRedeemed?: number;
    customerPhone?: string | null;
    total: number;
    provider: string;
    qrUrl?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;
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
        orderBy: { openedAt: 'desc' },
        select: {
          id: true,
          openedAt: true,
          lockedAt: true,
          orderNo: true,
        },
        take: 1,
      },
    },
  });

  const takeawaySessions = await prisma.tableSession.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      tableId: null,
      status: 'OPEN',
    },
    orderBy: { openedAt: 'desc' },
    select: {
      id: true,
      openedAt: true,
      lockedAt: true,
      orderNo: true,
    },
  });

  let maxTables = await getTenantMaxLimit(tenantId, 'TABLE');
  if (maxTables <= 0) maxTables = 9999; // Không giới hạn nếu chưa cấu hình
  const allTenantTables = [...tables].sort((a, b) => (a.createdAt as any) - (b.createdAt as any));
  const validTableIds = new Set<string>();
  allTenantTables.slice(0, maxTables).forEach(t => validTableIds.add(t.id));

  const openSessionIds = [
    ...tables.map((t) => t.sessions[0]).filter(Boolean).map((s) => s!.id),
    ...takeawaySessions.map((s) => s.id),
  ];

  const lockedSessionIds = new Set([
    ...tables.map((t) => t.sessions[0]).filter((s) => s?.lockedAt).map((s) => s!.id),
    ...takeawaySessions.filter((s) => s.lockedAt).map((s) => s.id),
  ]);

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
      WHERE oi."sessionId" IN (${Prisma.join(openSessionIds)})
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

  const pendingPayments = openSessionIds.length > 0 ? await prisma.payment.findMany({
    where: {
      sessionId: { in: openSessionIds },
      status: 'PENDING',
    },
    select: {
      id: true,
      sessionId: true,
      subtotal: true,
      discountAmount: true,
      pointsDiscountAmount: true,
      pointsRedeemed: true,
      customerPhone: true,
      total: true,
      provider: true,
      paymentCode: true,
    },
  }) : [];

  const bankAccount = await prisma.tenantBankAccount.findFirst({
    where: { tenantId, isActive: true, OR: [{ branchId }, { branchId: null }] },
    orderBy: { isDefault: 'desc' },
  });

  const pendingPaymentsMap = new Map<string, any>();
  for (const p of pendingPayments) {
    let qrUrl = undefined;
    if (p.paymentCode && bankAccount) {
      qrUrl = buildVietQrUrl({
        bankId: bankAccount.bankId,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        amount: p.total,
        addInfo: p.paymentCode,
      });
    }
    pendingPaymentsMap.set(p.sessionId, {
      paymentId: p.id,
      paymentCode: p.paymentCode || '',
      subtotal: Number(p.subtotal),
      discountAmount: Number(p.discountAmount || 0),
      pointsDiscountAmount: Number(p.pointsDiscountAmount || 0),
      pointsRedeemed: p.pointsRedeemed || 0,
      customerPhone: p.customerPhone || null,
      total: Number(p.total),
      provider: p.provider || 'VIETQR',
      qrUrl,
      bankName: bankAccount?.bankName,
      accountNumber: bankAccount?.accountNumber,
      accountName: bankAccount?.accountName,
    });
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

  const takeawayOverviews: CashierTableOverview[] = takeawaySessions.map((s) => ({
    tableId: s.id,
    tableNumber: 0,
    tableLabel: 'Mang về',
    tableStatus: 'OCCUPIED' as const,
    isExcess: false,
    session: {
      sessionId: s.id,
      openedAt: s.openedAt,
      orderNo: s.orderNo || undefined,
      pendingCount: pendingSessions.get(s.id) || 0,
      preparingCount: preparingSessions.get(s.id) || 0,
      doneCount: doneSessions.get(s.id) || 0,
      isLocked: lockedSessionIds.has(s.id),
      pendingPayment: pendingPaymentsMap.get(s.id) || null,
    },
  }));

  const tableOverviews = tables.map((table) => {
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
        orderNo: activeSession.orderNo || undefined,
        pendingCount: pendingSessions.get(sid) || 0,
        preparingCount: preparingSessions.get(sid) || 0,
        doneCount: doneSessions.get(sid) || 0,
        isLocked: lockedSessionIds.has(sid),
        pendingPayment: pendingPaymentsMap.get(sid) || null,
      },
    };
  });

  return [...takeawayOverviews, ...tableOverviews];
}

export async function getCashierSessionItems(sessionId: string, tenantId: string): Promise<CashierSessionItemsResponse> {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId },
    select: {
      id: true,
      openedAt: true,
      tableId: true,
      lockedAt: true,
      orderNo: true,
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
          itemDiscountType: true,
          itemDiscountValue: true,
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
    DELIVERED: [],
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
      itemDiscountType: item.itemDiscountType ?? null,
      itemDiscountValue: item.itemDiscountValue ?? null,
      menuItem: {
        name: item.menuItem.name,
        price: item.menuItem.price,
        imageUrl: item.menuItem.imageUrl,
      },
      createdAt: item.createdAt,
    });
  }

  const pendingPaymentRecord = await prisma.payment.findFirst({
    where: { sessionId, status: 'PENDING' },
    select: {
      id: true,
      paymentCode: true,
      subtotal: true,
      discountAmount: true,
      pointsDiscountAmount: true,
      pointsRedeemed: true,
      customerPhone: true,
      total: true,
      provider: true,
    },
  });

  let pendingPayment = null;
  if (pendingPaymentRecord) {
    const bankAccount = await prisma.tenantBankAccount.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { isDefault: 'desc' },
    });
    let qrUrl = undefined;
    if (pendingPaymentRecord.paymentCode && bankAccount) {
      qrUrl = buildVietQrUrl({
        bankId: bankAccount.bankId,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        amount: pendingPaymentRecord.total,
        addInfo: pendingPaymentRecord.paymentCode,
      });
    }
    pendingPayment = {
      paymentId: pendingPaymentRecord.id,
      paymentCode: pendingPaymentRecord.paymentCode || '',
      subtotal: Number(pendingPaymentRecord.subtotal),
      discountAmount: Number(pendingPaymentRecord.discountAmount || 0),
      pointsDiscountAmount: Number(pendingPaymentRecord.pointsDiscountAmount || 0),
      pointsRedeemed: pendingPaymentRecord.pointsRedeemed || 0,
      customerPhone: pendingPaymentRecord.customerPhone || null,
      total: Number(pendingPaymentRecord.total),
      provider: pendingPaymentRecord.provider || 'VIETQR',
      qrUrl,
      bankName: bankAccount?.bankName,
      accountNumber: bankAccount?.accountNumber,
      accountName: bankAccount?.accountName,
    };
  }

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    orderNo: session.orderNo || undefined,
    tableId: session.tableId || session.id,
    tableNumber: session.table?.tableNumber ?? 0,
    tableLabel: session.table?.label ?? 'Mang về',
    groups,
    pendingPayment,
  };
}

export async function approveOrder(sessionId: string, tenantId: string, approverId?: string): Promise<any> {
  // 1. Tìm và validate TableSession
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, tenantId },
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

    // Cập nhật trạng thái bàn thành OCCUPIED nếu gắn với bàn
    let updatedTable = null;
    if (session.tableId) {
      updatedTable = await tx.table.update({
        where: { id: session.tableId },
        data: {
          status: 'OCCUPIED',
        },
      });
    }

    return { updatedSession, updatedTable };
  });

  // Emit table status changed
  if (session.tableId) {
    emitTableStatusChanged(session.tenantId, session.branchId, {
      tableId: session.tableId,
      status: 'OCCUPIED',
      tableNumber: session.table?.tableNumber ?? 0,
      label: session.table?.label ?? 'Mang về',
    });
  }

  // Emit Kitchen New Ticket
  emitKitchenNewTicket(session.tenantId, session.branchId, {
    sessionId,
    orderNo: session.orderNo || undefined,
    tableId: session.tableId || session.id,
    tableNumber: session.table?.tableNumber ?? 0,
    tableLabel: session.table?.label ?? 'Mang về',
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
  emitCartUpdated(session.tenantId, session.branchId, session.tableId || session.id, {
    sessionId,
    tableId: session.tableId || session.id,
    orderItems: session.orderItems.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItem.name,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      status: item.status,
    })),
    total,
    isLocked: true,
    message: '✅ Order của bạn đã được duyệt bởi nhà hàng',
  });

  // Emit order:status-changed cho từng món đã duyệt (để frontend khách cập nhật realtime)
  for (const item of pendingItems) {
    emitOrderStatusChanged(session.tableId || session.id, {
      orderItemId: item.id,
      menuItemId: item.menuItemId,
      sessionId,
      tableId: session.tableId || session.id,
      status: item.status as any,
      menuItemName: item.menuItem.name,
      updatedAt: now.toISOString(),
    });
  }

  return {
    sessionId,
    lockedAt: now,
    tableStatus: 'OCCUPIED',
    approvedItemsCount: pendingItems.reduce((sum, item) => sum + item.qty, 0),
  };
}
