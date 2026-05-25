import { Router } from 'express';
import { getDevices, registerDevice, revokeDevice, getDeviceUsers } from '../controllers/device.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';

const router = Router();

router.use(authMiddleware);

// Routes accessible by ADMIN and MANAGER
router.get('/', requireRole(['ADMIN', 'MANAGER']), getDevices);
router.get('/users', requireRole(['ADMIN', 'MANAGER']), getDeviceUsers);
router.post('/register', requireRole(['ADMIN', 'MANAGER']), registerDevice);
router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), revokeDevice);

// Strictly ADMIN only route for role management
router.put('/users/:id/role', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'KITCHEN', 'CASHIER'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as any }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

export default router;
