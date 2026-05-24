import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export const requireDeviceToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers['x-device-token'] as string;
    
    if (!token) {
      res.status(401).json({ success: false, code: 'NO_DEVICE_TOKEN', message: 'Thiết bị chưa đăng ký' });
      return;
    }

    const device = await prisma.trustedDevice.findUnique({
      where: { token }
    });

    if (!device) {
      res.status(401).json({ success: false, code: 'INVALID_DEVICE', message: 'Thiết bị không hợp lệ' });
      return;
    }

    // Update lastUsed
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastUsed: new Date() }
    });

    // Extend request
    req.device = {
      id: device.id,
      label: device.label,
      userId: device.userId
    };

    next();
  } catch (error) {
    console.error('requireDeviceToken error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xác thực thiết bị' });
  }
};
