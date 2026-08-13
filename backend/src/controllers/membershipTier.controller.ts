import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * GET /api/membership-tiers
 * Lấy danh sách các Hạng thành viên của Tenant
 */
export async function getMembershipTiers(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin Tenant.' });
      return;
    }

    const tiers = await prisma.membershipTier.findMany({
      where: { tenantId },
      orderBy: { minPoints: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: tiers,
    });
  } catch (error) {
    console.error('[getMembershipTiers] Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách hạng thành viên.' });
  }
}

/**
 * POST /api/membership-tiers
 * Tạo hạng thành viên mới
 */
export async function createMembershipTier(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin Tenant.' });
      return;
    }

    const { name, minPoints, discountPercent, color } = req.body as {
      name: string;
      minPoints: number;
      discountPercent: number;
      color?: string;
    };

    if (!name || typeof name !== 'string' || minPoints === undefined || discountPercent === undefined) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin tên hạng, điểm tối thiểu và % giảm giá.' });
      return;
    }

    const tier = await prisma.membershipTier.create({
      data: {
        tenantId,
        name,
        minPoints: Number(minPoints),
        discountPercent: Number(discountPercent),
        color: color || null,
      },
    });

    res.status(201).json({
      success: true,
      data: tier,
      message: 'Tạo hạng thành viên thành công.',
    });
  } catch (error: any) {
    console.error('[createMembershipTier] Error:', error);
    if (error?.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Tên hạng thành viên này đã tồn tại trong cửa hàng.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo hạng thành viên.' });
  }
}

/**
 * PUT /api/membership-tiers/:id
 * Cập nhật thông tin hạng thành viên
 */
export async function updateMembershipTier(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId;
    const tierId = String(req.params.id);
    const { name, minPoints, discountPercent, color } = req.body as {
      name?: string;
      minPoints?: number;
      discountPercent?: number;
      color?: string;
    };

    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin Tenant.' });
      return;
    }

    const existingTier = await prisma.membershipTier.findFirst({
      where: { id: tierId, tenantId },
    });

    if (!existingTier) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hạng thành viên.' });
      return;
    }

    const updatedTier = await prisma.membershipTier.update({
      where: { id: tierId },
      data: {
        ...(name ? { name } : {}),
        ...(minPoints !== undefined ? { minPoints: Number(minPoints) } : {}),
        ...(discountPercent !== undefined ? { discountPercent: Number(discountPercent) } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });

    res.status(200).json({
      success: true,
      data: updatedTier,
      message: 'Cập nhật hạng thành viên thành công.',
    });
  } catch (error) {
    console.error('[updateMembershipTier] Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật hạng thành viên.' });
  }
}

/**
 * DELETE /api/membership-tiers/:id
 * Xóa hạng thành viên
 */
export async function deleteMembershipTier(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = (req as any).user?.tenantId;
    const tierId = String(req.params.id);

    if (!tenantId) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin Tenant.' });
      return;
    }

    const existingTier = await prisma.membershipTier.findFirst({
      where: { id: tierId, tenantId },
    });

    if (!existingTier) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hạng thành viên.' });
      return;
    }

    await prisma.membershipTier.delete({
      where: { id: tierId },
    });

    res.status(200).json({
      success: true,
      message: 'Xóa hạng thành viên thành công.',
    });
  } catch (error) {
    console.error('[deleteMembershipTier] Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa hạng thành viên.' });
  }
}
