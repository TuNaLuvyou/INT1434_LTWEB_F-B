import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  getAllVouchersHandler,
  createVoucherHandler,
  deleteVoucherHandler,
} from '../controllers/voucher.controller';

const router = Router();

// Lấy danh sách voucher (Yêu cầu đăng nhập, ADMIN hoặc MANAGER hoặc CASHIER để phục vụ cashier chọn hoặc hiển thị)
router.get('/', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), getAllVouchersHandler);

// Tạo mới voucher (ADMIN only)
router.post('/', authMiddleware, requireRole(['ADMIN']), createVoucherHandler);

// Xóa/Vô hiệu hóa voucher (ADMIN only)
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), deleteVoucherHandler);

export default router;
