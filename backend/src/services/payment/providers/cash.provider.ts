import { Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentInput, PaymentCreationResult, PaymentProvider } from '../payment-provider.interface';
import { getOrCreateShift, settleCustomerPoints } from '../../payment.service';

export class CashProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput, tx: Prisma.TransactionClient): Promise<PaymentCreationResult> {
    const shiftId = await getOrCreateShift(input.cashierId, input.tenantId, input.branchId);
    const paidAt = new Date();

    const payment = await tx.payment.create({
      data: {
        sessionId: input.sessionId,
        shiftId,
        subtotal: input.subtotal,
        discountAmount: input.discountAmount,
        total: input.total,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        provider: 'CASH',
        paidAt,
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

    if (payment.customerId && (payment.pointsEarned > 0 || payment.pointsRedeemed > 0)) {
      await settleCustomerPoints(payment, tx);
    }

    return { payment };
  }

  async confirmPayment(paymentId: string, tx: Prisma.TransactionClient): Promise<Payment> {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Payment not found');
    return payment;
  }
}
