import { Router } from 'express';
import { getCustomers } from '../../controllers/customer.controller';

const router = Router();

/**
 * GET /api/v1/customers - Danh sách khách hàng và điểm tích lũy
 */
router.get('/', getCustomers as any);

export default router;
