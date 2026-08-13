import prisma from '../config/prisma';
import bcrypt from 'bcrypt';

export const ensureDefaultSubscriptionPlans = async () => {
  const defaultPlans = [
    {
      name: 'Starter',
      description: 'Gói dùng thử / cơ bản cho nhà hàng nhỏ',
      price: 0,
      limits: [
        { resourceCode: 'BRANCH', maxLimit: 1 },
        { resourceCode: 'USER', maxLimit: 3 },
        { resourceCode: 'TABLE', maxLimit: 15 },
        { resourceCode: 'MENU_ITEM', maxLimit: 50 },
      ],
      features: ['CORE_POS', 'KDS_ACCESS', 'ORDER_QR']
    },
    {
      name: 'Professional',
      description: 'Gói chuyên nghiệp cho nhà hàng vừa và lớn',
      price: 299000,
      limits: [
        { resourceCode: 'BRANCH', maxLimit: 3 },
        { resourceCode: 'USER', maxLimit: 10 },
        { resourceCode: 'TABLE', maxLimit: 50 },
        { resourceCode: 'MENU_ITEM', maxLimit: 200 },
      ],
      features: [
        'CORE_POS', 
        'KDS_ACCESS', 
        'ORDER_QR', 
        'PROMOTION_ENGINE', 
        'INVENTORY_ACCESS', 
        'ADVANCED_REPORTS', 
        'MULTI_BRANCH'
      ]
    },
    {
      name: 'Enterprise',
      description: 'Gói doanh nghiệp không giới hạn cho chuỗi nhà hàng',
      price: 799000,
      limits: [
        { resourceCode: 'BRANCH', maxLimit: 999 },
        { resourceCode: 'USER', maxLimit: 999 },
        { resourceCode: 'TABLE', maxLimit: 999 },
        { resourceCode: 'MENU_ITEM', maxLimit: 9999 },
      ],
      features: [
        'CORE_POS', 
        'KDS_ACCESS', 
        'ORDER_QR', 
        'PROMOTION_ENGINE', 
        'INVENTORY_ACCESS', 
        'ADVANCED_REPORTS', 
        'MULTI_BRANCH', 
        'WHITE_LABEL', 
        'API_ACCESS', 
        'ALL_FEATURES'
      ]
    }
  ];

  for (const p of defaultPlans) {
    let plan = await prisma.subscriptionPlan.findFirst({
      where: { name: { equals: p.name, mode: 'insensitive' } }
    });

    if (!plan) {
      plan = await prisma.subscriptionPlan.create({
        data: {
          name: p.name,
          description: p.description,
          price: p.price,
          currency: 'VND',
          isActive: true,
        }
      });
    }

    if (plan) {
      // 1. Sync Limits
      for (const lim of p.limits) {
        await prisma.usageLimit.upsert({
          where: {
            planId_resourceCode: {
              planId: plan.id,
              resourceCode: lim.resourceCode
            }
          },
          update: {
            maxLimit: lim.maxLimit
          },
          create: {
            planId: plan.id,
            resourceCode: lim.resourceCode,
            maxLimit: lim.maxLimit
          }
        });
      }

      // 2. Sync Features
      for (const featCode of p.features) {
        await prisma.planFeature.upsert({
          where: {
            planId_code: {
              planId: plan.id,
              code: featCode
            }
          },
          update: {
            isActive: true
          },
          create: {
            planId: plan.id,
            code: featCode,
            isActive: true
          }
        });
      }
    }
  }
};

export const getTenants = async () => {
  await ensureDefaultSubscriptionPlans();
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          branches: true,
          tenantUsers: true,
          tables: true
        }
      },
      tenantUsers: {
        where: { isOwner: true },
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      },
      subscription: {
        include: {
          plan: {
            include: {
              limits: true,
              features: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return tenants.map(t => {
    const plan = t.subscription?.plan;
    const limits: Record<string, number> = {};
    if (plan) {
      plan.limits.forEach(l => { limits[l.resourceCode] = l.maxLimit; });
    } else {
      limits['BRANCH'] = 1;
      limits['TABLE'] = 10;
      limits['USER'] = 3;
      limits['MENU_ITEM'] = 50;
    }
    return {
      id: t.id,
      name: t.name,
      domain: t.domain,
      isActive: t.isActive,
      createdAt: t.createdAt,
      branchCount: t._count.branches,
      userCount: t._count.tenantUsers,
      tableCount: t._count.tables,
      owner: t.tenantUsers.length > 0 ? t.tenantUsers[0].user : null,
      subscription: t.subscription?.plan?.name || 'Starter',
      limits,
    };
  });
};

export const createTenant = async (data: { name: string; domain?: string; ownerEmail: string; ownerName: string; ownerPassword?: string; ownerPhone?: string }) => {
  const { name, domain, ownerEmail, ownerName, ownerPassword, ownerPhone } = data;
  
  // 1. Kiểm tra user hoặc tạo mới
  let user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (user) {
    throw new Error('Email này đã được sử dụng bởi một tài khoản hoặc cửa hàng khác. Vui lòng sử dụng email khác.');
  }

  if (!ownerPassword || ownerPassword.length < 8) {
    throw new Error('ownerPassword là bắt buộc và phải có ít nhất 8 ký tự.');
  }

  const defaultPassword = await bcrypt.hash(ownerPassword, 10);
  
  user = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: ownerName,
      passwordHash: defaultPassword,
      role: 'ADMIN',
      phone: ownerPhone || null
    }
  });

  // 2. Tạo tenant mới
  const tenant = await prisma.tenant.create({
    data: {
      name,
      domain
    }
  });

  // 3. Khởi tạo dữ liệu cơ bản cho Tenant (Role mặc định)
  const ownerRole = await prisma.customRole.create({
    data: {
      tenantId: tenant.id,
      name: 'Owner',
      description: 'Quản trị viên nhà hàng (Toàn quyền)',
    }
  });

  // Gán tất cả quyền cho Owner
  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map(p => ({
      roleId: ownerRole.id,
      permissionId: p.id
    }))
  });

  // 4. Gắn user thành Owner của Tenant
  await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: ownerRole.id,
      isOwner: true
    }
  });

  // 5. Gán gói Starter mặc định
  await ensureDefaultSubscriptionPlans();
  const starterPlan = await prisma.subscriptionPlan.findFirst({ where: { name: { equals: 'Starter', mode: 'insensitive' } } });
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
  }

  // 6. Tạo Branch mặc định
  await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Chi nhánh chính'
    }
  });

  return tenant;
};

export const updateTenant = async (id: string, data: { name?: string; domain?: string; ownerEmail?: string; ownerName?: string; ownerPassword?: string; ownerPhone?: string; isActive?: boolean; subscription?: string }) => {
  const tenantUpdateData: any = {};
  if (data.name !== undefined) tenantUpdateData.name = data.name;
  if (data.domain !== undefined) tenantUpdateData.domain = data.domain;
  if (data.isActive !== undefined) tenantUpdateData.isActive = data.isActive;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: tenantUpdateData
  });

  if (data.subscription !== undefined) {
    await updateTenantSubscriptionPlan(id, data.subscription);
  }

  if (data.ownerEmail || data.ownerName || data.ownerPassword || data.ownerPhone) {
    const tenantOwner = await prisma.tenantUser.findFirst({
      where: { tenantId: id, isOwner: true },
      include: { user: true }
    });

    if (tenantOwner && tenantOwner.user) {
      const updateData: any = {};
      if (data.ownerName) updateData.name = data.ownerName;
      if (data.ownerEmail) updateData.email = data.ownerEmail;
      if (data.ownerPhone !== undefined) updateData.phone = data.ownerPhone;
      
      if (data.ownerPassword) {
        updateData.passwordHash = await bcrypt.hash(data.ownerPassword, 10);
      }

      await prisma.user.update({
        where: { id: tenantOwner.userId },
        data: updateData
      });
    }
  }

  return tenant;
};

export const updateTenantStatus = async (tenantId: string, isActive: boolean) => {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive }
  });
  return tenant;
};

export const getAuditLogs = async (tenantId?: string) => {
  const whereClause = tenantId ? { tenantId } : {};
  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      tenant: { select: { name: true } }
    }
  });
  return logs;
};

async function enforceBranchLimits(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: { include: { limits: true } } } }
    }
  });
  if (!tenant) { return; }

  const limits = tenant.subscription?.plan?.limits || [];
  const branchLimit = limits.find(l => l.resourceCode === 'BRANCH');
  let maxBranches = branchLimit ? branchLimit.maxLimit : 1;
  if (maxBranches === 0) maxBranches = 1;

  const branches = await prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  const toLock = branches.slice(maxBranches).map(b => b.id);
  const toUnlock = branches.slice(0, maxBranches).map(b => b.id);

  if (toLock.length > 0) {
    await prisma.branch.updateMany({
      where: { id: { in: toLock } },
      data: { isLocked: true }
    });
  }
  if (toUnlock.length > 0) {
    await prisma.branch.updateMany({
      where: { id: { in: toUnlock } },
      data: { isLocked: false }
    });
  }
}

export const updateTenantSubscriptionPlan = async (tenantId: string, planName: string) => {
  // Ensure default plans exist in DB automatically with all features & limits
  await ensureDefaultSubscriptionPlans();

  let plan = await prisma.subscriptionPlan.findFirst({
    where: { 
      OR: [
        { name: { equals: planName, mode: 'insensitive' } },
        { id: planName }
      ]
    }
  });

  if (!plan) {
    plan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Starter' } });
  }

  if (!plan) throw new Error('Subscription plan not found');
  
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } });
  if (!tenant) throw new Error('Tenant not found');
  
  let result;
  if (tenant.subscription) {
    result = await prisma.tenantSubscription.update({
      where: { tenantId },
      data: { planId: plan.id }
    });
  } else {
    result = await prisma.tenantSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }
    });
  }

  // Enforce branch limits after plan change
  await enforceBranchLimits(tenantId);

  return result;
};
