import { Request, Response } from 'express';
import * as kdsService from '../services/kds.service';
import prisma from '../config/prisma';
import { emitOrderStatusChanged, emitKitchenItemUpdated } from '../socket/emit.helpers';
import { OrderItemStatus } from '@prisma/client';

export async function getKdsOrders(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await kdsService.getActiveKdsSessions();
    res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    console.error('getKdsOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function updateKdsOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { currentStatus, newStatus } = req.body as {
      currentStatus: 'pending' | 'preparing';
      newStatus: 'PREPARING' | 'DONE';
    };

    if (!sessionId || !currentStatus || !newStatus) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }

    // Find the session to get tableId
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true }
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Không tìm thấy phiên' });
      return;
    }

    // Update items in database
    await kdsService.updateSessionItemsStatus(sessionId, currentStatus, newStatus as OrderItemStatus);

    // Fetch updated items to emit socket events
    const updatedItems = await prisma.orderItem.findMany({
      where: {
        sessionId,
        status: newStatus as OrderItemStatus
      },
      include: { menuItem: true }
    });

    // Emit socket events for each item
    for (const item of updatedItems) {
      // 1. Emit to customer's table room
      emitOrderStatusChanged(session.tableId, {
        orderItemId: item.id,
        sessionId,
        tableId: session.tableId,
        status: newStatus as 'PENDING' | 'PREPARING' | 'DONE' | 'VOID',
        menuItemName: item.menuItem.name,
        updatedAt: item.updatedAt.toISOString()
      });

      // 2. Emit to kitchen room
      emitKitchenItemUpdated({
        orderItemId: item.id,
        tableId: session.tableId,
        menuItemName: item.menuItem.name,
        status: newStatus as 'PREPARING' | 'DONE' | 'VOID',
        updatedAt: item.updatedAt.toISOString()
      });
    }

    res.status(200).json({ success: true, message: 'Đã cập nhật trạng thái món ăn' });
  } catch (error: any) {
    console.error('updateKdsOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}
