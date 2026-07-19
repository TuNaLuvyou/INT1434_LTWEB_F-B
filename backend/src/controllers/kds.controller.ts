import { Request, Response } from 'express';
import * as kdsService from '../services/kds.service';
import prisma from '../config/prisma';
import { emitOrderStatusChanged, emitKitchenItemUpdated, emitSessionAllDone, emitCartUpdated } from '../socket/emit.helpers';
import { OrderItemStatus } from '@prisma/client';
import * as ingredientService from '../services/ingredient.service';

type KdsStatusChangeEvent = {
  orderItemId: string;
  removedOrderItemId?: string;
  menuItemId: string;
  menuItemName: string;
  qty: number;
  deltaQty: number;
  note: string | null;
  updatedAt: Date;
};

export async function getKdsTickets(_req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const branchId = authReq.user?.branchId;

    const sessions = await kdsService.getActiveKdsTickets(tenantId, branchId);
    
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
        orderNo: (session as any).orderNo || `ORD-${session.id.substring(0, 4).toUpperCase()}`,
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
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;

    if (!orderItemId || !status) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: { id: orderItemId, tenantId },
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
    const statusUpdate = await kdsService.updateOrderItemStatus(orderItemId, status as OrderItemStatus, tenantId);
    const updatedItem = statusUpdate.item;

    // Emit socket to kitchen
    emitKitchenItemUpdated(updatedItem.session.table.tenantId, updatedItem.session.table.branchId, {
      orderItemId: updatedItem.id,
      sessionId: updatedItem.sessionId,
      removedOrderItemId: statusUpdate.removedOrderItemId,
      tableId: updatedItem.session.tableId,
      menuItemName: updatedItem.menuItem.name,
      qty: updatedItem.qty,
      deltaQty: statusUpdate.deltaQty,
      note: updatedItem.note,
      status: status,
      updatedAt: updatedItem.updatedAt.toISOString()
    });

    emitOrderStatusChanged(updatedItem.session.tableId, {
      orderItemId: updatedItem.id,
      sessionId: updatedItem.sessionId,
      tableId: updatedItem.session.tableId,
      status,
      menuItemName: updatedItem.menuItem.name,
      updatedAt: updatedItem.updatedAt.toISOString()
    });

    if (status === 'DONE') {
      // Check if all items in session are DONE
      const allDone = await kdsService.checkAllItemsDone(updatedItem.sessionId, tenantId);
      if (allDone) {
        emitSessionAllDone(updatedItem.session.table.tenantId, updatedItem.session.table.branchId, {
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
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const branchId = req.query.branchId as string || authReq.user?.branchId;

    const tableWhere: any = { tenantId };
    if (branchId) tableWhere.branchId = branchId;

    const sessions = await prisma.tableSession.findMany({
      where: {
        table: tableWhere,
        status: { in: ['OPEN', 'PAID'] },
        lockedAt: { not: null }, // Phải duyệt bên cashier rồi mới hiện
        orderItems: {
          some: {
            status: { in: ['PENDING', 'PREPARING', 'DONE'] }
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
            status: { in: ['PENDING', 'PREPARING', 'DONE'] }
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
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;

    if (!sessionId || !newStatus) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const targetStatus = newStatus === 'PREPARING' ? 'PENDING' : 'PREPARING';

    const session = await prisma.tableSession.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        tenantId: true,
        branchId: true,
        tableId: true,
        table: {
          select: {
            tableNumber: true,
            label: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Không tìm thấy phiên làm việc' });
      return;
    }

    const itemsToUpdate = await prisma.orderItem.findMany({
      where: {
        sessionId,
        status: targetStatus
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
          },
        },
      }
    });

    const changedItems = await prisma.$transaction(async (tx) => {
      const changes: KdsStatusChangeEvent[] = [];

      for (const item of itemsToUpdate) {
        const existing = await tx.orderItem.findUnique({
          where: {
            sessionId_menuItemId_status: {
              sessionId,
              menuItemId: item.menuItemId,
              status: newStatus
            }
          }
        });

        if (existing) {
          const updated = await tx.orderItem.update({
            where: { id: existing.id },
            data: { 
              qty: existing.qty + item.qty,
              note: item.note ? (existing.note ? `${existing.note}, ${item.note}` : item.note) : existing.note
            }
          });
          await tx.orderItem.delete({
            where: { id: item.id }
          });

          changes.push({
            orderItemId: updated.id,
            removedOrderItemId: item.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem.name,
            qty: updated.qty,
            deltaQty: item.qty,
            note: updated.note,
            updatedAt: updated.updatedAt,
          });
        } else {
          const updated = await tx.orderItem.update({
            where: { id: item.id },
            data: { status: newStatus }
          });

          changes.push({
            orderItemId: updated.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem.name,
            qty: updated.qty,
            deltaQty: item.qty,
            note: updated.note,
            updatedAt: updated.updatedAt,
          });
        }
      }

      return changes;
    });

    for (const item of changedItems) {
      emitKitchenItemUpdated(session.tenantId, session.branchId, {
        orderItemId: item.orderItemId,
        sessionId,
        removedOrderItemId: item.removedOrderItemId,
        tableId: session.tableId,
        menuItemName: item.menuItemName,
        qty: item.qty,
        deltaQty: item.deltaQty,
        note: item.note,
        status: newStatus,
        updatedAt: item.updatedAt.toISOString()
      });

      // Notify customer-facing table room so their progress tracker updates
      emitOrderStatusChanged(session.tableId, {
        orderItemId: item.orderItemId,
        sessionId,
        tableId: session.tableId,
        status: newStatus,
        menuItemName: item.menuItemName,
        updatedAt: item.updatedAt.toISOString()
      });
    }

    if (newStatus === 'DONE') {
      const allDone = await kdsService.checkAllItemsDone(sessionId, tenantId);
      if (allDone && changedItems.length > 0) {
        emitSessionAllDone(session.tenantId, session.branchId, {
          sessionId,
          tableId: session.tableId,
          tableNumber: session.table.tableNumber,
          label: session.table.label
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
    const authReq = req as any;
    const voidedBy = authReq.user?.userId;
    const tenantId = authReq.user?.tenantId;

    if (!sessionId || !orderItemId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId hoặc orderItemId' });
      return;
    }
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: { id: orderItemId, tenantId },
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
      await ingredientService.reverseInventory(orderItemId, voidedBy, (req as any).user?.tenantId, (req as any).user?.branchId);
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

    emitKitchenItemUpdated(voidedItem.session.table.tenantId, voidedItem.session.table.branchId, {
      orderItemId,
      sessionId,
      tableId,
      menuItemName: voidedItem.menuItem.name,
      qty: voidedItem.qty,
      deltaQty: voidedItem.qty,
      note: voidedItem.note,
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

    emitCartUpdated(voidedItem.session.table.tenantId, voidedItem.session.table.branchId, tableId, {
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

export async function deliverKdsOrder(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;

    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
      return;
    }
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const session = await prisma.tableSession.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        tenantId: true,
        branchId: true,
        tableId: true,
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Không tìm thấy phiên làm việc' });
      return;
    }

    const itemsToDeliver = await prisma.orderItem.findMany({
      where: {
        sessionId,
        status: 'DONE'
      },
      include: {
        menuItem: {
          select: { name: true }
        }
      }
    });

    if (itemsToDeliver.length === 0) {
      res.status(404).json({ success: false, message: 'Không có món nào để giao' });
      return;
    }

    const changedItems = await prisma.$transaction(async (tx) => {
      const changes: any[] = [];
      for (const item of itemsToDeliver) {
        const existingDelivered = await tx.orderItem.findUnique({
          where: {
            sessionId_menuItemId_status: {
              sessionId,
              menuItemId: item.menuItemId,
              status: 'DELIVERED'
            }
          }
        });

        if (existingDelivered) {
          const updated = await tx.orderItem.update({
            where: { id: existingDelivered.id },
            data: {
              qty: existingDelivered.qty + item.qty,
              note: item.note ? (existingDelivered.note ? `${existingDelivered.note}, ${item.note}` : item.note) : existingDelivered.note
            }
          });
          await tx.orderItem.delete({
            where: { id: item.id }
          });
          
          changes.push({
            orderItemId: updated.id,
            removedOrderItemId: item.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem.name,
            qty: updated.qty,
            deltaQty: item.qty,
            status: 'DELIVERED',
            updatedAt: updated.updatedAt
          });
        } else {
          const updated = await tx.orderItem.update({
            where: { id: item.id },
            data: { status: 'DELIVERED' }
          });
          
          changes.push({
            orderItemId: updated.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem.name,
            qty: updated.qty,
            deltaQty: item.qty,
            status: 'DELIVERED',
            updatedAt: updated.updatedAt
          });
        }
      }
      return changes;
    });

    const nowStr = new Date().toISOString();
    for (const item of changedItems) {
      emitKitchenItemUpdated(session.tenantId, session.branchId, {
        orderItemId: item.orderItemId,
        sessionId,
        removedOrderItemId: item.removedOrderItemId,
        tableId: session.tableId,
        menuItemName: item.menuItemName,
        qty: item.qty,
        deltaQty: item.deltaQty,
        status: 'DELIVERED',
        updatedAt: item.updatedAt.toISOString()
      });

      emitOrderStatusChanged(session.tableId, {
        orderItemId: item.orderItemId,
        sessionId,
        tableId: session.tableId,
        status: 'DELIVERED',
        menuItemName: item.menuItemName,
        updatedAt: item.updatedAt.toISOString()
      });
    }

    res.status(200).json({ success: true, message: 'Giao món thành công' });
  } catch (error: any) {
    console.error('deliverKdsOrder error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}
