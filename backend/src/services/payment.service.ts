import prisma from '../config/prisma';
import { PaymentMethod } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { emitTableStatusChanged, emitSessionClosed, emitKitchenNewTicket } from '../socket/emit.helpers';
import { deductInventory } from './inventory.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoucherValidationResult {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  /** Gia tri giam theo dong tien da tinh san (phu thuoc subtotal) */
  discountAmount: number;
}

export interface ProcessPaymentInput {
  sessionId: string;
  cashierId: string;
  method: PaymentMethod;
  voucherId?: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  keepOccupied?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tim Shift OPEN cua cashier. Neu khong co thi tu dong tao moi.
 * Giai phap don gian hoa: khong can Thu ngan mo/dong ca thu cong.
 */
export async function getOrCreateShift(cashierId: string): Promise<string> {
  const existing = await prisma.shift.findFirst({
    where: { cashierId, status: 'OPEN' },
    select: { id: true },
    orderBy: { openedAt: 'desc' },
  });

  if (existing) return existing.id;

  const newShift = await prisma.shift.create({
    data: {
      cashierId,
      openFloat: 0,
      status: 'OPEN',
    },
    select: { id: true },
  });

  return newShift.id;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Validate ma voucher va tinh toan discount dua tren subtotal.
 */
export async function validateVoucher(
  code: string,
  subtotal: number
): Promise<VoucherValidationResult> {
  const voucher = await prisma.voucher.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!voucher) {
    throw new AppError(404, 'VOUCHER_NOT_FOUND', `Ma voucher "${code}" khong ton tai.`);
  }

  if (!voucher.isActive) {
    throw new AppError(400, 'VOUCHER_INACTIVE', 'Ma voucher nay da bi vo hieu hoa.');
  }

  if (voucher.expiredAt && new Date() > voucher.expiredAt) {
    throw new AppError(400, 'VOUCHER_EXPIRED', 'Ma voucher nay da het han su dung.');
  }

  if (voucher.maxUsage !== null && voucher.usedCount >= voucher.maxUsage) {
    throw new AppError(400, 'VOUCHER_EXHAUSTED', 'Ma voucher nay da het luot su dung.');
  }

  const discountValue = Number(voucher.discountValue);
  let discountAmount: number;

  if (voucher.discountType === 'PERCENT') {
    // Giam theo phan tram, cap tai subtotal
    discountAmount = Math.min(Math.round((subtotal * discountValue) / 100), subtotal);
  } else {
    // Giam so tien co dinh, cap tai subtotal
    discountAmount = Math.min(discountValue, subtotal);
  }

  return {
    id: voucher.id,
    code: voucher.code,
    discountType: voucher.discountType,
    discountValue,
    discountAmount,
  };
}

/**
 * Xu ly thanh toan day du:
 * 1. Validate session con OPEN va hop le
 * 2. Lay/tao Shift cho cashier
 * 3. Transaction: tao Payment, cap nhat Voucher usedCount, dong session, reset ban
 * 4. Emit socket events
 */
export async function processPayment(input: ProcessPaymentInput): Promise<{
  paymentId: string;
  sessionId: string;
  tableId: string;
  total: number;
  method: PaymentMethod;
  paidAt: Date;
}> {
  const { sessionId, cashierId, method, voucherId, subtotal, discountAmount, total, keepOccupied } = input;

  // 1. Validate session (include orderItems and menuItem details)
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orderItems: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              isSoldOut: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Phien lam viec khong ton tai.');
  }

  if (session.status !== 'OPEN') {
    throw new AppError(400, 'SESSION_CLOSED', `Phien lam viec da o trang thai ${session.status}, khong the thanh toan.`);
  }

  // 2. Lay/tao Shift
  const shiftId = await getOrCreateShift(cashierId);

  // 3. Transaction
  const paidAt = new Date();

  // Lay cac mon CART va PENDING chua gui bep de gui cho bep sau khi thanh toan thanh cong
  const cartItems = session.orderItems.filter(item => item.status === 'CART');
  const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');

  const itemsToSendToKitchen = [
    ...cartItems,
    ...(!session.lockedAt ? pendingItems : [])
  ];

  const payment = await prisma.$transaction(async (tx) => {
    // Tao ban ghi thanh toan
    const newPayment = await tx.payment.create({
      data: {
        sessionId,
        shiftId,
        subtotal,
        discountAmount,
        total,
        method,
        ...(voucherId ? { voucherId } : {}),
        paidAt,
      },
    });

    // Tang usedCount cua voucher (neu co)
    if (voucherId) {
      await tx.voucher.update({
        where: { id: voucherId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // 1. Chuyen tat ca CART thanh PENDING
    if (cartItems.length > 0) {
      await tx.orderItem.updateMany({
        where: { sessionId, status: 'CART' },
        data: { status: 'PENDING' },
      });
    }

    // 2. AUTO-DEDUCTION: Tru ton kho nguyen lieu theo BOM (non-blocking)
    const itemsToDeduct = session.orderItems
      .filter(i => i.status === 'CART' || i.status === 'PENDING')
      .map(i => ({ menuItemId: i.menuItemId, qty: i.qty }));

    if (itemsToDeduct.length > 0) {
      try {
        await deductInventory(itemsToDeduct, sessionId, 'SYSTEM_CASHIER', tx as any);
      } catch (deductErr: any) {
        // Khong co BOM hoac thieu stock → bo qua, khong fail payment
        console.warn('[processPayment] deductInventory skip:', deductErr?.message);
      }
    }

    // Dong session -> PAID va set lockedAt (quan trong de KDS bep hien thi)
    await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        status: 'PAID',
        closedAt: paidAt,
        lockedAt: session.lockedAt || paidAt,
      },
    });

    // Reset ban -> OCCUPIED neu keepOccupied=true, nguoc lai AVAILABLE
    await tx.table.update({
      where: { id: session.tableId },
      data: { status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE' },
    });

    return newPayment;
  }, {
    timeout: 15_000,
    maxWait: 5_000,
  });

  // 4. Emit socket events
  emitSessionClosed(session.tableId, {
    sessionId,
    tableId: session.tableId,
    status: 'PAID',
    closedAt: paidAt.toISOString(),
  });

  emitTableStatusChanged({
    tableId: session.tableId,
    status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE',
    tableNumber: session.table.tableNumber,
    label: session.table.label,
  });

  // 5. Gui mon den bep (KDS) realtime
  if (itemsToSendToKitchen.length > 0) {
    emitKitchenNewTicket({
      sessionId,
      tableId: session.tableId,
      tableNumber: session.table.tableNumber,
      tableLabel: session.table.label,
      items: itemsToSendToKitchen.map(item => ({
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        note: item.note || undefined,
        status: 'PENDING',
        createdAt: item.createdAt.toISOString(),
      })),
      createdAt: paidAt.toISOString(),
    });
  }

  return {
    paymentId: payment.id,
    sessionId,
    tableId: session.tableId,
    total: Number(payment.total),
    method,
    paidAt,
  };
}
