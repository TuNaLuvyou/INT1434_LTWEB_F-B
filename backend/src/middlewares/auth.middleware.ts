import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN';
  };
  file?: Express.Multer.File; // Multer file typings
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Mock hỗ trợ phát triển local nếu có header x-mock-role hoặc trong môi trường DEV khi chưa cấu hình JWT_SECRET
    const mockRole = req.headers['x-mock-role'] as string;
    if (mockRole) {
      req.user = {
        id: 'mock-user-id',
        email: 'mock@restoflow.com',
        role: mockRole as any,
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Tự động mock ADMIN trong DEV nếu không truyền token để tiện chạy thử giao diện CRUD
      if (process.env.NODE_ENV !== 'production' || !process.env.JWT_SECRET) {
        req.user = {
          id: 'mock-admin-id',
          email: 'admin@restoflow.com',
          role: 'ADMIN',
        };
        return next();
      }
      return res.status(401).json({ success: false, message: 'Unauthorized: Không tìm thấy token' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'restoflow_jwt_secret_key';
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };

    // Truy vấn database để xác thực và lấy role chuẩn
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Tài khoản không hoạt động hoặc không tồn tại' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as any,
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Token không hợp lệ hoặc đã hết hạn' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Bạn không có quyền truy cập chức năng này' });
    }

    next();
  };
};
