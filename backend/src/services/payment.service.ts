import prisma from '../config/prisma';
import { PaymentMethod } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { emitTableStatusChanged, emitSessionClosed, emitKitchenNewTicket } from '../socket/emit.helpers';
import { deductInventory } from './inventory.service';
import { isVoucherApplicableToBranch } from './voucher.service';

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
  provider?: string;
  voucherId?: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  keepOccupied?: boolean;
}

import { PaymentFactory } from './payment/payment.factory';
import { PaymentStatus } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tim Shift OPEN cua cashier. Neu khong co thi tu dong tao moi.
 * Giai phap don gian hoa: khong can Thu ngan mo/dong ca thu cong.
 */
export async function getOrCreateShift(cashierId: string, tenantId: string, branchId: string): Promise<string> {
  const existing = await prisma.shift.findFirst({
    where: { cashierId, status: 'OPEN', tenantId, branchId },
    select: { id: true },
    orderBy: { openedAt: 'desc' },
  });

  if (existing) return existing.id;

  const newShift = await prisma.shift.create({
    data: {
      cashierId,
      tenantId,
      branchId,
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
  subtotal: number,
  branchId?: string
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

  // Check branch applicability
  if (branchId) {
    const applicable = await isVoucherApplicableToBranch(voucher.id, branchId);
    if (!applicable) {
      throw new AppError(400, 'VOUCHER_BRANCH_MISMATCH', 'Ma voucher khong ap dung cho chi nhanh nay.');
    }
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

  const providerName = input.provider || (method === 'TRANSFER' ? 'VIETQR' : 'CASH');
  const provider = PaymentFactory.getProvider(providerName);

  // 3. Transaction
  const paidAt = new Date();

  // Lay cac mon CART va PENDING chua gui bep de gui cho bep sau khi thanh toan thanh cong
  const cartItems = session.orderItems.filter(item => item.status === 'CART');
  const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');

  const itemsToSendToKitchen = [
    ...cartItems,
    ...(!session.lockedAt ? pendingItems : [])
  ];

  const result = await prisma.$transaction(async (tx) => {
    // Xóa các giao dịch PENDING bị treo (do người dùng bấm Đóng rồi thử lại)
    await tx.payment.deleteMany({
      where: {
        sessionId,
        status: 'PENDING'
      }
    });

    // Tao ban ghi thanh toan via Provider
    const { payment, providerData } = await provider.createPayment({
      sessionId,
      cashierId,
      tenantId: session.tenantId,
      branchId: session.branchId,
      method,
      provider: providerName,
      voucherId,
      subtotal,
      discountAmount,
      total,
    }, tx);

    // Neu payment PENDING (nhu VietQR), ta chua cap nhat kho/ban/session
    if (payment.status === PaymentStatus.PENDING) {
      return { payment, providerData, isPending: true };
    }

    // Neu SUCCESS (nhu CASH), ta tiep tuc xu ly
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
      await deductInventory(itemsToDeduct, sessionId, 'SYSTEM_CASHIER', tx as any, session.table.tenantId, session.table.branchId).catch((deductErr: any) => {
        console.warn('[processPayment] deductInventory skip:', deductErr?.message);
      });
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

    return { payment, providerData: null, isPending: false };
  }, {
    timeout: 15_000,
    maxWait: 5_000,
  });

  if (result.isPending) {
    return {
      paymentId: result.payment.id,
      sessionId,
      tableId: session.tableId,
      total: Number(result.payment.total),
      method,
      status: result.payment.status,
      providerData: result.providerData,
      orderNo: session.orderNo,
      paidAt: null as any, // Not paid yet
    };
  }

  // 4. Emit socket events (chi khi SUCCESS)
  emitSessionClosed(session.tableId, {
    sessionId,
    tableId: session.tableId,
    status: 'PAID',
    closedAt: paidAt.toISOString(),
  });

  emitTableStatusChanged(session.tenantId, session.branchId, {
    tableId: session.tableId,
    status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE',
    tableNumber: session.table.tableNumber,
    label: session.table.label,
  });

  // 5. Gui mon den bep (KDS) realtime
  if (itemsToSendToKitchen.length > 0) {
    emitKitchenNewTicket(session.tenantId, session.branchId, {
      sessionId,
      orderNo: session.orderNo || undefined,
      tableId: session.tableId,
      tableNumber: session.table.tableNumber,
      items: itemsToSendToKitchen.map(item => ({
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        note: item.note || undefined,
        status: 'PENDING',
      })),
      createdAt: paidAt.toISOString(),
    });
  }

  return {
    paymentId: result.payment.id,
    sessionId,
    tableId: session.tableId,
    total: Number(result.payment.total),
    method,
    status: result.payment.status,
    orderNo: session.orderNo,
    paidAt,
  };
}

/**
 * Xac nhan thanh toan (vi du Cashier xac nhan da nhan duoc tien chuyen khoan).
 */
export async function confirmManualPayment(paymentId: string, cashierId: string, keepOccupied: boolean = false): Promise<any> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      session: {
        include: {
          table: true,
          orderItems: { include: { menuItem: true } }
        }
      }
    }
  });

  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Khong tim thay giao dich.');
  if (payment.status === PaymentStatus.SUCCESS) {
    throw new AppError(400, 'PAYMENT_ALREADY_CONFIRMED', 'Thanh toan nay da duoc xac nhan roi.');
  }

  const provider = PaymentFactory.getProvider(payment.provider || 'VIETQR');
  const session = payment.session;

  const cartItems = session.orderItems.filter(item => item.status === 'CART');
  const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');
  const itemsToSendToKitchen = [...cartItems, ...(!session.lockedAt ? pendingItems : [])];
  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await provider.confirmPayment(payment.id, tx);

    if (payment.voucherId) {
      await tx.voucher.update({ where: { id: payment.voucherId }, data: { usedCount: { increment: 1 } } });
    }

    if (cartItems.length > 0) {
      await tx.orderItem.updateMany({ where: { sessionId: session.id, status: 'CART' }, data: { status: 'PENDING' } });
    }

    const itemsToDeduct = session.orderItems
      .filter(i => i.status === 'CART' || i.status === 'PENDING')
      .map(i => ({ menuItemId: i.menuItemId, qty: i.qty }));

    if (itemsToDeduct.length > 0) {
      try {
        await deductInventory(itemsToDeduct, session.id, 'SYSTEM_CASHIER', tx as any, session.table.tenantId, session.table.branchId);
      } catch (e) {
        console.warn('[confirmManualPayment] deduct skip', e);
      }
    }

    await tx.tableSession.update({
      where: { id: session.id },
      data: { status: 'PAID', closedAt: paidAt, lockedAt: session.lockedAt || paidAt }
    });

    await tx.table.update({
      where: { id: session.tableId },
      data: { status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE' }
    });
  });

  // Emit events
  emitSessionClosed(session.tableId, {
    sessionId: session.id,
    tableId: session.tableId,
    status: 'PAID',
    closedAt: paidAt.toISOString(),
  });

  emitTableStatusChanged(session.tenantId, session.branchId, {
    tableId: session.tableId,
    status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE',
    tableNumber: session.table.tableNumber,
    label: session.table.label,
  });

  if (itemsToSendToKitchen.length > 0) {
    emitKitchenNewTicket(session.tenantId, session.branchId, {
      sessionId: session.id,
      orderNo: session.orderNo || undefined,
      tableId: session.tableId,
      tableNumber: session.table.tableNumber,
      items: itemsToSendToKitchen.map(item => ({
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        note: item.note || undefined,
        status: 'PENDING',
      })),
      createdAt: paidAt.toISOString(),
    });
  }

  return { success: true, paymentId, orderNo: session.orderNo };
}
