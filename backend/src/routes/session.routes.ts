import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  joinSession,
  createTakeawaySession,
  getSession,
  getActiveSession,
  updateSessionStatus,
  handleAddToCart,
  handleDeleteCartItem,
  handleClearCart,
  requestPaymentHandler,
  cancelPaymentRequestHandler,
  getReceiptData,
  offlineSyncHandler,
} from '../controllers/session.controller';

import { emitCashierNewOrder, emitCartUpdated } from '../socket/emit.helpers';
import type { Request, Response } from 'express';

const router = Router();

// ─── PUBLIC / PROTECTED SESSION CREATION ────────────────────────────────────

/**
 * POST /api/sessions/takeaway
 * Staff/Cashier tạo đơn mang về không cần bàn.
 */
router.post('/takeaway', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), createTakeawaySession as any);

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
 * GET /api/sessions/:sessionId/receipt
 * PUBLIC — lấy dữ liệu hoá đơn để in/xem (không cần auth).
 * Phải đặt TRƯỚC route /:sessionId để tránh Express khớp nhầm "receipt" vào :sessionId.
 */
router.get('/:sessionId/receipt', getReceiptData);

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

/**
 * DELETE /api/sessions/:sessionId/cart
 * Xóa tất cả items khỏi giỏ hàng (xóa hết).
 */
router.delete('/:sessionId/cart', handleClearCart);

/**
 * POST /api/sessions/:sessionId/request-payment
 * Khách chọn phương thức thanh toán: 'COUNTER' hoặc 'VIETQR'.
 * PUBLIC — không cần auth.
 */
router.post('/:sessionId/request-payment', requestPaymentHandler);

/**
 * POST /api/sessions/:sessionId/cancel-payment
 * Khách đổi ý không thanh toán VietQR nữa (chuyển sang quầy).
 */
router.post('/:sessionId/cancel-payment', cancelPaymentRequestHandler);

/**
 * POST /api/sessions/offline-sync
 * PROTECTED — đồng bộ hành động offline (gửi khi client có mạng trở lại).
 * Yêu cầu xác thực nhân viên (ADMIN/MANAGER/CASHIER) vì handler có thể ghi dữ liệu đơn hàng.
 * Phải đặt TRƯỚC /:sessionId để tránh Express khớp nhầm "offline-sync" vào :sessionId.
 */
router.post(
  '/offline-sync',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'CASHIER']),
  offlineSyncHandler
);

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
  const expectedSecret = process.env.INTERNAL_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  try {
    const { tenantId, branchId, ...payload } = req.body;
    if (!tenantId || !branchId) {
      res.status(400).json({ success: false, message: 'Missing tenantId or branchId in payload' });
      return;
    }
    emitCashierNewOrder(tenantId, branchId, payload as any);
    res.json({ success: true });
  } catch (err) {
    console.error('[internal emit] cashier-new-order error:', err);
    res.status(500).json({ success: false, message: 'Emit failed' });
  }
});

/**
 * POST /api/sessions/emit/cart-updated
 * Next.js Server Action gọi để emit cart:updated về table room (đồng bộ các thiết bị cùng bàn).
 * Dùng sau khi submitOrder để thông báo các thiết bị khác rằng giỏ hàng đã được gửi.
 */
router.post('/emit/cart-updated', (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  try {
    const { tenantId, branchId, tableId, sessionId } = req.body;
    if (!tenantId || !branchId || !tableId || !sessionId) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    emitCartUpdated(tenantId, branchId, tableId, {
      sessionId,
      tableId,
      orderItems: [],
      total: 0,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[internal emit] cart-updated error:', err);
    res.status(500).json({ success: false, message: 'Emit failed' });
  }
});

export default router;


