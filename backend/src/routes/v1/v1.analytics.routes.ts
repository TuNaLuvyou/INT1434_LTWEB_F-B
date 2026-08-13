import { Router } from 'express';
import { getRevenue, getTopSelling } from '../../controllers/analytics.controller';

const router = Router();

/**
 * GET /api/v1/analytics/revenue - Báo cáo doanh thu theo ngày/tuần/tháng
 * GET /api/v1/analytics/top-items - Top món bán chạy
 */
router.get('/revenue', getRevenue as any);
router.get('/top-items', getTopSelling as any);

export default router;
