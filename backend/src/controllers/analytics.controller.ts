import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from '../services/analytics.service';

const revenueQuerySchema = z.object({
  from: z.string().datetime({ message: 'from phải là chuỗi ngày hợp lệ (ISO 8601)' }),
  to: z.string().datetime({ message: 'to phải là chuỗi ngày hợp lệ (ISO 8601)' }),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

/**
 * GET /api/analytics/revenue?from=...&to=...&groupBy=day|week|month
 */
export const getRevenue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, groupBy } = revenueQuerySchema.parse(req.query);
    
    if (new Date(from) > new Date(to)) {
      res.status(400).json({ success: false, message: '"from" không thể lớn hơn "to"' });
      return;
    }

    const data = await svc.getRevenue(from, to, groupBy);
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      console.error('[AnalyticsController] getRevenue error:', e);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

/**
 * GET /api/analytics/peak-hours?from=...&to=...
 */
export const getPeakHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = revenueQuerySchema.parse(req.query);
    
    if (new Date(from) > new Date(to)) {
      res.status(400).json({ success: false, message: '"from" không thể lớn hơn "to"' });
      return;
    }

    const data = await svc.getPeakHours(from, to);
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      console.error('[AnalyticsController] getPeakHours error:', e);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

/**
 * GET /api/analytics/top-selling?from=...&to=...&limit=5
 */
export const getTopSelling = async (req: Request, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

    if (from && to && new Date(from) > new Date(to)) {
      res.status(400).json({ success: false, message: '"from" không thể lớn hơn "to"' });
      return;
    }

    const data = await svc.getTopSellingItems(from, to, limit);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[AnalyticsController] getTopSelling error:', e);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

/**
 * GET /api/analytics/export?from=...&to=...&type=full|summary
 */
import { ExcelService } from '../services/excel.service';

export const exportExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, type } = req.query;
    
    // Set timeout to 60s
    req.setTimeout(60000);

    let fromDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
    let toDate = to ? new Date(to as string) : new Date();

    if (from && typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      fromDate = new Date(`${from}T00:00:00.000Z`);
    }
    if (to && typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      toDate = new Date(`${to}T23:59:59.999Z`);
    } else if (!to) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
    
    const reportType = type === 'summary' ? 'summary' : 'full';

    const excelService = new ExcelService();
    await excelService.generateRevenueReport(res, fromDate, toDate, reportType);
  } catch (e) {
    console.error('[AnalyticsController] exportExcel error:', e);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi xuất Excel' });
    }
  }
};

/**
 * GET /api/analytics/today-overview
 */
export const getTodayOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const rangeType = req.query.rangeType as string || 'today';
    const customDate = req.query.customDate as string || undefined;
    const data = await svc.getTodayOverview(rangeType, customDate);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[AnalyticsController] getTodayOverview error:', e);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

