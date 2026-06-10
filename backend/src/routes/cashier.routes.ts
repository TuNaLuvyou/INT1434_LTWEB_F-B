import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getCashierOverview, getCashierSessionItems, approveCashierSessionItems, voidOrderItem } from '../controllers/cashier.controller';

const router = Router();

router.use(authMiddleware, requireRole(['STAFF', 'ADMIN', 'MANAGER', 'CASHIER']));

router.get('/overview', getCashierOverview);
router.get('/sessions/:sessionId/items', getCashierSessionItems);
router.post('/sessions/:sessionId/approve', approveCashierSessionItems);

// Void một OrderItem: huỷ món, hoàn kho, phát socket event đến màn hình khách
router.patch('/sessions/:sessionId/items/:orderItemId/void', voidOrderItem);

export default router;
