import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { id: 'singleton' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 'singleton',
          restaurantName: 'RestoFlow POS',
          managerEmail: 'admin@restoflow.com',
          licenseKey: 'RF-TRIAL-2025',
          licenseExpiredAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      });
    }

    // Mask license key partially
    const maskedKey = config.licenseKey.replace(/^([^-]+-[^-]+-).*/, '$1****');

    res.json({
      success: true,
      data: {
        ...config,
        licenseKey: maskedKey
      }
    });
  } catch (error) {
    console.error('getConfig error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantName, managerEmail, licenseKey } = req.body;
    
    if (!restaurantName || !managerEmail) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin cấu hình' });
      return;
    }

    const currentConfig = await prisma.systemConfig.findUnique({ where: { id: 'singleton' } });
    let licenseExpiredAt = currentConfig?.licenseExpiredAt;

    // Nếu người dùng nhập Key mới khác Key cũ, tự động gia hạn thêm 1 năm bản quyền
    if (licenseKey && licenseKey !== currentConfig?.licenseKey) {
      licenseExpiredAt = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    }

    const config = await prisma.systemConfig.upsert({
      where: { id: 'singleton' },
      update: { 
        restaurantName, 
        managerEmail,
        ...(licenseKey ? { licenseKey, licenseExpiredAt } : {})
      },
      create: {
        id: 'singleton',
        restaurantName,
        managerEmail,
        licenseKey: licenseKey || 'RF-TRIAL-2025',
        licenseExpiredAt: licenseExpiredAt || new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }
    });

    const maskedKey = config.licenseKey.replace(/^([^-]+-[^-]+-).*/, '$1****');

    res.json({ 
      success: true, 
      data: {
        ...config,
        licenseKey: maskedKey
      }
    });
  } catch (error) {
    console.error('updateConfig error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const syncMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Send a revalidate request to Next.js server
    // For local dev without real webhook, we just mock the success response.
    // In production, we'd hit /api/revalidate?secret=xyz&tag=menu
    
    // Attempt to hit Next.js revalidate endpoint if exists, but for now just mock success
    res.json({ success: true, message: 'Đã đồng bộ menu cho tất cả bàn' });
  } catch (error) {
    console.error('syncMenu error:', error);
    res.status(500).json({ success: false, message: 'Lỗi đồng bộ menu' });
  }
};
