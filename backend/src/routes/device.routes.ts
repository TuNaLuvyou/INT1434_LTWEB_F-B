import { Router } from 'express';
import { getDevices, registerDevice, revokeDevice, getDeviceUsers } from '../controllers/device.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';
import * as authService from '../services/auth.service';

const router = Router();

router.use(authMiddleware);

// Routes accessible by ADMIN and MANAGER
router.get('/', requireRole(['ADMIN', 'MANAGER']), getDevices);
router.get('/users', requireRole(['ADMIN', 'MANAGER']), getDeviceUsers);
router.post('/register', requireRole(['ADMIN']), registerDevice);
router.delete('/:id', requireRole(['ADMIN']), revokeDevice);

// Strictly ADMIN only route for creating new accounts
router.post('/users', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' });
      return;
    }

    const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'KITCHEN', 'CASHIER'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
      return;
    }

    const result = await authService.registerUser({ email, password, name, role });
    res.status(201).json({ success: true, data: result.user });
  } catch (error: any) {
    if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
    } else {
      console.error('Admin create user error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ khi tạo tài khoản' });
    }
  }
});

// Strictly ADMIN only route for role management
router.put('/users/:id/role', requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    
    const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'KITCHEN', 'CASHIER'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { role: role as any }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

export default router;
