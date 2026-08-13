import { Router } from 'express';
import { lookupOrCreateCustomer, getCustomers, updateCustomerAdmin } from '../controllers/customer.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint công khai cho khách hàng tra cứu/đăng ký SĐT khi thanh toán
router.post('/lookup-or-create', lookupOrCreateCustomer as any);

// Endpoint quản trị cho admin & manager
router.get('/list', authMiddleware, requireRole(['ADMIN', 'MANAGER']), getCustomers as any);
router.put('/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), updateCustomerAdmin as any);

export default router;

