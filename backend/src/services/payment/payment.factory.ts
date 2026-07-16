import { PaymentProvider } from './payment-provider.interface';
import { CashProvider } from './providers/cash.provider';
import { VietQrProvider } from './providers/vietqr.provider';
import { AppError } from '../../utils/app-error';

export class PaymentFactory {
  static getProvider(providerName: string): PaymentProvider {
    switch (providerName.toUpperCase()) {
      case 'CASH':
        return new CashProvider();
      case 'VIETQR':
        return new VietQrProvider();
      // Prepare for MOMO, ZALOPAY, VNPAY
      // case 'MOMO': return new MomoProvider();
      default:
        throw new AppError(400, 'INVALID_PAYMENT_PROVIDER', `Provider ${providerName} is not supported.`);
    }
  }
}
