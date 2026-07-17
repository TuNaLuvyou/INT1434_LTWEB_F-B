import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { Role } from '@prisma/client';
import { ApiResponse } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
    // Prepared for SaaS phase
    tenantId?: string;
    branchId?: string;
    customRole?: string;
    permissions?: string[];
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục', 401);
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = payload as any;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      ApiResponse.error(res, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn', 401);
    } else {
      ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục', 401);
    }
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục', 401);
      return;
    }

    if (req.user.role === 'PLATFORM_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`[RBAC] Forbidden: ${req.user.role} trying to access ${req.method} ${req.originalUrl}`);
      ApiResponse.error(res, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', 403);
      return;
    }

    next();
  };
};

export const requirePermission = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.permissions) {
      ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng chọn chi nhánh/cửa hàng trước', 401);
      return;
    }

    if (req.user.permissions.includes('ALL')) {
      return next();
    }

    const hasPermission = requiredPermissions.every(p => req.user!.permissions!.includes(p));
    
    if (!hasPermission) {
      console.warn(`[RBAC] Forbidden: Missing permissions. Req: ${requiredPermissions}, User: ${req.user.permissions}`);
      ApiResponse.error(res, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', 403);
      return;
    }

    next();
  };
};

export const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.tenantId) {
    ApiResponse.error(res, 'FORBIDDEN', 'Yêu cầu Tenant Context. Vui lòng chọn cửa hàng trước.', 403);
    return;
  }
  
  // Guard ngăn chặn truy cập chéo tenant, thông thường tenantId được set trong req.user từ JWT 
  // do người dùng lấy được từ selectTenant (nếu verify ok).
  // Mọi query DB sau middleware này sẽ dùng req.user.tenantId để query, tự động ngăn user A truy cập tenant B.

  next();
};
