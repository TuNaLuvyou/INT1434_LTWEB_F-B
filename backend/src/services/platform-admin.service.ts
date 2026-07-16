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
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return tenants.map(t => ({
    id: t.id,
    name: t.name,
    domain: t.domain,
    isActive: t.isActive,
    createdAt: t.createdAt,
    branchCount: t._count.branches,
    userCount: t._count.tenantUsers,
    tableCount: t._count.tables,
    owner: t.tenantUsers.length > 0 ? t.tenantUsers[0].user : null,
    subscription: 'Free Trial' // Mặc định cho phase này
  }));
};

export const createTenant = async (data: { name: string; domain?: string; ownerEmail: string; ownerName: string }) => {
  const { name, domain, ownerEmail, ownerName } = data;
  
  // 1. Kiểm tra user hoặc tạo mới
  let user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!user) {
    // Tạm thời tạo password mặc định (hoặc dùng hàm hash)
    // Để an toàn, trong thực tế sẽ gửi email yêu cầu đổi pass, hoặc gen mật khẩu ngẫu nhiên
    const bcrypt = require('bcryptjs');
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

  // 5. Tạo Branch mặc định
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
