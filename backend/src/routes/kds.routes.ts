import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';
import { getKdsTickets, updateKdsItemStatus, getKdsOrders, updateKdsOrderStatus, voidKdsOrderItem } from '../controllers/kds.controller';

const router = Router();

// Apply auth, role and feature guard to all KDS routes
router.use(authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), requireFeature('KDS_ACCESS'));

// Protected: Only Admin, Manager, or Kitchen staff can view/update KDS
router.get('/tickets', getKdsTickets);
router.patch('/items/:orderItemId/status', updateKdsItemStatus);

router.get('/orders', getKdsOrders);
router.patch('/orders/:sessionId/status', updateKdsOrderStatus);

// KDS Void Item: Cho phép bếp huỷ món khi hết hàng trực tiếp từ màn hình bếp
router.patch('/sessions/:sessionId/items/:orderItemId/void', voidKdsOrderItem);

export default router;
