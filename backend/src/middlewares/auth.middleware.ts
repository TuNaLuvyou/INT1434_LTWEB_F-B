import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục' });
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = payload as any;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục (Token expired)' });
    } else {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục' });
    }
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`[RBAC] Forbidden: ${req.user.role} trying to access ${req.method} ${req.originalUrl}`);
      res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' });
      return;
    }

    next();
  };
};
