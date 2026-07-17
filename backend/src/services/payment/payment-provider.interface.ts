import { Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

export interface CreatePaymentInput {
  sessionId: string;
  cashierId: string;
  tenantId: string;
  branchId: string;
  method: PaymentMethod;
  provider: string; // 'CASH', 'VIETQR', 'MOMO'
  voucherId?: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  keepOccupied?: boolean;
}

export interface PaymentCreationResult {
  payment: Payment;
  /** Extra data for UI, e.g., qrDataUrl, checkoutUrl, bankDetails */
  providerData?: any; 
}

export interface PaymentProvider {
  /**
   * Initializes the payment. For Cash, it might immediately set status to SUCCESS.
   * For VietQR, it sets status to PENDING and generates a QR code.
   */
  createPayment(input: CreatePaymentInput, tx: Prisma.TransactionClient): Promise<PaymentCreationResult>;

  /**
   * Verifies the payment with the provider or manually confirms it.
   */
  confirmPayment(paymentId: string, tx: Prisma.TransactionClient): Promise<Payment>;

  /**
   * Optional: Query real-time status from 3rd party
   */
  queryStatus?(paymentId: string): Promise<PaymentStatus>;

  /**
   * Optional: Refund
   */
  refund?(paymentId: string, amount: number): Promise<boolean>;
}
