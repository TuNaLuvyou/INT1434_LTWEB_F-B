import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';

const router = Router();

// Áp dụng tính năng MEMBERSHIP
router.use(authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), requireFeature('MEMBERSHIP'));

router.get('/customers', (req, res) => {
  res.json({ success: true, message: 'Danh sách khách hàng thành viên (Mock)' });
});

export default router;
