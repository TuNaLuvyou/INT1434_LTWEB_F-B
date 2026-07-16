import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';

const router = Router();

// Áp dụng tính năng WHITE_LABEL (xoá logo gốc, thay bằng logo của tenant, v.v)
router.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']), requireFeature('WHITE_LABEL'));

router.put('/branding', (req, res) => {
  res.json({ success: true, message: 'Cập nhật nhận diện thương hiệu thành công (Mock)' });
});

export default router;
