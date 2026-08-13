import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getBranding, updateBranding, generateLogo } from '../controllers/branding.controller';

const router = Router();

router.use(authMiddleware);

// Lấy branding hiện tại của tenant
router.get('/', requireRole(['ADMIN', 'MANAGER']), getBranding as any);

// Cập nhật branding (tên, màu, logo đã chọn)
router.put('/', requireRole(['ADMIN']), updateBranding as any);

// Gọi AI tạo 3 lựa chọn logo
router.post('/generate-logo', requireRole(['ADMIN']), generateLogo as any);

export default router;
