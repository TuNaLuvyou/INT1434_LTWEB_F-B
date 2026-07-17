import { processPayment } from './src/services/payment.service';
async function test() {
  try {
    await processPayment({
      sessionId: '661d4569-d4ec-4e81-bf4f-983463294789',
      cashierId: 'some-id',
      method: 'CASH',
      subtotal: 0,
      discountAmount: 0,
      total: 0,
    });
  } catch (e) {
    console.error(e);
  }
}
test();
