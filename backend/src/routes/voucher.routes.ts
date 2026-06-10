import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  getAllVouchersHandler,
  createVoucherHandler,
  updateVoucherHandler,
  deleteVoucherHandler,
  validateVoucherHandler
} from '../controllers/voucher.controller';

const router = Router();

// Lấy danh sách voucher (ADMIN, MANAGER, CASHIER)
router.get('/', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), getAllVouchersHandler);

// Tạo mới voucher (ADMIN only)
router.post('/', authMiddleware, requireRole(['ADMIN']), createVoucherHandler);

// Validate voucher — phải đặt TRƯỚC /:id để tránh bị capture nhầm
router.post('/validate', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), validateVoucherHandler);

// Sửa voucher (ADMIN only)
router.put('/:id', authMiddleware, requireRole(['ADMIN']), updateVoucherHandler);

// Xóa/Vô hiệu hóa voucher (ADMIN only)
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), deleteVoucherHandler);

export default router;
