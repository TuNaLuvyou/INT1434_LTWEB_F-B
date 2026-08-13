import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/app-error';
import { AuthenticatedRequest } from './auth.middleware';
import { ensureDefaultSubscriptionPlans } from '../services/platform-admin.service';

const featureCache = new Map<string, { timestamp: number; hasFeature: boolean; planName: string | null }>();
const FEATURE_CACHE_TTL = 60_000; // 60s — cache kết quả check feature theo tenant

/**
 * Middleware để check xem Tenant hiện tại có quyền sử dụng Feature này không.
 */
export function requireFeature(featureCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return next(new AppError(400, 'MISSING_TENANT_ID', 'Không xác định được Tenant hiện tại để kiểm tra tính năng.'));
      }

      const cacheKey = `${tenantId}:${featureCode}`;
      const cached = featureCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FEATURE_CACHE_TTL) {
        if (!cached.hasFeature) {
          return next(new AppError(403, 'FEATURE_NOT_ALLOWED', `Gói cước hiện tại (${cached.planName || 'Miễn phí'}) không hỗ trợ tính năng: ${featureCode}. Vui lòng nâng cấp để sử dụng.`));
        }
        return next();
      }

      // Đảm bảo các gói cước mặc định & tính năng đã được khởi tạo trong DB
      await ensureDefaultSubscriptionPlans();

      let tenant = await prisma.tenant.findUnique({
        where: { id: tenantId as string },
        include: {
          subscription: {
            include: {
              plan: {
                include: {
                  features: true,
                }
              }
            }
          }
        }
      });

      if (!tenant) {
        return next(new AppError(404, 'TENANT_NOT_FOUND', 'Không tìm thấy tenant.'));
      }

      // Nếu chưa có đăng ký gói cước nào, gán gói Starter mặc định
      if (!tenant.subscription) {
        const starterPlan = await prisma.subscriptionPlan.findFirst({
          where: { name: { equals: 'Starter', mode: 'insensitive' } }
        });
        if (starterPlan) {
          await prisma.tenantSubscription.create({
            data: {
              tenantId: tenant.id,
              planId: starterPlan.id,
              status: 'ACTIVE',
              startDate: new Date(),
              endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            }
          });

          // Re-fetch tenant after assigning Starter subscription
          tenant = await prisma.tenant.findUnique({
            where: { id: tenantId as string },
            include: {
              subscription: {
                include: {
                  plan: {
                    include: {
                      features: true,
                    }
                  }
                }
              }
            }
          });
        }
      }

      const features = tenant?.subscription?.plan?.features || [];
      const hasFeature = features.some(f => (f.code === featureCode || f.code === 'ALL_FEATURES') && f.isActive);

      featureCache.set(cacheKey, {
        timestamp: Date.now(),
        hasFeature,
        planName: tenant?.subscription?.plan?.name || null,
      });

      if (!hasFeature) {
        return next(new AppError(403, 'FEATURE_NOT_ALLOWED', `Gói cước hiện tại (${tenant?.subscription?.plan?.name || 'Miễn phí'}) không hỗ trợ tính năng: ${featureCode}. Vui lòng nâng cấp để sử dụng.`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
