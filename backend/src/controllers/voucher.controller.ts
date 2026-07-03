import { Request, Response } from 'express';
import * as voucherService from '../services/voucher.service';
import { AppError } from '../utils/app-error';

export async function getAllVouchersHandler(_req: Request, res: Response): Promise<void> {
  try {
    const vouchers = await voucherService.getAllVouchers();
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

    const voucher = await voucherService.createVoucher({
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

    await voucherService.deleteVoucher(id);
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

    const valueNum = parseFloat(discountValue);
    if (discountType === 'PERCENT' && valueNum > 100) {
      res.status(400).json({ success: false, message: 'Phần trăm giảm giá tối đa là 100%.' });
      return;
    }

    const updated = await import('../config/prisma').then(m => m.default).then(prisma => prisma.voucher.update({
      where: { id },
      data: {
        code: code?.toUpperCase(),
        discountType,
        discountValue: valueNum,
        maxUsage: maxUsage !== undefined ? maxUsage : undefined,
        expiredAt: expiredAt !== undefined ? (expiredAt ? new Date(expiredAt) : null) : undefined,
      }
    }));
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

    const prisma = await import('../config/prisma').then(m => m.default);
    const voucher = await prisma.voucher.findUnique({
      where: { code: code.toUpperCase() }
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
