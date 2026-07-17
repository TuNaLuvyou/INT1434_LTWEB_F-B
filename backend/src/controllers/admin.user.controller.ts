import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';
import bcrypt from 'bcrypt';
import { checkUsageLimit } from '../services/usage-limit.service';

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const users = await prisma.user.findMany({
      where: {
        tenantUsers: {
          some: {
            tenantId: authReq.user.tenantId
          }
        }
      },
      include: {
        tenantUsers: {
          where: { tenantId: authReq.user.tenantId },
          include: { branch: { select: { id: true, name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const mapped = users.map(u => {
      const tu = u.tenantUsers[0];
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        branchId: tu?.branchId || null,
        branchName: tu?.branch?.name || null,
      };
    });
    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, branchId } = req.body;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) { res.status(403).json({ success: false, message: 'Forbidden' }); return; }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Email đã tồn tại' });
      return;
    }

    await checkUsageLimit(tenantId, 'USER');

    // Lấy domain của admin để gán cho user mới
    const adminUser = await prisma.user.findUnique({
      where: { id: authReq.user.userId },
      select: { domain: true }
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, domain: adminUser?.domain || null },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    });

    // Gán user vào tenant
    await prisma.tenantUser.create({
      data: { tenantId, userId: user.id, branchId }
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, role, isActive } = req.body;
    
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (req.user?.userId === id) {
      res.status(403).json({ success: false, message: 'Không thể tự sửa quyền của chính mình' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, tenantUsers: { some: { tenantId: authReq.user.tenantId } } }
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    // Check if disabling the last active admin
    if (isActive === false) {
      if (targetUser.role === 'ADMIN') {
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

    // Cập nhật branchId trong TenantUser nếu có
    const { branchId } = req.body;
    if (branchId !== undefined) {
      const existing = await prisma.tenantUser.findFirst({
        where: { userId: id, tenantId: authReq.user.tenantId },
      });
      if (existing) {
        await prisma.tenantUser.update({
          where: { id: existing.id },
          data: { branchId: branchId || null },
        });
      } else {
        await prisma.tenantUser.create({
          data: { userId: id, tenantId: authReq.user.tenantId, branchId: branchId || null },
        });
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body;
    
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (!newPassword || newPassword.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 ký tự' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, tenantUsers: { some: { tenantId: authReq.user.tenantId } } }
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
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

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    if (req.user?.userId === id) {
      res.status(403).json({ success: false, message: 'Không thể tự xóa chính mình' });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const targetUser = await prisma.user.findFirst({
      where: { id, tenantUsers: { some: { tenantId: authReq.user.tenantId } } }
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    if (targetUser.role === 'ADMIN') {
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
