import { Request, Response } from 'express';
import prisma from '../config/prisma';
import bcrypt from 'bcrypt';
import { checkUsageLimit } from '../services/usage-limit.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Email đã tồn tại' });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.tenantId) {
      await checkUsageLimit(authReq.user.tenantId, 'USER');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    });
    
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, role, isActive } = req.body;
    
    if (req.user?.userId === id) {
      res.status(403).json({ success: false, message: 'Không thể tự sửa quyền của chính mình' });
      return;
    }

    // Check if disabling the last active admin
    if (isActive === false) {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (targetUser?.role === 'ADMIN') {
        const activeAdmins = await prisma.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: id } }
        });
        if (activeAdmins === 0) {
          res.status(400).json({ success: false, message: 'Không thể vô hiệu hóa ADMIN duy nhất' });
          return;
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { name, role, isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 ký tự' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    res.json({ success: true, message: 'Đã đặt lại mật khẩu' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    if (req.user?.userId === id) {
      res.status(403).json({ success: false, message: 'Không thể tự xóa chính mình' });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } }
      });
      if (activeAdmins === 0) {
        res.status(400).json({ success: false, message: 'Không thể vô hiệu hóa ADMIN duy nhất' });
        return;
      }
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
