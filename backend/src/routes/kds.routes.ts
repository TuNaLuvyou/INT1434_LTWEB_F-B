import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getKdsOrders, updateKdsOrderStatus } from '../controllers/kds.controller';

const router = Router();

// Protected: Only Admin, Manager, or Kitchen staff can view/update KDS
router.get('/orders', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), getKdsOrders);
router.patch('/orders/:sessionId/status', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'KITCHEN']), updateKdsOrderStatus);

export default router;
