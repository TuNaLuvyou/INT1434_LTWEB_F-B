import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';
import { getBranding, updateBranding, generateLogo } from '../controllers/branding.controller';

const router = Router();

router.use(authMiddleware);

// Lấy branding hiện tại của tenant (cần để render menu/QR public — không giới hạn gói)
router.get('/', requireRole(['ADMIN', 'MANAGER']), getBranding as any);

// Cập nhật branding (tên, màu, logo đã chọn) — chỉ gói có WHITE_LABEL
router.put('/', requireRole(['ADMIN']), requireFeature('WHITE_LABEL') as any, updateBranding as any);

// Gọi AI tạo 3 lựa chọn logo — chỉ gói có WHITE_LABEL
router.post('/generate-logo', requireRole(['ADMIN']), requireFeature('WHITE_LABEL') as any, generateLogo as any);

export default router;
