import { Request, Response } from 'express';
import prisma from '../config/prisma';
import * as voucherService from '../services/voucher.service';
import { AppError } from '../utils/app-error';

export async function getAllVouchersHandler(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const vouchers = await voucherService.getAllVouchers(tenantId);
    res.status(200).json({ success: true, data: vouchers });
  } catch (error: any) {
    console.error('[getAllVouchersHandler] error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách voucher.' });
  }
}

export async function createVoucherHandler(req: Request, res: Response): Promise<void> {
  try {
    const { code, discountType, discountValue, maxUsage, expiredAt } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, message: 'Mã voucher không hợp lệ.' });
      return;
    }

    if (discountType !== 'PERCENT' && discountType !== 'FIXED') {
      res.status(400).json({ success: false, message: 'Loại giảm giá phải là PERCENT hoặc FIXED.' });
      return;
    }

    const valueNum = parseFloat(discountValue);
    if (isNaN(valueNum) || valueNum <= 0) {
      res.status(400).json({ success: false, message: 'Giá trị giảm giá không hợp lệ.' });
      return;
    }

    if (discountType === 'PERCENT' && valueNum > 100) {
      res.status(400).json({ success: false, message: 'Phần trăm giảm giá tối đa là 100%.' });
      return;
    }

    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const voucher = await voucherService.createVoucher({
      tenantId,
      code,
      discountType,
      discountValue: valueNum,
      maxUsage: maxUsage ? parseInt(maxUsage) : undefined,
      expiredAt: expiredAt ? new Date(expiredAt) : undefined,
    });

    res.status(201).json({ success: true, message: 'Tạo voucher thành công!', data: voucher });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
      return;
    }
    console.error('[createVoucherHandler] error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo voucher.' });
  }
}

export async function deleteVoucherHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ success: false, message: 'Thiếu ID voucher.' });
      return;
    }

    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    await voucherService.deleteVoucher(id, tenantId);
    res.status(200).json({ success: true, message: 'Xóa/Vô hiệu hóa voucher thành công!' });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
      return;
    }
    console.error('[deleteVoucherHandler] error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa voucher.' });
  }
}

export async function updateVoucherHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { code, discountType, discountValue, maxUsage, expiredAt } = req.body;
    
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const valueNum = parseFloat(discountValue);
    if (isNaN(valueNum) || valueNum <= 0) {
      res.status(400).json({ success: false, message: 'Giá trị giảm giá không hợp lệ.' });
      return;
    }

    if (discountType === 'PERCENT' && valueNum > 100) {
      res.status(400).json({ success: false, message: 'Phần trăm giảm giá tối đa là 100%.' });
      return;
    }

    const existing = await prisma.voucher.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Voucher không tồn tại');
    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        code: code?.toUpperCase(),
        discountType,
        discountValue: valueNum,
        maxUsage: maxUsage !== undefined ? maxUsage : undefined,
        expiredAt: expiredAt !== undefined ? (expiredAt ? new Date(expiredAt) : null) : undefined,
      }
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('updateVoucherHandler error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật voucher.' });
  }
}

export async function validateVoucherHandler(req: Request, res: Response): Promise<void> {
  try {
    const { code, orderTotal } = req.body;
    if (!code || orderTotal === undefined) {
      res.status(400).json({ valid: false, reason: 'Thiếu mã voucher hoặc tổng đơn hàng' });
      return;
    }

    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    // validation can be called by public users if they have a session, but usually tenantId is needed
    // Assuming checkout provides tenantId in the body or token
    const tId = req.body.tenantId || tenantId;
    if (!tId) {
      res.status(400).json({ valid: false, reason: 'Thiếu tenantId' });
      return;
    }
    const voucher = await prisma.voucher.findUnique({
      where: { tenantId_code: { tenantId: tId, code: code.toUpperCase() } }
    });

    if (!voucher) {
      res.status(400).json({ valid: false, reason: 'Mã voucher không tồn tại' });
      return;
    }

    if (!voucher.isActive) {
      res.status(400).json({ valid: false, reason: 'Mã voucher đã bị vô hiệu hóa' });
      return;
    }

    if (voucher.expiredAt && new Date() > voucher.expiredAt) {
      res.status(400).json({ valid: false, reason: 'Mã voucher đã hết hạn' });
      return;
    }

    if (voucher.maxUsage !== null && voucher.usedCount >= voucher.maxUsage) {
      res.status(400).json({ valid: false, reason: 'Mã voucher đã hết lượt sử dụng' });
      return;
    }

    let discountAmount = 0;
    const total = parseFloat(orderTotal);
    if (voucher.discountType === 'PERCENT') {
      discountAmount = (total * parseFloat(voucher.discountValue.toString())) / 100;
    } else {
      discountAmount = parseFloat(voucher.discountValue.toString());
      discountAmount = Math.min(discountAmount, total);
    }

    res.json({
      valid: true,
      discountAmount,
      finalTotal: Math.max(0, total - discountAmount)
    });
  } catch (error) {
    console.error('validateVoucherHandler error:', error);
    res.status(500).json({ valid: false, reason: 'Lỗi server khi kiểm tra mã voucher' });
  }
}
