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
    include: {
      table: true,
      orderItems: {
        where: {
          status: { in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING] }
        },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          menuItem: true
        }
      }
    },
    orderBy: {
      openedAt: 'asc'
    }
  });
}

export async function updateOrderItemStatus(orderItemId: string, newStatus: OrderItemStatus) {
  return await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { status: newStatus },
    include: {
      session: {
        include: { table: true }
      },
      menuItem: true
    }
  });
}

export async function checkAllItemsDone(sessionId: string): Promise<boolean> {
  const pendingItems = await prisma.orderItem.count({
    where: {
      sessionId,
      status: {
        in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING]
      }
    }
  });
  return pendingItems === 0;
}
