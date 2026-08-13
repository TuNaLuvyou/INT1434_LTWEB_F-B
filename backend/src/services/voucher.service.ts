import prisma from '../config/prisma';
import { Voucher, DiscountType } from '@prisma/client';
import { AppError } from '../utils/app-error';

export async function getAllVouchers(tenantId: string, branchId?: string): Promise<any[]> {
  const vouchers = await prisma.voucher.findMany({
    where: { tenantId },
    include: {
      branches: {
        select: { branchId: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  if (branchId) {
    // Nếu voucher có VoucherBranch records => chỉ áp dụng cho branch được chỉ định
    // Nếu không có record nào => áp dụng cho tất cả branch
    return vouchers.filter(v => {
      if (v.branches.length === 0) return true;
      return v.branches.some(b => b.branchId === branchId);
    });
  }

  return vouchers;
}

export async function createVoucher(data: {
  tenantId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsage?: number;
  expiredAt?: Date;
  branchIds?: string[];
}): Promise<Voucher> {
  const codeFormatted = data.code.trim().toUpperCase();

  const existing = await prisma.voucher.findUnique({
    where: { tenantId_code: { tenantId: data.tenantId, code: codeFormatted } },
  });

  if (existing) {
    throw new AppError(400, 'VOUCHER_EXISTS', `Mã voucher "${codeFormatted}" đã tồn tại.`);
  }

  const voucher = await prisma.voucher.create({
    data: {
      tenantId: data.tenantId,
      code: codeFormatted,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUsage: data.maxUsage ?? null,
      expiredAt: data.expiredAt ?? null,
      isActive: true,
      ...(data.branchIds && data.branchIds.length > 0 ? {
        branches: {
          create: data.branchIds.map(branchId => ({ branchId }))
        }
      } : {}),
    },
  });

  return voucher;
}

export async function updateVoucher(id: string, tenantId: string, data: {
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxUsage?: number | null;
  expiredAt?: Date | null;
  branchIds?: string[];
}): Promise<Voucher> {
  const voucher = await prisma.voucher.findFirst({ where: { id, tenantId } });
  if (!voucher) throw new AppError(404, 'NOT_FOUND', 'Voucher không tồn tại');

  const updateData: any = {};
  if (data.code) updateData.code = data.code.toUpperCase();
  if (data.discountType) updateData.discountType = data.discountType;
  if (data.discountValue) updateData.discountValue = data.discountValue;
  if (data.maxUsage !== undefined) updateData.maxUsage = data.maxUsage;
  if (data.expiredAt !== undefined) updateData.expiredAt = data.expiredAt;

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.voucher.update({
      where: { id },
      data: updateData,
    });

    if (data.branchIds !== undefined) {
      await tx.voucherBranch.deleteMany({ where: { voucherId: id } });
      if (data.branchIds.length > 0) {
        await tx.voucherBranch.createMany({
          data: data.branchIds.map(branchId => ({ voucherId: id, branchId }))
        });
      }
    }

    return result;
  });

  return updated;
}

export async function deleteVoucher(id: string, tenantId: string): Promise<Voucher> {
  const voucher = await prisma.voucher.findFirst({ where: { id, tenantId } });
  if (!voucher) throw new AppError(404, 'NOT_FOUND', 'Voucher không tồn tại');

  const paymentCount = await prisma.payment.count({
    where: { voucherId: id },
  });

  if (paymentCount > 0) {
    return prisma.voucher.update({
      where: { id },
      data: { isActive: false },
    });
  }

  return prisma.voucher.delete({
    where: { id },
  });
}

export async function isVoucherApplicableToBranch(voucherId: string, branchId: string): Promise<boolean> {
  const branchCount = await prisma.voucherBranch.count({
    where: { voucherId }
  });
  // Nếu không có ràng buộc branch nào -> áp dụng cho tất cả
  if (branchCount === 0) return true;
  const match = await prisma.voucherBranch.findUnique({
    where: { voucherId_branchId: { voucherId, branchId } }
  });
  return !!match;
}
