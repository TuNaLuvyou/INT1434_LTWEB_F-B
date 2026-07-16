import prisma from '../config/prisma';
import { Voucher, DiscountType } from '@prisma/client';
import { AppError } from '../utils/app-error';

export async function getAllVouchers(tenantId: string): Promise<Voucher[]> {
  return prisma.voucher.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createVoucher(data: {
  tenantId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsage?: number;
  expiredAt?: Date;
}): Promise<Voucher> {
  const codeFormatted = data.code.trim().toUpperCase();

  // Check if voucher exists
  const existing = await prisma.voucher.findUnique({
    where: { tenantId_code: { tenantId: data.tenantId, code: codeFormatted } },
  });

  if (existing) {
    throw new AppError(400, 'VOUCHER_EXISTS', `Mã voucher "${codeFormatted}" đã tồn tại.`);
  }

  return prisma.voucher.create({
    data: {
      tenantId: data.tenantId,
      code: codeFormatted,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUsage: data.maxUsage ?? null,
      expiredAt: data.expiredAt ?? null,
      isActive: true,
    },
  });
}

export async function deleteVoucher(id: string, tenantId: string): Promise<Voucher> {
  const voucher = await prisma.voucher.findFirst({ where: { id, tenantId } });
  if (!voucher) throw new AppError(404, 'NOT_FOUND', 'Voucher không tồn tại');

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
