import { Router } from 'express';
import { requireFeature } from '../middlewares/feature.guard';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Áp dụng tính năng API_ACCESS (Cho phép gọi API bên thứ 3)
router.use(authMiddleware, requireFeature('API_ACCESS'));

router.get('/data', (req, res) => {
  res.json({ success: true, message: 'Dữ liệu được xuất qua Open API (Mock)' });
});

export default router;
