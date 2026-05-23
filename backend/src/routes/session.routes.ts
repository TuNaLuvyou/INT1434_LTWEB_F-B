import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  joinSession,
  getSession,
  getActiveSession,
  updateSessionStatus,
} from '../controllers/session.controller';

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
 * ⚠️ Phải đặt TRƯỚC route /:sessionId để tránh Express khớp nhầm
 *    "table" vào param :sessionId.
 */
router.get('/table/:tableId/active', getActiveSession);

/**
 * GET /api/sessions/:sessionId
 * Lấy chi tiết session — client polling / reconnect.
 */
router.get('/:sessionId', getSession);

// ─── PROTECTED (Staff / Manager / Admin) ─────────────────────────────────────

/**
 * PATCH /api/sessions/:sessionId/status
 * Cashier đóng bill hoặc huỷ session.
 */
router.patch(
  '/:sessionId/status',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  updateSessionStatus as any
);

export default router;
