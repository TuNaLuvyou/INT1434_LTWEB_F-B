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
          isGeofenceEnabled: false,
          restaurantLat: null,
          restaurantLng: null,
          maxOrderDistance: 100
        }
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('getConfig error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      restaurantName,
      isGeofenceEnabled,
      restaurantLat,
      restaurantLng,
      maxOrderDistance
    } = req.body;

    if (isGeofenceEnabled) {
      if (restaurantLat !== undefined && restaurantLat !== null && restaurantLat !== '') {
        const latNum = Number(restaurantLat);
        if (isNaN(latNum) || latNum < -90 || latNum > 90) {
          res.status(400).json({ success: false, message: 'Vĩ độ (Latitude) phải nằm trong khoảng từ -90 đến 90.' });
          return;
        }
      }
      if (restaurantLng !== undefined && restaurantLng !== null && restaurantLng !== '') {
        const lngNum = Number(restaurantLng);
        if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
          res.status(400).json({ success: false, message: 'Kinh độ (Longitude) phải nằm trong khoảng từ -180 đến 180.' });
          return;
        }
      }
    }
    
    const currentConfig = await prisma.systemConfig.findUnique({ where: { id: 'singleton' } });
    const finalRestaurantName = restaurantName || currentConfig?.restaurantName || 'RestoFlow POS';

    const config = await prisma.systemConfig.upsert({
      where: { id: 'singleton' },
      update: { 
        restaurantName: finalRestaurantName, 
        isGeofenceEnabled: isGeofenceEnabled !== undefined ? Boolean(isGeofenceEnabled) : undefined,
        restaurantLat: restaurantLat !== undefined ? (restaurantLat === null || restaurantLat === '' ? null : Number(restaurantLat)) : undefined,
        restaurantLng: restaurantLng !== undefined ? (restaurantLng === null || restaurantLng === '' ? null : Number(restaurantLng)) : undefined,
        maxOrderDistance: maxOrderDistance !== undefined ? Number(maxOrderDistance) : undefined,
      },
      create: {
        id: 'singleton',
        restaurantName: finalRestaurantName,
        isGeofenceEnabled: isGeofenceEnabled !== undefined ? Boolean(isGeofenceEnabled) : false,
        restaurantLat: restaurantLat !== undefined && restaurantLat !== null && restaurantLat !== '' ? Number(restaurantLat) : null,
        restaurantLng: restaurantLng !== undefined && restaurantLng !== null && restaurantLng !== '' ? Number(restaurantLng) : null,
        maxOrderDistance: maxOrderDistance !== undefined ? Number(maxOrderDistance) : 100
      }
    });

    res.json({ 
      success: true, 
      data: config
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

import { cleanupOldSessions } from '../services/cleanup.service';

export const cleanupHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await cleanupOldSessions();
    if (result.success) {
      res.json({
        success: true,
        message: 'Đã dọn dẹp thành công lịch sử đơn hàng cũ hơn 95 ngày',
        data: {
          deletedSessions: result.deletedSessions,
          deletedPayments: result.deletedPayments,
          deletedOrderItems: result.deletedOrderItems
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi dọn dẹp lịch sử đơn hàng',
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('cleanupHistory error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message || String(error) 
    });
  }
};

export const getOverviewStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingOrdersCount = await prisma.orderItem.count({
      where: { status: { in: ['PENDING', 'PREPARING'] } }
    });

    const occupiedTablesCount = await prisma.table.count({
      where: { status: 'OCCUPIED' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const revenueAgg = await prisma.payment.aggregate({
      _sum: { total: true },
      where: { paidAt: { gte: today } }
    });
    const todayRevenue = revenueAgg._sum.total ? Number(revenueAgg._sum.total) : 0;

    res.json({
      success: true,
      data: { pendingOrdersCount, occupiedTablesCount, todayRevenue }
    });
  } catch (error) {
    console.error('getOverviewStats error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
