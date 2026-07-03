import { Request, Response } from 'express';
import * as cashierService from '../services/cashier.service';
import * as ingredientService from '../services/ingredient.service';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  emitOrderStatusChanged,
  emitKitchenItemUpdated,
  emitCartUpdated,
  emitTableSessionUpdated,
} from '../socket/emit.helpers';

type RealtimePreviousStatus = 'PENDING' | 'PREPARING' | 'DONE' | 'VOID';

export async function getCashierOverview(_req: Request, res: Response): Promise<void> {
  try {
    const tables = await cashierService.getCashierOverview();
    res.status(200).json({ success: true, data: { tables } });
  } catch (error: any) {
    console.error('getCashierOverview error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function getCashierSessionItems(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId' });
      return;
    }

    const data = await cashierService.getCashierSessionItems(sessionId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('getCashierSessionItems error:', error);
    res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Lỗi server nội bộ',
    });
  }
}

export async function approveCashierSessionItems(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId' });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const approverId = authReq.user?.userId;

    const data = await cashierService.approveOrder(sessionId, approverId);

    res.status(200).json({
      success: true,
      message: 'Duyệt đơn hàng thành công',
      data,
    });
  } catch (error: any) {
    console.error('approveCashierSessionItems error:', error);
    res.status(error?.statusCode || 500).json({
      success: false,
      code: error?.code || 'INTERNAL_ERROR',
      message: error?.message || 'Lỗi server nội bộ',
    });
  }
}

export async function voidOrderItem(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, orderItemId } = req.params as { sessionId: string; orderItemId: string };
    const authReq = req as AuthenticatedRequest;
    const voidedBy = authReq.user?.userId;

    if (!sessionId || !orderItemId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId hoặc orderItemId' });
      return;
    }

    // 1. Lấy OrderItem hiện tại + session + menuItem
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

    // Validate: chỉ void được khi item ở PENDING hoặc PREPARING
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

    // 2. Cập nhật trạng thái OrderItem → VOID
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

    // 3. Hoàn kho nguyên liệu dựa trên BOM (nếu có)
    try {
      await ingredientService.reverseInventory(orderItemId, voidedBy);
    } catch (reverseErr: any) {
      // Không có BOM hoặc BOM rỗng → bỏ qua, không fail toàn bộ request
      console.warn('[voidOrderItem] reverseStock skip:', reverseErr?.message);
    }

    // 4. Emit: cập nhật màn hình khách hàng (/table/[tableId])
    emitOrderStatusChanged(tableId, {
      orderItemId,
      sessionId,
      tableId,
      status: 'VOID',
      menuItemName: voidedItem.menuItem.name,
      updatedAt: now,
    });

    // 5. Emit: cập nhật màn hình bếp (KDS)
    emitKitchenItemUpdated({
      orderItemId,
      sessionId,
      tableId,
      menuItemId: voidedItem.menuItemId,
      menuItemName: voidedItem.menuItem.name,
      status: 'VOID',
      previousStatus: orderItem.status as RealtimePreviousStatus,
      updatedAt: now,
    });

    // 6. Emit: cập nhật giỏ hàng cho cả bàn + cashier (tính lại tổng tiền)
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
        note: item.note,
        imageUrl: item.menuItem.imageUrl,
        createdAt: item.createdAt.toISOString(),
      })),
      total: newTotal,
      message: `Món "${voidedItem.menuItem.name}" đã bị huỷ bởi nhà hàng.`,
    });
    emitTableSessionUpdated({
      tableId,
      sessionId,
      total: newTotal,
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
    console.error('voidOrderItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}
