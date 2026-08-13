import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * POST /api/customer/lookup-or-create
 * Tra cứu hoặc tạo mới thông tin khách hàng dựa trên SĐT và tenantId/sessionId/tableId.
 */
export async function lookupOrCreateCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { phone: rawPhone, tenantId: bodyTenantId, sessionId, tableId } = req.body as {
      phone?: string;
      tenantId?: string;
      sessionId?: string;
      tableId?: string;
    };

    if (!rawPhone || typeof rawPhone !== 'string') {
      res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
      return;
    }

    const phone = rawPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (phone.length < 9 || phone.length > 12) {
      res.status(400).json({ success: false, message: 'Số điện thoại phải từ 9 đến 12 chữ số.' });
      return;
    }

    let tenantId = bodyTenantId;

    if (!tenantId && sessionId) {
      const session = await prisma.tableSession.findUnique({
        where: { id: sessionId },
        select: { tenantId: true },
      });
      if (session) tenantId = session.tenantId;
    }

    if (!tenantId && tableId) {
      const table = await prisma.table.findUnique({
        where: { id: tableId },
        select: { tenantId: true },
      });
      if (table) tenantId = table.tenantId;
    }

    if (!tenantId) {
      // Không fallback sang tenant đầu tiên — tránh tạo/tra cứu khách hàng nhầm cửa hàng khác (rò rỉ dữ liệu cross-tenant).
      res.status(400).json({ success: false, message: 'Không xác định được nhà hàng (tenantId).' });
      return;
    }

    // Lookup customer or create new
    let customer = await prisma.customer.findUnique({
      where: {
        tenantId_phone: { tenantId, phone },
      },
      include: {
        membershipTier: true,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId,
          phone,
          points: 0,
          accumulatedPoints: 0,
        },
        include: {
          membershipTier: true,
        },
      });
    }

    // Check tier upgrade based on accumulatedPoints
    const tiers = await prisma.membershipTier.findMany({
      where: { tenantId },
      orderBy: { minPoints: 'desc' },
    });

    if (tiers.length > 0) {
      const eligibleTier = tiers.find((t) => customer!.accumulatedPoints >= t.minPoints);
      if (eligibleTier && eligibleTier.id !== customer.membershipTierId) {
        // Upgrade / update tier
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { membershipTierId: eligibleTier.id },
          include: { membershipTier: true },
        });
      }
    }

    // Fetch system config for point rates
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { tenantId },
    });

    const pointEarnRate = systemConfig?.pointEarnRate ?? 10000;
    const pointRedeemRate = systemConfig?.pointRedeemRate ?? 100;
    const redeemValue = customer.points * pointRedeemRate;

    res.status(200).json({
      success: true,
      data: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        points: customer.points,
        accumulatedPoints: customer.accumulatedPoints,
        membershipTier: customer.membershipTier
          ? {
              id: customer.membershipTier.id,
              name: customer.membershipTier.name,
              discountPercent: customer.membershipTier.discountPercent,
              color: customer.membershipTier.color,
            }
          : null,
        redeemValue,
        pointEarnRate,
        pointRedeemRate,
      },
    });
  } catch (error) {
    console.error('[lookupOrCreateCustomer] Error:', error);
    res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra khi xử lý thông tin khách hàng.' });
  }
}

/**
 * GET /api/customer/list
 * Admin lấy danh sách khách hàng / thành viên tích điểm
 */
export async function getCustomers(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu tenantId' });
      return;
    }

    const { search } = req.query;
    let whereClause: any = { tenantId };

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClause.OR = [
        { phone: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        membershipTier: true,
        _count: { select: { payments: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('[getCustomers] Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách khách hàng.' });
  }
}

/**
 * PUT /api/customer/:id
 * Admin cập nhật thông tin / điểm của khách hàng
 */
export async function updateCustomerAdmin(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId as string;
    const id = req.params.id as string;
    const { name, points, deltaPoints, note } = req.body;

    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu tenantId' });
      return;
    }

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId }
    });

    if (!customer) {
      res.status(404).json({ success: false, message: 'Khách hàng không tồn tại.' });
      return;
    }

    let updatedPoints = customer.points;
    let newAccumulatedPoints = customer.accumulatedPoints;

    if (typeof points === 'number') {
      const diff = points - customer.points;
      updatedPoints = points;
      if (diff > 0) newAccumulatedPoints += diff;
    } else if (typeof deltaPoints === 'number') {
      updatedPoints += deltaPoints;
      if (deltaPoints > 0) newAccumulatedPoints += deltaPoints;
    }

    if (updatedPoints < 0) updatedPoints = 0;

    // Recheck tier eligibility based on accumulatedPoints
    const tiers = await prisma.membershipTier.findMany({
      where: { tenantId },
      orderBy: { minPoints: 'desc' },
    });

    let newTierId = customer.membershipTierId;
    if (tiers.length > 0) {
      const eligibleTier = tiers.find((t) => newAccumulatedPoints >= t.minPoints);
      newTierId = eligibleTier ? eligibleTier.id : null;
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== undefined ? name : customer.name,
        points: updatedPoints,
        accumulatedPoints: newAccumulatedPoints,
        membershipTierId: newTierId
      },
      include: {
        membershipTier: true
      }
    });

    // Log adjustment if points changed
    if (updatedPoints !== customer.points) {
      await prisma.customerPointLog.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: 'ADJUST',
          points: updatedPoints - customer.points,
          note: note || 'Admin điều chỉnh điểm thủ công'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCustomer,
      message: 'Cập nhật thông tin khách hàng thành công.'
    });
  } catch (error) {
    console.error('[updateCustomerAdmin] Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật thông tin khách hàng.' });
  }
}

