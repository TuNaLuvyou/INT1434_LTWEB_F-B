import prisma from '../config/prisma';

export const getTenants = async () => {
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
              limits: true
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

export const createTenant = async (data: { name: string; domain?: string; ownerEmail: string; ownerName: string }) => {
  const { name, domain, ownerEmail, ownerName } = data;
  
  // 1. Kiểm tra user hoặc tạo mới
  let user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!user) {
    // Tạm thời tạo password mặc định (hoặc dùng hàm hash)
    // Để an toàn, trong thực tế sẽ gửi email yêu cầu đổi pass, hoặc gen mật khẩu ngẫu nhiên
    const bcrypt = require('bcrypt');
    const defaultPassword = await bcrypt.hash('12345678', 10);
    
    user = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: ownerName,
        passwordHash: defaultPassword,
        role: 'ADMIN' // Role gốc ở Platform level cho tương thích ngược
      }
    });
  }

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
  const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Starter' } });
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
    take: 100, // Lấy 100 log mới nhất
    include: {
      tenant: { select: { name: true } }
    }
  });
  return logs;
};
export const updateTenantSubscriptionPlan = async (tenantId: string, planName: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName }
  });
  if (!plan) throw new Error('Subscription plan not found');
  
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } });
  if (!tenant) throw new Error('Tenant not found');
  
  if (tenant.subscription) {
    return prisma.tenantSubscription.update({
      where: { tenantId },
      data: { planId: plan.id }
    });
  } else {
    return prisma.tenantSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }
    });
  }
};
