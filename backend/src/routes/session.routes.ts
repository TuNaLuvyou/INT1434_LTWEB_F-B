import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  joinSession,
  getSession,
  getActiveSession,
  updateSessionStatus,
  handleAddToCart,
  handleDeleteCartItem,
} from '../controllers/session.controller';
import { emitCashierNewOrder } from '../socket/emit.helpers';
import type { Request, Response } from 'express';

const router = Router();

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions/join
 * Được gọi khi khách quét QR → trang /menu/[tableId] load.
 * Tạo session mới hoặc trả về session đang mở.
 */
router.post('/join', joinSession);

/**
 * GET /api/sessions/table/:tableId/active
 * Lấy session OPEN của bàn — màn hình cashier.
 * Phải đặt TRƯỚC route /:sessionId để tránh Express khớp nhầm "table" vào :sessionId.
 */
router.get('/table/:tableId/active', getActiveSession);

/**
 * GET /api/sessions/:sessionId
 * Lấy chi tiết session — client polling / reconnect.
 */
router.get('/:sessionId', getSession);

/**
 * POST /api/sessions/:sessionId/cart
 * Thêm hoặc cập nhật một món ăn trong giỏ hàng.
 */
router.post('/:sessionId/cart', handleAddToCart);

/**
 * DELETE /api/sessions/:sessionId/cart/:menuItemId
 * Xóa một món ăn khỏi giỏ hàng.
 */
router.delete('/:sessionId/cart/:menuItemId', handleDeleteCartItem);

// ─── PROTECTED (Staff / Manager / Admin) ─────────────────────────────────────

/**
 * PATCH /api/sessions/:sessionId/status
 * Cashier đóng bill hoặc huỷ session.
 */
router.patch(
  '/:sessionId/status',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'CASHIER']),
  updateSessionStatus as any
);

// ─── INTERNAL (chỉ Next.js Server Action gọi, không expose ra ngoài) ──────────

/**
 * POST /api/sessions/emit/cashier-new-order
 * Next.js Server Action gọi để trigger Socket.io emit về cashier room.
 * Validate bằng X-Internal-Secret header.
 *
 * Lý do dùng HTTP thay vì import trực tiếp:
 * - Frontend (Next.js) và Backend (Express) là 2 process riêng biệt
 * - Không thể share module qua process boundary
 * - HTTP call đơn giản, observable, dễ debug
 */
router.post('/emit/cashier-new-order', (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_SECRET || 'restoflow-internal';

  if (secret !== expectedSecret) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  try {
    emitCashierNewOrder(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('[internal emit] cashier-new-order error:', err);
    res.status(500).json({ success: false, message: 'Emit failed' });
  }
});

export default router;

