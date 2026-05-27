import { Request, Response } from 'express';
import * as kdsService from '../services/kds.service';
import prisma from '../config/prisma';
import { emitOrderStatusChanged, emitKitchenItemUpdated, emitSessionAllDone, emitCartUpdated } from '../socket/emit.helpers';
import { OrderItemStatus } from '@prisma/client';
import * as ingredientService from '../services/ingredient.service';

export async function getKdsTickets(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await kdsService.getActiveKdsTickets();
    
    const now = new Date().getTime();

    const tickets = sessions.map(session => {
      const items = session.orderItems.map(item => {
        const itemCreatedAt = new Date(item.createdAt).getTime();
        const waitMinutes = Math.floor((now - itemCreatedAt) / 60000);

        return {
          orderItemId: item.id,
          menuItemId: item.menuItem.id,
          menuItemName: item.menuItem.name,
          menuItemImage: item.menuItem.imageUrl,
          qty: item.qty,
          note: item.note,
          status: item.status,
          waitMinutes,
          isSoldOut: item.menuItem.isSoldOut,
          createdAt: item.createdAt.toISOString()
        };
      });

      return {
        sessionId: session.id,
        tableNumber: session.table.tableNumber,
        tableLabel: session.table.label,
        items
      };
    });

    res.status(200).json({ success: true, data: { tickets } });
  } catch (error: any) {
    console.error('getKdsTickets error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function updateKdsItemStatus(req: Request, res: Response): Promise<void> {
  try {
    const orderItemId = req.params.orderItemId as string;
    const { status } = req.body as { status: 'PREPARING' | 'DONE' };

    if (!orderItemId || !status) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        session: { include: { table: true } },
        menuItem: true
      }
    });

    if (!orderItem) {
      res.status(404).json({ success: false, message: 'Không tìm thấy món ăn' });
      return;
    }

    // Validate status flow
    const currentStatus = orderItem.status;
    if (
      (currentStatus === 'PENDING' && status !== 'PREPARING') ||
      (currentStatus === 'PREPARING' && status !== 'DONE') ||
      (currentStatus === 'DONE') ||
      (currentStatus === 'VOID')
    ) {
      res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      return;
    }

    // Update item
    const updatedItem = await kdsService.updateOrderItemStatus(orderItemId, status as OrderItemStatus);

    // Emit socket to kitchen
    emitKitchenItemUpdated({
      orderItemId,
      tableId: updatedItem.session.tableId,
      menuItemName: updatedItem.menuItem.name,
      status: status,
      updatedAt: updatedItem.updatedAt.toISOString()
    });

    if (status === 'DONE') {
      // Check if all items in session are DONE
      const allDone = await kdsService.checkAllItemsDone(updatedItem.sessionId);
      if (allDone) {
        emitSessionAllDone({
          sessionId: updatedItem.sessionId,
          tableId: updatedItem.session.tableId,
          tableNumber: updatedItem.session.table.tableNumber,
          label: updatedItem.session.table.label
        });
      }
    }

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error: any) {
    console.error('updateKdsItemStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function getKdsOrders(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await prisma.tableSession.findMany({
      where: {
        status: { in: ['OPEN', 'PAID'] },
        lockedAt: { not: null }, // Phải duyệt bên cashier rồi mới hiện
        orderItems: {
          some: {
            status: { in: ['PENDING', 'PREPARING', 'DONE'] }
          }
        }
      },
      include: {
        table: true,
        orderItems: {
          where: {
            status: { in: ['PENDING', 'PREPARING', 'DONE'] }
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
    res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    console.error('getKdsOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function updateKdsOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { newStatus } = req.body as { newStatus: 'PREPARING' | 'DONE' };

    if (!sessionId || !newStatus) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }

    const targetStatus = newStatus === 'PREPARING' ? 'PENDING' : 'PREPARING';

    // Update all items in this session that are currently in targetStatus
    await prisma.orderItem.updateMany({
      where: {
        sessionId,
        status: targetStatus
      },
      data: {
        status: newStatus
      }
    });

    // Emit socket events
    const updatedItems = (await prisma.orderItem.findMany({
      where: {
        sessionId,
        status: newStatus
      },
      include: {
        session: { include: { table: true } },
        menuItem: true
      }
    })) as any[];

    for (const item of updatedItems) {
      emitKitchenItemUpdated({
        orderItemId: item.id,
        tableId: item.session.tableId,
        menuItemName: item.menuItem.name,
        status: newStatus,
        updatedAt: item.updatedAt.toISOString()
      });

    }

    if (newStatus === 'DONE') {
      const allDone = await kdsService.checkAllItemsDone(sessionId);
      if (allDone && updatedItems.length > 0) {
        emitSessionAllDone({
          sessionId,
          tableId: updatedItems[0].session.tableId,
          tableNumber: updatedItems[0].session.table.tableNumber,
          label: updatedItems[0].session.table.label
        });
      }
    }

    res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error: any) {
    console.error('updateKdsOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function voidKdsOrderItem(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, orderItemId } = req.params as { sessionId: string; orderItemId: string };
    const voidedBy = (req as any).user?.userId;

    if (!sessionId || !orderItemId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId hoặc orderItemId' });
      return;
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        session: { include: { table: true } },
        menuItem: true,
      },
    });

    if (!orderItem) {
      res.status(404).json({ success: false, message: 'Không tìm thấy món' });
      return;
    }

    if (orderItem.status === 'DONE' || orderItem.status === 'VOID') {
      res.status(409).json({
        success: false,
        message: `Không thể huỷ món có trạng thái ${orderItem.status}`,
      });
      return;
    }

    if (orderItem.sessionId !== sessionId) {
      res.status(400).json({ success: false, message: 'OrderItem không thuộc session này' });
      return;
    }

    const voidedItem = await prisma.$transaction(async (tx) => {
      const existingVoid = await tx.orderItem.findFirst({
        where: {
          sessionId,
          menuItemId: orderItem.menuItemId,
          status: 'VOID',
          NOT: { id: orderItemId },
        },
        select: { id: true },
      });

      if (existingVoid) {
        await tx.orderItem.delete({ where: { id: existingVoid.id } });
      }

      return await tx.orderItem.update({
        where: { id: orderItemId },
        data: { status: 'VOID' },
        include: {
          session: { include: { table: true } },
          menuItem: true,
        },
      });
    });

    const tableId = voidedItem.session.tableId;
    const now = new Date().toISOString();

    try {
      await ingredientService.reverseStockByOrderItem(orderItemId, voidedBy);
    } catch (reverseErr: any) {
      console.warn('[voidKdsOrderItem] reverseStock skip:', reverseErr?.message);
    }

    emitOrderStatusChanged(tableId, {
      orderItemId,
      sessionId,
      tableId,
      status: 'VOID',
      menuItemName: voidedItem.menuItem.name,
      updatedAt: now,
    });

    emitKitchenItemUpdated({
      orderItemId,
      tableId,
      menuItemName: voidedItem.menuItem.name,
      status: 'VOID',
      updatedAt: now,
    });

    const remainingItems = await prisma.orderItem.findMany({
      where: { sessionId, status: { not: 'VOID' } },
      include: { menuItem: true },
    });

    const newTotal = remainingItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.qty,
      0
    );

    emitCartUpdated(tableId, {
      sessionId,
      tableId,
      orderItems: remainingItems.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
      total: newTotal,
      message: `Món "${voidedItem.menuItem.name}" đã bị huỷ bởi nhà bếp do hết món.`,
    });

    res.status(200).json({
      success: true,
      message: `Đã huỷ món "${voidedItem.menuItem.name}" thành công`,
      data: {
        orderItemId,
        menuItemName: voidedItem.menuItem.name,
        status: 'VOID',
        voidedAt: now,
      },
    });
  } catch (error: any) {
    console.error('voidKdsOrderItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}
