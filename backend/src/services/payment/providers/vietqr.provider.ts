import { Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentInput, PaymentCreationResult, PaymentProvider } from '../payment-provider.interface';
import { getOrCreateShift } from '../../payment.service';
import { AppError } from '../../../utils/app-error';

export class VietQrProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput, tx: Prisma.TransactionClient): Promise<PaymentCreationResult> {
    const shiftId = await getOrCreateShift(input.cashierId);
    
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

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    const paymentCode = `CK${timestamp}${random}`; // e.g. CK1234567890

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
      },
    });

    // Generate VietQR URL
    // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<DESCRIPTION>&accountName=<ACCOUNT_NAME>
    const amount = payment.total.toString();
    const addInfo = encodeURIComponent(paymentCode);
    const accountName = encodeURIComponent(bankAccount.accountName);
    
    const qrUrl = `https://img.vietqr.io/image/${bankAccount.bankId}-${bankAccount.accountNumber}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;

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

    return updated;
  }
}
