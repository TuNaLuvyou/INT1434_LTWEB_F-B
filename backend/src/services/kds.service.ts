import prisma from '../config/prisma';
import { OrderItemStatus } from '@prisma/client';

export async function getActiveKdsSessions() {
  return await prisma.tableSession.findMany({
    where: {
      status: 'OPEN',
      orderItems: {
        some: {
          status: { in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING, OrderItemStatus.DONE] }
        }
      }
    },
    include: {
      table: true,
      orderItems: {
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

export async function updateSessionItemsStatus(sessionId: string, currentStatus: 'pending' | 'preparing', newStatus: OrderItemStatus) {
  const targetStatus = currentStatus === 'pending' ? OrderItemStatus.PENDING : OrderItemStatus.PREPARING;
  
  return await prisma.orderItem.updateMany({
    where: {
      sessionId,
      status: targetStatus
    },
    data: {
      status: newStatus
    }
  });
}
