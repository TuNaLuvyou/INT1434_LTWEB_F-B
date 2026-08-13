import { Router } from 'express';
import { getRevenue, getPeakHours, getTopSelling, exportExcel, getTodayOverview, getRevenueTrend } from '../controllers/analytics.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';

const analyticsRouter = Router();

// Endpoint phân tích dữ liệu yêu cầu quyền ADMIN hoặc MANAGER
analyticsRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// GET /api/analytics/revenue?from=...&to=...&groupBy=...
analyticsRouter.get('/revenue', requireFeature('ADVANCED_REPORTS') as any, getRevenue);

// GET /api/analytics/peak-hours?from=...&to=...
analyticsRouter.get('/peak-hours', requireFeature('ADVANCED_REPORTS') as any, getPeakHours);

// GET /api/analytics/top-selling?from=...&to=...&limit=5
analyticsRouter.get('/top-selling', requireFeature('ADVANCED_REPORTS') as any, getTopSelling);

// GET /api/analytics/revenue-trend?from=...&to=...&groupBy=hour|day|week|month
analyticsRouter.get('/revenue-trend', requireFeature('ADVANCED_REPORTS') as any, getRevenueTrend);

// GET /api/analytics/today-overview — KPI cơ bản trên dashboard (thuộc CORE_POS)
analyticsRouter.get('/today-overview', getTodayOverview);

// GET /api/analytics/export?from=...&to=...&type=full|summary
analyticsRouter.get('/export', requireFeature('ADVANCED_REPORTS') as any, exportExcel);

export default analyticsRouter;
