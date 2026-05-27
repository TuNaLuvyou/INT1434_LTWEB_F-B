import { Router } from 'express';
import { getRevenue } from '../controllers/analytics.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const analyticsRouter = Router();

// Endpoint phân tích dữ liệu yêu cầu quyền ADMIN hoặc MANAGER
analyticsRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// GET /api/analytics/revenue?from=...&to=...&groupBy=...
analyticsRouter.get('/revenue', getRevenue);

export default analyticsRouter;
