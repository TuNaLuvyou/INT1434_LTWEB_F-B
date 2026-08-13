import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { AuthenticatedRequest } from './auth.middleware';
import { getTenantPlanInfo } from '../services/tenant-plan.service';

/**
 * Middleware để check xem Tenant hiện tại có quyền sử dụng Feature này không.
 * Đọc gói cước từ getTenantPlanInfo (cache 60s theo tenant) — kiểm tra nhanh
 * ngay cả khi cùng request đi qua nhiều requireFeature khác nhau.
 */
export function requireFeature(featureCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return next(new AppError(400, 'MISSING_TENANT_ID', 'Không xác định được Tenant hiện tại để kiểm tra tính năng.'));
      }

      const { features, planName } = await getTenantPlanInfo(tenantId);

      if (!features.includes(featureCode) && !features.includes('ALL_FEATURES')) {
        return next(new AppError(403, 'FEATURE_NOT_ALLOWED', `Gói cước hiện tại (${planName || 'Miễn phí'}) không hỗ trợ tính năng: ${featureCode}. Vui lòng nâng cấp để sử dụng.`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
