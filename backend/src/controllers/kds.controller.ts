import { Request, Response } from 'express';
import * as kdsService from '../services/kds.service';
import prisma from '../config/prisma';
import { emitOrderStatusChanged, emitKitchenItemUpdated, emitSessionAllDone } from '../socket/emit.helpers';
import { OrderItemStatus } from '@prisma/client';

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
      // Emit socket to customer table
      emitOrderStatusChanged(updatedItem.session.tableId, {
        orderItemId,
        sessionId: updatedItem.sessionId,
        tableId: updatedItem.session.tableId,
        status: 'DONE',
        menuItemName: updatedItem.menuItem.name,
        updatedAt: updatedItem.updatedAt.toISOString()
      });

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
        status: 'OPEN',
      },
      include: {
        table: true,
        orderItems: {
          where: {
            status: { not: 'VOID' }
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

      if (newStatus === 'DONE') {
        emitOrderStatusChanged(item.session.tableId, {
          orderItemId: item.id,
          sessionId: item.sessionId,
          tableId: item.session.tableId,
          status: 'DONE',
          menuItemName: item.menuItem.name,
          updatedAt: item.updatedAt.toISOString()
        });
      }
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
