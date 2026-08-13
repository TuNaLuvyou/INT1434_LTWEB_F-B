import { Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentInput, PaymentCreationResult, PaymentProvider } from '../payment-provider.interface';
import { getOrCreateShift, settleCustomerPoints } from '../../payment.service';
import { AppError } from '../../../utils/app-error';
import { buildVietQrUrl } from '../../../utils/vietqr';

export class VietQrProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput, tx: Prisma.TransactionClient): Promise<PaymentCreationResult> {
    const shiftId = await getOrCreateShift(input.cashierId, input.tenantId, input.branchId);
    
    // Fetch bank account
    const bankAccount = await tx.tenantBankAccount.findFirst({
      where: { 
        tenantId: input.tenantId,
        isActive: true,
        OR: [
          { branchId: input.branchId },
          { branchId: null }
        ]
      },
      orderBy: { isDefault: 'desc' }
    });

    if (!bankAccount) {
      throw new AppError(400, 'NO_BANK_ACCOUNT', 'Cửa hàng chưa thiết lập tài khoản ngân hàng để nhận chuyển khoản.');
    }

    const sessionInfo = await tx.tableSession.findUnique({
      where: { id: input.sessionId },
      select: { table: { select: { tableNumber: true } } }
    });

    const tableNum = sessionInfo?.table?.tableNumber ?? 1;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayPaymentCount = await tx.payment.count({
      where: {
        tenantId: input.tenantId,
        paidAt: { gte: startOfDay },
      },
    });

    let orderSeq = todayPaymentCount + 1;
    let paymentCode = `CKBAN${tableNum}TT${orderSeq}`;

    let exists = await tx.payment.findFirst({ where: { paymentCode } });
    while (exists) {
      orderSeq += 1;
      paymentCode = `CKBAN${tableNum}TT${orderSeq}`;
      exists = await tx.payment.findFirst({ where: { paymentCode } });
    }

    const payment = await tx.payment.create({
      data: {
        sessionId: input.sessionId,
        shiftId,
        subtotal: input.subtotal,
        discountAmount: input.discountAmount,
        total: input.total,
        method: PaymentMethod.TRANSFER,
        status: PaymentStatus.PENDING,
        provider: 'VIETQR',
        paymentCode,
        tenantId: input.tenantId,
        branchId: input.branchId,
        ...(input.voucherId ? { voucherId: input.voucherId } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
        pointsEarned: input.pointsEarned ?? 0,
        pointsRedeemed: input.pointsRedeemed ?? 0,
        pointsDiscountAmount: input.pointsDiscountAmount ?? 0,
      },
    });

    // Generate VietQR URL
    const qrUrl = buildVietQrUrl({
      bankId: bankAccount.bankId,
      accountNumber: bankAccount.accountNumber,
      accountName: bankAccount.accountName,
      amount: payment.total,
      addInfo: paymentCode,
    });

    return { 
      payment, 
      providerData: { 
        qrUrl,
        paymentCode,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName
      } 
    };
  }

  async confirmPayment(paymentId: string, tx: Prisma.TransactionClient): Promise<Payment> {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    
    if (payment.status === PaymentStatus.SUCCESS) {
      throw new AppError(400, 'PAYMENT_ALREADY_CONFIRMED', 'Thanh toán này đã được xác nhận trước đó.');
    }

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCESS, paidAt: new Date() }
    });

    if (updated.customerId && (updated.pointsEarned > 0 || updated.pointsRedeemed > 0)) {
      await settleCustomerPoints(updated, tx);
    }

    return updated;
  }
}

