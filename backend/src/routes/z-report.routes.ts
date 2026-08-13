import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';
import {
  getZReportData,
  downloadZReportPDF,
  sendZReportEmailHandler,
} from '../controllers/z-report.controller';

const zReportRouter = Router();

// Tất cả các route Z-Report yêu cầu xác thực, quyền ADMIN/MANAGER và gói có ADVANCED_REPORTS
zReportRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']), requireFeature('ADVANCED_REPORTS') as any);

/**
 * GET /api/z-report/data?from=<ISO>&to=<ISO>
 * Lấy dữ liệu Z-Report dạng JSON để frontend render preview.
 */
zReportRouter.get('/data', getZReportData);

/**
 * GET /api/z-report/download?from=<ISO>&to=<ISO>
 * Download file PDF Z-Report trực tiếp về trình duyệt.
 */
zReportRouter.get('/download', downloadZReportPDF);

/**
 * POST /api/z-report/send-email
 * Body: { from: string, to: string }
 * Tạo PDF Z-Report và gửi email tới Manager.
 */
zReportRouter.post('/send-email', sendZReportEmailHandler);

export default zReportRouter;
