import prisma from '../config/prisma';
import { ensureDefaultSubscriptionPlans } from './platform-admin.service';
import { featureCache, FEATURE_CACHE_TTL } from '../middlewares/feature-cache';

export interface TenantPlanInfo {
  features: string[];
  planName: string | null;
}

/**
 * Lấy thông tin gói cước (danh sách feature + tên gói) của tenant.
 * Có cache theo tenant (60s) — tránh query DB nhiều lần trong thời gian ngắn
 * (auth / me / feature.guard đều dùng chung nguồn này).
 * Nếu tenant chưa có subscription, tự gán gói Starter mặc định.
 */
export const getTenantPlanInfo = async (tenantId: string): Promise<TenantPlanInfo> => {
  const cached = featureCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < FEATURE_CACHE_TTL) {
    return { features: Array.from(cached.features), planName: cached.planName };
  }

  // Đảm bảo các gói cước mặc định đã được khởi tạo trong DB
  await ensureDefaultSubscriptionPlans();

  let tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          plan: {
            include: { features: true },
          },
        },
      },
    },
  });

  if (!tenant) {
    return { features: [], planName: null };
  }

  // Nếu chưa có đăng ký gói cước nào, gán gói Starter mặc định
  if (!tenant.subscription) {
    const starterPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: { equals: 'Starter', mode: 'insensitive' } },
    });
    if (starterPlan) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: starterPlan.id,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        },
      });

      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: {
              plan: {
                include: { features: true },
              },
            },
          },
        },
      });
    }
  }

  const features = (tenant?.subscription?.plan?.features || [])
    .filter((f) => f.isActive)
    .map((f) => f.code);

  const planName = tenant?.subscription?.plan?.name || null;

  featureCache.set(tenantId, {
    timestamp: Date.now(),
    features: new Set(features),
    planName,
  });

  return { features, planName };
};
