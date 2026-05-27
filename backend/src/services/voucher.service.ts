import prisma from '../config/prisma';
import { Voucher, DiscountType } from '@prisma/client';
import { AppError } from '../utils/app-error';

export async function getAllVouchers(): Promise<Voucher[]> {
  return prisma.voucher.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createVoucher(data: {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsage?: number;
  expiredAt?: Date;
}): Promise<Voucher> {
  const codeFormatted = data.code.trim().toUpperCase();

  // Check if voucher exists
  const existing = await prisma.voucher.findUnique({
    where: { code: codeFormatted },
  });

  if (existing) {
    throw new AppError(400, 'VOUCHER_EXISTS', `Mã voucher "${codeFormatted}" đã tồn tại.`);
  }

  return prisma.voucher.create({
    data: {
      code: codeFormatted,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUsage: data.maxUsage ?? null,
      expiredAt: data.expiredAt ?? null,
      isActive: true,
    },
  });
}

export async function deleteVoucher(id: string): Promise<Voucher> {
  // Check if voucher has payments attached
  const paymentCount = await prisma.payment.count({
    where: { voucherId: id },
  });

  if (paymentCount > 0) {
    // If it has payments, we soft-delete it by setting isActive: false
    return prisma.voucher.update({
      where: { id },
      data: { isActive: false },
    });
  }

  return prisma.voucher.delete({
    where: { id },
  });
}
