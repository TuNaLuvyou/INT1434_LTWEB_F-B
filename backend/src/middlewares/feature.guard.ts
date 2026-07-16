import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/app-error';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware de check xem Tenant hien tai co quyen su dung Feature nay khong.
 */
export function requireFeature(featureCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Uu tien lay tenantId tu JWT (neu da login vao tenant), sau do lay tu param/body/header
      const tenantId = authReq.user?.tenantId || req.params.tenantId || req.body.tenantId || req.headers['x-tenant-id'];

      if (!tenantId) {
        return next(new AppError(400, 'MISSING_TENANT_ID', 'Khong xac dinh duoc Tenant hien tai de kiem tra tinh nang.'));
      }

      const tenant = await prisma.tenant.findUnique({
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
        return next(new AppError(404, 'TENANT_NOT_FOUND', 'Khong tim thay tenant.'));
      }

      // Neu chua co dang ky nao, mac dinh la khong co feature (hoac co the fallback ve Starter neu can)
      const features = tenant.subscription?.plan?.features || [];
      const hasFeature = features.some(f => f.code === featureCode && f.isActive);

      if (!hasFeature) {
        return next(new AppError(403, 'FEATURE_NOT_ALLOWED', `Goi cuoc cua ban khong ho tro tinh nang: ${featureCode}. Vui long nang cap de su dung.`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
