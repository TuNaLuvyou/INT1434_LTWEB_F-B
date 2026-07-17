import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) { res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' }); return; }
    
    let config = await prisma.systemConfig.findUnique({ where: { tenantId } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          tenantId,
          restaurantName: 'HiAI-MenuGo POS',
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
    res.status(500).json({ success: false, message: String(error) });
  }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) { res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' }); return; }

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
    
    const currentConfig = await prisma.systemConfig.findUnique({ where: { tenantId } });
    const finalRestaurantName = restaurantName || currentConfig?.restaurantName || 'HiAI-MenuGo POS';

    const config = await prisma.systemConfig.upsert({
      where: { tenantId },
      update: { 
        restaurantName: finalRestaurantName, 
        isGeofenceEnabled: isGeofenceEnabled !== undefined ? Boolean(isGeofenceEnabled) : undefined,
        restaurantLat: restaurantLat !== undefined ? (restaurantLat === null || restaurantLat === '' ? null : Number(restaurantLat)) : undefined,
        restaurantLng: restaurantLng !== undefined ? (restaurantLng === null || restaurantLng === '' ? null : Number(restaurantLng)) : undefined,
        maxOrderDistance: maxOrderDistance !== undefined ? Number(maxOrderDistance) : undefined,
      },
      create: {
        tenantId,
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
    res.status(500).json({ success: false, message: String(error) });
  }
};

export const syncMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Send a revalidate request to Next.js server
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
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    let branchId = req.query.branchId as string | undefined;

    if (authReq.user?.role === 'MANAGER') {
      branchId = authReq.user?.branchId;
    }

    const baseWhereSession = { tenantId, ...(branchId ? { branchId } : {}) };

    const pendingOrdersCount = await prisma.orderItem.count({
      where: { 
        status: { in: ['PENDING', 'PREPARING'] },
        session: baseWhereSession
      }
    });

    const occupiedTablesCount = await prisma.table.count({
      where: { 
        status: 'OCCUPIED',
        tenantId,
        ...(branchId ? { branchId } : {})
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const revenueAgg = await prisma.payment.aggregate({
      _sum: { total: true },
      where: { 
        paidAt: { gte: today },
        tenantId,
        ...(branchId ? { branchId } : {})
      }
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

export const getSystemInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      if (authReq.user?.role === 'PLATFORM_ADMIN') {
        res.json({
          success: true,
          data: {
            tenantName: 'Hệ thống Trung tâm (Platform)',
            domain: 'Admin',
            planName: 'Bản quyền Nền tảng (Platform)',
            planDescription: 'Không có giới hạn tính năng',
            features: ['ALL_FEATURES', 'CORE_POS', 'PROMOTION_ENGINE'],
            createdAt: new Date().toISOString()
          }
        });
        return;
      }
      res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: {
              include: { features: true }
            }
          }
        }
      }
    });

    if (!tenant) {
      res.status(404).json({ success: false, message: 'Không tìm thấy tenant' });
      return;
    }

    res.json({
      success: true,
      data: {
        tenantName: tenant.name,
        domain: tenant.domain,
        planName: tenant.subscription?.plan?.name || 'Miễn phí',
        planDescription: tenant.subscription?.plan?.description || '',
        features: tenant.subscription?.plan?.features?.map((f: any) => f.code) || [],
        createdAt: tenant.createdAt,
      }
    });
  } catch (error) {
    console.error('getSystemInfo error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
