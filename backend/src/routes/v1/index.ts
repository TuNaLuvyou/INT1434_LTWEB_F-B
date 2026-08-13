import { Router } from 'express';
import { apiKeyAuthMiddleware } from '../../middlewares/apiKeyAuth.middleware';
import v1MenuRoutes from './v1.menu.routes';
import v1OrdersRoutes from './v1.orders.routes';
import v1AnalyticsRoutes from './v1.analytics.routes';
import v1CustomersRoutes from './v1.customers.routes';

const router = Router();

// Toàn bộ các route dưới /api/v1/ đều sử dụng apiKeyAuthMiddleware (header: x-api-key)
router.use(apiKeyAuthMiddleware);

router.use('/menu', v1MenuRoutes);
router.use('/orders', v1OrdersRoutes);
router.use('/analytics', v1AnalyticsRoutes);
router.use('/customers', v1CustomersRoutes);

export default router;
