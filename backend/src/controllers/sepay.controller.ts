import { Request, Response } from 'express';
import prisma from '../config/prisma';
import * as paymentService from '../services/payment.service';
import { emitPaymentCompleted } from '../socket/emit.helpers';
import { logger } from '../utils/logger';

/**
 * Interface cho payload webhook của SePay
 * Document từ SePay: https://sepay.vn/docs/webhook
 */
interface SepayWebhookPayload {
  id?: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;
  content?: string;
  transferType?: 'in' | 'out';
  transferAmount?: number;
  accumulated?: number;
  subAccount?: string | null;
  referenceCode?: string;
  description?: string;
}

export async function handleSepayWebhook(req: Request, res: Response): Promise<void> {
  try {
    // 1. Kiểm tra Token bảo mật (nếu có cấu hình trong process.env.SEPAY_WEBHOOK_TOKEN)
    const secretToken = process.env.SEPAY_WEBHOOK_TOKEN;
    if (secretToken) {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      
      const isTokenValid = 
        (authHeader && (authHeader === `Bearer ${secretToken}` || authHeader === secretToken)) || 
        (queryToken && queryToken === secretToken);

      if (!isTokenValid) {
        res.status(401).json({ success: false, message: 'Unauthorized: Invalid SePay token' });
        return;
      }
    }

    const payload: SepayWebhookPayload = req.body;

    // Chỉ xử lý tiền vào (transferType === 'in') và có số tiền lớn hơn 0
    if (payload.transferType && payload.transferType !== 'in') {
      res.status(200).json({ success: true, message: 'Ignored non-incoming transaction' });
      return;
    }

    const content = payload.content || payload.description || '';
    const transferAmount = Number(payload.transferAmount || 0);

    if (!content || transferAmount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid transaction content or amount' });
      return;
    }

    // 2. Tìm mã paymentCode (định dạng CKBAN...TT...) trong nội dung chuyển khoản
    const codeMatch = content.match(/(CKBAN\d+TT\d+)/i);
    let matchedPayment = null;

    if (codeMatch && codeMatch[1]) {
      const paymentCode = codeMatch[1].toUpperCase();
      matchedPayment = await prisma.payment.findFirst({
        where: { paymentCode, status: 'PENDING' },
        include: { session: true },
      });
    }

    // Nếu không khớp regex hoặc không tìm thấy bằng codeMatch, thử tìm thủ công trong các PENDING Payments
    if (!matchedPayment) {
      const pendingPayments = await prisma.payment.findMany({
        where: { status: 'PENDING', provider: 'VIETQR' },
        include: { session: true },
      });

      matchedPayment = pendingPayments.find((p: any) => p.paymentCode && content.toUpperCase().includes(p.paymentCode.toUpperCase())) || null;
    }

    if (!matchedPayment) {
      res.status(200).json({ success: true, message: 'No matching PENDING payment found for this transaction content' });
      return;
    }

    if (matchedPayment.status === 'SUCCESS') {
      res.status(200).json({ success: true, message: 'Payment already confirmed' });
      return;
    }

    // 3. Kiểm tra số tiền chuyển có đủ không
    if (transferAmount < Number(matchedPayment.total)) {
      logger.warn('SePay', `Transfer amount (${transferAmount}) is less than order total (${matchedPayment.total}) for code ${matchedPayment.paymentCode}`);
      res.status(400).json({ success: false, message: 'Transfer amount is less than payment total' });
      return;
    }

    // 4. Tiến hành xác nhận thanh toán tự động
    await paymentService.confirmManualPayment(matchedPayment.id, 'SYSTEM_SEPAY', false);

    // 5. Phát Socket.IO thông báo cho cả POS Cashier và màn hình khách tại bàn
    const session = matchedPayment.session;
    if (session && session.tableId) {
      const table = await prisma.table.findUnique({ where: { id: session.tableId } });
      if (table) {
        emitPaymentCompleted(
          table.tenantId,
          table.branchId,
          table.id,
          {
            paymentId: matchedPayment.id,
            sessionId: session.id,
            tableId: table.id,
            total: Number(matchedPayment.total),
            paidAt: new Date().toISOString(),
          }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmed automatically via SePay webhook!',
      data: {
        paymentId: matchedPayment.id,
        paymentCode: matchedPayment.paymentCode,
        total: Number(matchedPayment.total),
      },
    });

  } catch (error: any) {
    console.error('[SePay Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
