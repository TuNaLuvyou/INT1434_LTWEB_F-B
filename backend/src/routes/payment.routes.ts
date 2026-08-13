import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { validateVoucherHandler, processPaymentHandler, confirmManualPaymentHandler } from '../controllers/payment.controller';

const router = Router();

// Bat buoc phai dang nhap va co quyen CASHIER/MANAGER/ADMIN
router.use(authMiddleware, requireRole(['CASHIER', 'MANAGER', 'ADMIN']));

/**
 * GET /api/payment/validate-voucher?code=SUMMER20&subtotal=225000
 * Validate ma voucher va tra ve ket qua giam gia.
 */
router.get('/validate-voucher', validateVoucherHandler);

/**
 * POST /api/payment/sessions/:sessionId/pay
 * Xu ly thanh toan: tao Payment record, dong session, reset ban.
 */
router.post('/sessions/:sessionId/pay', processPaymentHandler);

/**
 * POST /api/payment/:paymentId/confirm
 * Cashier xac nhan thanh toan (chu yeu cho VietQR/Chuyen khoan thu cong)
 */
router.post('/:paymentId/confirm', confirmManualPaymentHandler);

export default router;
