import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getCashierOverview, getCashierSessionItems, approveCashierSessionItems } from '../controllers/cashier.controller';

const router = Router();

router.use(authMiddleware, requireRole(['STAFF', 'ADMIN', 'MANAGER']));

router.get('/overview', getCashierOverview);
router.get('/sessions/:sessionId/items', getCashierSessionItems);
router.post('/sessions/:sessionId/approve', approveCashierSessionItems);

export default router;
