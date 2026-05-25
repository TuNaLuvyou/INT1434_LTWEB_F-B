import prisma from '../config/prisma';
import { OrderItemStatus, TableStatus } from '@prisma/client';

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
