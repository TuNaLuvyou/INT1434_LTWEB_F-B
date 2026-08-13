/**
 * vietqr.ts — Helper dựng URL ảnh VietQR tĩnh từ tài khoản ngân hàng.
 * Dùng chung cho: VietQrProvider, cashier.service, session.controller.
 */
export function buildVietQrUrl(opts: {
  bankId: string;
  accountNumber: string;
  accountName: string;
  amount: number | string | { toString(): string };
  addInfo: string; // Mã thanh toán (paymentCode)
}): string {
  const amount = opts.amount.toString();
  const addInfo = encodeURIComponent(opts.addInfo);
  const accountName = encodeURIComponent(opts.accountName);
  return `https://img.vietqr.io/image/${opts.bankId}-${opts.accountNumber}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}
