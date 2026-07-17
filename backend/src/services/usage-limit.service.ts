import prisma from '../config/prisma';
import { AppError } from '../utils/app-error';

export async function checkUsageLimit(tenantId: string, resourceCode: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          plan: {
            include: {
              limits: true,
            }
          }
        }
      }
    }
  });

  if (!tenant) throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant khong ton tai.');

  const limits = tenant.subscription?.plan?.limits || [];
  const limit = limits.find(l => l.resourceCode === resourceCode);
  
  // Neu khong co thiet lap gioi han cho resource nay trong Plan hien tai, mac dinh la 0 hoac tu choi?
  // Theo requirement, nen tra ve loi. 
  // O day chung ta se cho phep mac dinh neu khong tim thay (hoac set cung theo Starter neu chua co sub).
  // Hien tai fallback maxLimit = 1 hoac 0 tuỳ resource neu khong co subscription.
  let maxLimit = limit ? limit.maxLimit : 0; 

  if (maxLimit === 0 && !tenant.subscription) {
    // Truong hop tenant chua co sub nao, fallback default limit:
    const defaultLimits: Record<string, number> = {
      'BRANCH': 1,
      'TABLE': 10,
      'USER': 3,
      'MENU_ITEM': 50
    };
    maxLimit = defaultLimits[resourceCode] || 0;
  }

  let currentCount = 0;

  switch (resourceCode) {
    case 'BRANCH':
      currentCount = await prisma.branch.count({ where: { tenantId } });
      break;
    case 'TABLE':
      currentCount = await prisma.table.count({ where: { tenantId } });
      break;
    case 'USER':
      currentCount = await prisma.tenantUser.count({ where: { tenantId } });
      break;
    case 'MENU_ITEM':
      currentCount = await prisma.menuItem.count({ where: { tenantId, isActive: true } });
      break;
    default:
      throw new AppError(400, 'INVALID_RESOURCE', `Tai nguyen ${resourceCode} khong duoc ho tro de check limit.`);
  }

  if (currentCount >= maxLimit) {
    throw new AppError(403, 'USAGE_LIMIT_EXCEEDED', `Goi cuoc hien tai chi cho phep toi da ${maxLimit} ${resourceCode}. Vui long nang cap goi cuoc de them moi.`);
  }
}
