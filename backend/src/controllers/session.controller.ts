import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as sessionService from '../services/session.service';

// ─── POST /api/sessions/join ──────────────────────────────────────────────────
/**
 * PUBLIC endpoint — được gọi khi khách quét QR code.
 * Trả về session hiện tại hoặc tạo session mới cho bàn.
 */
export async function joinSession(req: Request, res: Response): Promise<void> {
  try {
    const { tableId } = req.body as { tableId?: string };

    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
      res.status(400).json({ success: false, message: 'tableId là bắt buộc' });
      return;
    }

    const { session, isNew } = await sessionService.joinOrCreateSession(tableId.trim());

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: { session, isNew },
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
    const { sessionId } = req.params;

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
    const { tableId } = req.params;

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
    const { sessionId } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !['PAID', 'CANCELLED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status phải là "PAID" hoặc "CANCELLED"',
      });
      return;
    }

    const updatedSession = await sessionService.updateSessionStatus(
      sessionId,
      status as 'PAID' | 'CANCELLED'
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
