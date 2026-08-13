export interface CustomerPointsInput {
  tenantId: string;
  customerPhone?: string;
  usePoints?: boolean;
  pointsToUse?: number;
  subtotal: number;
}

export interface CustomerPointsResult {
  customerId?: string;
  cleanPhone?: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
}

async function lookupOrCreateCustomer(
  tenantId: string,
  phone: string,
  tx: any
) {
  const cleanPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  let customer = await tx.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone: cleanPhone } },
  });

  if (!customer) {
    customer = await tx.customer.create({
      data: { tenantId, phone: cleanPhone, points: 0 },
    });
  }

  return { customer, cleanPhone };
}

export async function calculateCustomerPoints(
  input: CustomerPointsInput,
  tx: any
): Promise<CustomerPointsResult> {
  const result: CustomerPointsResult = {
    pointsEarned: 0,
    pointsRedeemed: 0,
    pointsDiscountAmount: 0,
  };

  if (!input.customerPhone || typeof input.customerPhone !== 'string' || !input.customerPhone.trim()) {
    return result;
  }

  const { customer, cleanPhone } = await lookupOrCreateCustomer(input.tenantId, input.customerPhone, tx);
  result.customerId = customer.id;
  result.cleanPhone = cleanPhone;

  const systemConfig = await tx.systemConfig.findUnique({ where: { tenantId: input.tenantId } });
  const pointEarnRate = systemConfig?.pointEarnRate ?? 10000;
  const pointRedeemRate = systemConfig?.pointRedeemRate ?? 100;

  result.pointsEarned = Math.floor(input.subtotal / pointEarnRate);

  if (input.usePoints && customer.points > 0) {
    let requestedPoints = customer.points;
    if (typeof input.pointsToUse === 'number' && input.pointsToUse >= 0) {
      requestedPoints = Math.min(customer.points, Math.floor(input.pointsToUse));
    }
    const maxDiscount = requestedPoints * pointRedeemRate;
    result.pointsDiscountAmount = Math.min(maxDiscount, input.subtotal);
    result.pointsRedeemed = Math.ceil(result.pointsDiscountAmount / pointRedeemRate);
  }

  return result;
}
