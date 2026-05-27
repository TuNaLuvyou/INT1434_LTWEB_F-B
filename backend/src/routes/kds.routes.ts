import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getKdsTickets, updateKdsItemStatus, getKdsOrders, updateKdsOrderStatus, voidKdsOrderItem } from '../controllers/kds.controller';

const router = Router();

// Protected: Only Admin, Manager, or Kitchen staff can view/update KDS
router.get('/tickets', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), getKdsTickets);
router.patch('/items/:orderItemId/status', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), updateKdsItemStatus);

router.get('/orders', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), getKdsOrders);
router.patch('/orders/:sessionId/status', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), updateKdsOrderStatus);

// KDS Void Item: Cho phép bếp huỷ món khi hết hàng trực tiếp từ màn hình bếp
router.patch('/sessions/:sessionId/items/:orderItemId/void', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), voidKdsOrderItem);

export default router;
