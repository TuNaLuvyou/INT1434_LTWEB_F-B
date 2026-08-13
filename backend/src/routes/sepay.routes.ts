import { Router } from 'express';
import { handleSepayWebhook } from '../controllers/sepay.controller';

const router = Router();

/**
 * POST /api/webhooks/sepay
 * Webhook nhận thông báo biến động số dư từ dịch vụ SePay (chuyển khoản VietQR)
 */
router.post('/', handleSepayWebhook);

export default router;
