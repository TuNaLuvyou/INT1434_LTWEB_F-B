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
    
    // Nếu ngày from > to thì báo lỗi
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
