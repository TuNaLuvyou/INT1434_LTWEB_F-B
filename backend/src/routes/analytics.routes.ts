import { Router } from 'express';
import { getRevenue, getPeakHours, getTopSelling } from '../controllers/analytics.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const analyticsRouter = Router();

// Endpoint phân tích dữ liệu yêu cầu quyền ADMIN hoặc MANAGER
analyticsRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// GET /api/analytics/revenue?from=...&to=...&groupBy=...
analyticsRouter.get('/revenue', getRevenue);

// GET /api/analytics/peak-hours?from=...&to=...
analyticsRouter.get('/peak-hours', getPeakHours);

// GET /api/analytics/top-selling?from=...&to=...&limit=5
analyticsRouter.get('/top-selling', getTopSelling);

export default analyticsRouter;
