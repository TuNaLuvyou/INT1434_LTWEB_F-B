import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as sessionService from '../services/session.service';
import { AppError } from '../utils/app-error';
import { emitCartUpdated } from '../socket/emit.helpers';

// ─── POST /api/sessions/join ──────────────────────────────────────────────────
/**
 * PUBLIC endpoint — được gọi khi khách quét QR code.
 * Trả về session hiện tại hoặc tạo session mới cho bàn.
 */
export async function joinSession(req: Request, res: Response): Promise<void> {
  try {
    const { tableId, source } = req.body as { tableId?: string; source?: string };

    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
      res.status(400).json({ success: false, message: 'tableId là bắt buộc' });
      return;
    }

    const createdViaPos = source === 'POS';
    const { session, isNew } = await sessionService.joinOrCreateSession(tableId.trim(), createdViaPos);

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: { session, isNew, serverTime: Date.now() },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    const message = error.message ?? 'Internal server error';
    res.status(status).json({ success: false, message });
  }
}

// ─── GET /api/sessions/:sessionId ─────────────────────────────────────────────
/**
 * Lấy chi tiết session theo ID — dùng cho client polling sau reconnect.
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const session = await sessionService.getSessionById(sessionId);
    const { orderItems, ...sessionMeta } = session as any;

    res.status(200).json({
      success: true,
      data: { session: sessionMeta, orderItems },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── GET /api/sessions/table/:tableId/active ──────────────────────────────────
/**
 * Lấy session OPEN đang hoạt động của bàn — màn hình cashier.
 */
export async function getActiveSession(req: Request, res: Response): Promise<void> {
  try {
    const { tableId } = req.params as { tableId: string };

    const session = await sessionService.getActiveSessionByTableId(tableId);
    const { orderItems, ...sessionMeta } = session as any;

    res.status(200).json({
      success: true,
      data: { session: sessionMeta, orderItems },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── PATCH /api/sessions/:sessionId/status ───────────────────────────────────
/**
 * Đóng session (PAID | CANCELLED) — yêu cầu auth: ADMIN, MANAGER, STAFF.
 */
export async function updateSessionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { status, keepOccupied } = req.body as { status?: string; keepOccupied?: boolean };

    if (!status || !['PAID', 'CANCELLED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status phải là "PAID" hoặc "CANCELLED"',
      });
      return;
    }

    const updatedSession = await sessionService.updateSessionStatus(
      sessionId,
      status as 'PAID' | 'CANCELLED',
      keepOccupied
    );

    res.status(200).json({
      success: true,
      data: { session: updatedSession },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── POST /api/sessions/:sessionId/cart ────────────────────────────────────────
/**
 * PUBLIC endpoint — thêm hoặc cập nhật một món ăn trong giỏ hàng.
 */
export async function handleAddToCart(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { menuItemId, qty, note, clientTimestamp } = req.body as {
      menuItemId?: string;
      qty?: number;
      note?: string;
      clientTimestamp?: number;
    };

    if (!menuItemId || typeof qty !== 'number' || typeof clientTimestamp !== 'number') {
      res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ (thiếu menuItemId, qty hoặc clientTimestamp)' });
      return;
    }

    const { session, updatedCart } = await sessionService.addToCart(
      sessionId,
      menuItemId,
      qty,
      note,
      clientTimestamp
    );

    // Emit Socket Update realtime tới tất cả thiết bị cùng bàn
    const total = updatedCart.reduce((sum, item) => sum + item.qty * Number(item.unitPrice), 0);
    emitCartUpdated(session.tableId, {
      sessionId,
      tableId: session.tableId,
      orderItems: updatedCart.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
      total,
    });

    res.status(200).json({
      success: true,
      data: updatedCart,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (error.code === 'CONFLICT') {
        res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: error.message,
          currentCart: error.data?.currentCart,
        });
        return;
      }
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── DELETE /api/sessions/:sessionId/cart/:menuItemId ─────────────────────────
/**
 * PUBLIC endpoint — xóa hẳn một món ăn khỏi giỏ hàng.
 */
export async function handleDeleteCartItem(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, menuItemId } = req.params as { sessionId: string; menuItemId: string };
    
    // Đọc clientTimestamp từ query parameter hoặc headers, mặc định Date.now()
    const tsQuery = req.query.clientTimestamp ? Number(req.query.clientTimestamp) : NaN;
    const tsHeader = req.headers['x-client-timestamp'] ? Number(req.headers['x-client-timestamp']) : NaN;
    const clientTimestamp = !isNaN(tsQuery) ? tsQuery : (!isNaN(tsHeader) ? tsHeader : Date.now());

    const { session, updatedCart } = await sessionService.deleteCartItem(
      sessionId,
      menuItemId,
      clientTimestamp
    );

    // Emit Socket Update realtime tới tất cả thiết bị cùng bàn
    const total = updatedCart.reduce((sum, item) => sum + item.qty * Number(item.unitPrice), 0);
    emitCartUpdated(session.tableId, {
      sessionId,
      tableId: session.tableId,
      orderItems: updatedCart.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
      total,
    });

    res.status(200).json({
      success: true,
      data: updatedCart,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (error.code === 'CONFLICT') {
        res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: error.message,
          currentCart: error.data?.currentCart,
        });
        return;
      }
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}
