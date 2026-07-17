import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  getAllVouchersHandler,
  createVoucherHandler,
  updateVoucherHandler,
  deleteVoucherHandler,
  validateVoucherHandler
} from '../controllers/voucher.controller';
import { requireFeature } from '../middlewares/feature.guard';

const router = Router();

// Lấy danh sách voucher (ADMIN, MANAGER, CASHIER)
router.get('/', authMiddleware as any, requireFeature('PROMOTION_ENGINE') as any, requireRole(['ADMIN', 'MANAGER', 'CASHIER']) as any, getAllVouchersHandler as any);

// Tạo mới voucher (ADMIN, MANAGER)
router.post('/', authMiddleware as any, requireFeature('PROMOTION_ENGINE') as any, requireRole(['ADMIN', 'MANAGER']) as any, createVoucherHandler as any);

// Validate voucher — phải đặt TRƯỚC /:id để tránh bị capture nhầm
router.post('/validate', authMiddleware as any, requireFeature('PROMOTION_ENGINE') as any, requireRole(['ADMIN', 'MANAGER', 'CASHIER']) as any, validateVoucherHandler as any);

// Sửa voucher (ADMIN, MANAGER)
router.put('/:id', authMiddleware as any, requireFeature('PROMOTION_ENGINE') as any, requireRole(['ADMIN', 'MANAGER']) as any, updateVoucherHandler as any);

// Xóa/Vô hiệu hóa voucher (ADMIN, MANAGER)
router.delete('/:id', authMiddleware as any, requireFeature('PROMOTION_ENGINE') as any, requireRole(['ADMIN', 'MANAGER']) as any, deleteVoucherHandler as any);

export default router;
