import { Router } from 'express';
import { getRevenue, getPeakHours } from '../controllers/analytics.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const analyticsRouter = Router();

// Endpoint phân tích dữ liệu yêu cầu quyền ADMIN hoặc MANAGER
analyticsRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// GET /api/analytics/revenue?from=...&to=...&groupBy=...
analyticsRouter.get('/revenue', getRevenue);

// GET /api/analytics/peak-hours?from=...&to=...
analyticsRouter.get('/peak-hours', getPeakHours);

// GET /api/analytics/export?from=...&to=...&type=full|summary
import { exportExcel } from '../controllers/analytics.controller';
analyticsRouter.get('/export', exportExcel);

export default analyticsRouter;
