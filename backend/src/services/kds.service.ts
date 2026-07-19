import prisma from '../config/prisma';
import { OrderItemStatus } from '@prisma/client';

export async function getActiveKdsTickets(tenantId: string, branchId?: string) {
  const tableWhere: any = { tenantId };
  if (branchId) tableWhere.branchId = branchId;

  return await prisma.tableSession.findMany({
    where: {
      table: tableWhere,
      status: { in: ['OPEN', 'PAID'] },
      lockedAt: { not: null }, // Phải duyệt bên cashier rồi mới hiện
      orderItems: {
        some: {
          status: { in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING] }
        }
      }
    },
    select: {
      id: true,
      orderNo: true,
      tableId: true,
      openedAt: true,
      lockedAt: true,
      table: {
        select: {
          tableNumber: true,
          label: true,
        },
      },
      orderItems: {
        where: {
          status: { in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING] }
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          sessionId: true,
          menuItemId: true,
          qty: true,
          note: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              isSoldOut: true,
            },
          },
        },
      }
    },
    orderBy: {
      openedAt: 'asc'
    }
  });
}

export async function updateOrderItemStatus(orderItemId: string, newStatus: OrderItemStatus, tenantId?: string) {
  const where: any = { id: orderItemId };
  if (tenantId) where.tenantId = tenantId;
  const item = await prisma.orderItem.findFirst({ where });
  if (!item) throw new Error("Order item not found");

  const existing = await prisma.orderItem.findUnique({
    where: {
      sessionId_menuItemId_status: {
        sessionId: item.sessionId,
        menuItemId: item.menuItemId,
        status: newStatus
      }
    }
  });

  if (existing) {
    const updated = await prisma.orderItem.update({
      where: { id: existing.id },
      data: {
        qty: existing.qty + item.qty,
        note: item.note ? (existing.note ? `${existing.note}, ${item.note}` : item.note) : existing.note
      },
      include: {
        session: { include: { table: true } },
        menuItem: true
      }
    });
    await prisma.orderItem.delete({ where: { id: orderItemId } });
    return {
      item: updated,
      removedOrderItemId: orderItemId,
      deltaQty: item.qty,
    };
  }

  const updated = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { status: newStatus },
    include: {
      session: {
        include: { table: true }
      },
      menuItem: true
    }
  });

  return {
    item: updated,
    deltaQty: item.qty,
  };
}

export async function checkAllItemsDone(sessionId: string, tenantId?: string): Promise<boolean> {
  const where: any = { sessionId, status: { in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING] } };
  if (tenantId) where.tenantId = tenantId;
  const pendingItems = await prisma.orderItem.count({ where });
  return pendingItems === 0;
}
