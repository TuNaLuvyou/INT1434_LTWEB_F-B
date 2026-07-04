import prisma from '../config/prisma';
import { OrderItemStatus } from '@prisma/client';

export async function getActiveKdsTickets() {
  const sessions = await prisma.tableSession.findMany({
    where: {
      status: { in: ['OPEN', 'PAID'] },
      lockedAt: { not: null }, // Phải duyệt bên cashier rồi mới hiện
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

  // Chỉ hiển thị món đã được duyệt:
  // - PENDING items phải có createdAt <= lockedAt (đã qua duyệt)
  // - PREPARING items luôn hiển thị (đã qua duyệt từ trước)
  return sessions
    .map(session => ({
      ...session,
      orderItems: session.orderItems.filter(item => {
        if (item.status === OrderItemStatus.PENDING) {
          return session.lockedAt && new Date(item.createdAt) <= new Date(session.lockedAt);
        }
        return true;
      })
    }))
    .filter(session => session.orderItems.length > 0);
}

export async function updateOrderItemStatus(orderItemId: string, newStatus: OrderItemStatus) {
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
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
    return updated;
  }

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
