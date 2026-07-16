import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as paymentService from '../services/payment.service';
import { AppError } from '../utils/app-error';
import { PaymentMethod } from '@prisma/client';

/**
 * GET /api/payment/validate-voucher?code=ABC&subtotal=200000
 * Validate ma voucher va tra ve thong tin giam gia.
 */
export async function validateVoucherHandler(req: Request, res: Response): Promise<void> {
  try {
    const { code, subtotal } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, message: 'Thieu ma voucher.' });
      return;
    }

    const subtotalNum = parseFloat(subtotal as string);
    if (isNaN(subtotalNum) || subtotalNum < 0) {
      res.status(400).json({ success: false, message: 'subtotal khong hop le.' });
      return;
    }

    const result = await paymentService.validateVoucher(code, subtotalNum);

    res.status(200).json({
      success: true,
      message: `Ap dung voucher thanh cong: giam ${result.discountAmount.toLocaleString('vi-VN')} VND`,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    console.error('[validateVoucher] error:', error);
    res.status(500).json({ success: false, message: 'Loi server noi bo.' });
  }
}

/**
 * POST /api/payment/sessions/:sessionId/pay
 * Body: { method: 'CASH'|'TRANSFER', voucherId?: string, subtotal: number, discountAmount: number, total: number }
 * Xu ly thanh toan day du va dong TableSession.
 */
export async function processPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const cashierId = authReq.user?.userId;

    if (!cashierId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thieu sessionId.' });
      return;
    }

    const { method, voucherId, subtotal, discountAmount, total, keepOccupied } = req.body;

    // Validate method
    const validMethods: PaymentMethod[] = ['CASH', 'TRANSFER'];
    if (!method || !validMethods.includes(method)) {
      res.status(400).json({
        success: false,
        message: `Phuong thuc thanh toan khong hop le. Cho phep: ${validMethods.join(', ')}`,
      });
      return;
    }

    // Validate so tien
    if (typeof subtotal !== 'number' || subtotal < 0) {
      res.status(400).json({ success: false, message: 'subtotal khong hop le.' });
      return;
    }
    if (typeof discountAmount !== 'number' || discountAmount < 0) {
      res.status(400).json({ success: false, message: 'discountAmount khong hop le.' });
      return;
    }
    if (typeof total !== 'number' || total < 0) {
      res.status(400).json({ success: false, message: 'total khong hop le.' });
      return;
    }

    const result = await paymentService.processPayment({
      sessionId,
      cashierId,
      method: method as PaymentMethod,
      voucherId: voucherId || undefined,
      subtotal,
      discountAmount,
      total,
      keepOccupied: !!keepOccupied,
    });

    res.status(200).json({
      success: true,
      message: 'Thanh toan thanh cong!',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    res.status(500).json({ success: false, message: 'Loi server noi bo.' });
  }
}

/**
 * POST /api/payment/:paymentId/confirm
 * Cashier xac nhan thanh toan (chu yeu cho VietQR/Chuyen khoan thu cong)
 */
export async function confirmManualPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const cashierId = authReq.user?.userId;

    if (!cashierId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const paymentId = req.params.paymentId as string;
    if (!paymentId) {
      res.status(400).json({ success: false, message: 'Thieu paymentId.' });
      return;
    }

    const { keepOccupied } = req.body;

    const result = await paymentService.confirmManualPayment(paymentId, cashierId, !!keepOccupied);

    res.status(200).json({
      success: true,
      message: 'Xac nhan thanh toan thanh cong!',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    console.error('[confirmManualPayment] error:', error);
    res.status(500).json({ success: false, message: 'Loi server noi bo.' });
  }
}
