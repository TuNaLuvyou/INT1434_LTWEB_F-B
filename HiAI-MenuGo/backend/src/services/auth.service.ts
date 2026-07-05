import prisma from '../config/prisma';
import { Role } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';

export const registerUser = async (data: any) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('EMAIL_EXISTS');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: hashedPassword,
      role: data.role || Role.CASHIER,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    }
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  return { user, accessToken, refreshToken };
};

export const loginUser = async (email: string, plainText: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenantUsers: {
        include: {
          tenant: true,
          customRole: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new Error('ACCOUNT_INACTIVE');
  }

  const isMatch = await comparePassword(plainText, user.passwordHash);

  if (!isMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Token cấp 1 (chỉ có userId)
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  const { passwordHash, tenantUsers, ...userWithoutPassword } = user;

  const tenants = tenantUsers.map(tu => ({
    id: tu.tenant.id,
    name: tu.tenant.name,
    domain: tu.tenant.domain,
    isOwner: tu.isOwner,
    role: tu.customRole?.name || 'N/A'
  }));

  return { user: { ...userWithoutPassword, tenants }, accessToken, refreshToken };
};

export const selectTenant = async (userId: string, tenantId: string, branchId?: string) => {
  // Check access
  const tu = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    include: {
      tenant: true,
      customRole: {
        include: { permissions: { include: { permission: true } } }
      }
    }
  });

  if (!tu || !tu.tenant.isActive) {
    throw new Error('TENANT_ACCESS_DENIED');
  }

  // Check branch if provided
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.tenantId !== tenantId || !branch.isActive) {
      throw new Error('BRANCH_NOT_FOUND');
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const permissions = tu.customRole?.permissions.map(p => p.permission.code) || [];
  
  if (tu.isOwner) {
    permissions.push('ALL'); // Pseudo permission for owner
  }

  const accessToken = generateAccessToken({ 
    userId: user.id, 
    email: user.email, 
    role: user.role, // Legacy role
    tenantId: tenantId,
    branchId: branchId,
    customRole: tu.customRole?.name || (tu.isOwner ? 'OWNER' : 'GUEST'),
    permissions: permissions
  });

  const refreshToken = generateRefreshToken({ userId: user.id, tenantId, branchId });

  return { accessToken, refreshToken, tenant: tu.tenant, permissions };
};

export const refreshTokens = async (token: string) => {
  try {
    const payload = verifyRefreshToken(token) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new Error('INVALID_USER');
    }

    if (!user.isActive) {
      throw new Error('ACCOUNT_INACTIVE');
    }
    
    let permissions: string[] = [];
    let customRole = 'GUEST';
    
    if (payload.tenantId) {
       const tu = await prisma.tenantUser.findUnique({
         where: { tenantId_userId: { tenantId: payload.tenantId, userId: user.id } },
         include: { customRole: { include: { permissions: { include: { permission: true } } } } }
       });
       if (tu && tu.isOwner) {
         permissions.push('ALL');
         customRole = 'OWNER';
       } else if (tu && tu.customRole) {
         permissions = tu.customRole.permissions.map(p => p.permission.code);
         customRole = tu.customRole.name;
       }
    }

    const accessToken = generateAccessToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      customRole: payload.tenantId ? customRole : undefined,
      permissions: payload.tenantId ? permissions : undefined
    });
    const refreshToken = generateRefreshToken({ userId: user.id, tenantId: payload.tenantId, branchId: payload.branchId });

    return { accessToken, refreshToken };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    throw error;
  }
};

export const getMe = async (userId: string, tenantId?: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenantUsers: {
        include: {
          tenant: true,
          customRole: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const { passwordHash, tenantUsers, ...userWithoutPassword } = user;

  const tenants = tenantUsers.map(tu => ({
    id: tu.tenant.id,
    name: tu.tenant.name,
    domain: tu.tenant.domain,
    isOwner: tu.isOwner,
    role: tu.customRole?.name || 'N/A'
  }));

  // If tenantId is provided in JWT, we can return the current tenant details
  let currentTenant = null;
  if (tenantId) {
    currentTenant = tenants.find(t => t.id === tenantId) || null;
  }

  return { ...userWithoutPassword, tenants, currentTenant };
};
