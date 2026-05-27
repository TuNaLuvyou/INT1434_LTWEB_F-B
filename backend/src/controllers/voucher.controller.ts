import { Request, Response } from 'express';
import * as voucherService from '../services/voucher.service';
import { AppError } from '../utils/app-error';

export async function getAllVouchersHandler(req: Request, res: Response): Promise<void> {
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
