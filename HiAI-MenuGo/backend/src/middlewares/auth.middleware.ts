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

    if (!roles.includes(req.user.role)) {
      console.warn(`[RBAC] Forbidden: ${req.user.role} trying to access ${req.method} ${req.originalUrl}`);
      ApiResponse.error(res, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', 403);
      return;
    }

    next();
  };
};
