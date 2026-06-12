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

// Tạo mới voucher (ADMIN, MANAGER)
router.post('/', authMiddleware, requireRole(['ADMIN', 'MANAGER']), createVoucherHandler);

// Validate voucher — phải đặt TRƯỚC /:id để tránh bị capture nhầm
router.post('/validate', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), validateVoucherHandler);

// Sửa voucher (ADMIN, MANAGER)
router.put('/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), updateVoucherHandler);

// Xóa/Vô hiệu hóa voucher (ADMIN, MANAGER)
router.delete('/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), deleteVoucherHandler);

export default router;
