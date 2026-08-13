import prisma from '../config/prisma';
import { PaymentMethod } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { emitTableStatusChanged, emitSessionClosed, emitKitchenNewTicket } from '../socket/emit.helpers';
import { deductInventory } from './inventory.service';
import { isVoucherApplicableToBranch } from './voucher.service';
import { calculateCustomerPoints } from './loyalty.service';
import { dispatchEvent } from './webhook.service';

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
  customerPhone?: string;
  usePoints?: boolean;
  pointsToUse?: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  keepOccupied?: boolean;
  items?: Array<{ menuItemId: string; qty: number; note?: string }>;
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
  const voucher = await prisma.voucher.findFirst({ where: { code: code.trim().toUpperCase() } });

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
  status?: string;
  providerData?: any;
  orderNo?: string | null;
  paidAt: Date;
}> {
  const { sessionId, cashierId, method, voucherId, subtotal, discountAmount, total, keepOccupied = false } = input;

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

  const result = await prisma.$transaction(async (tx) => {
    // 1. Nếu POS truyền danh sách món trực tiếp (Local Cart), lưu/cập nhật vào orderItems bằng createMany
    if (input.items && input.items.length > 0) {
      await tx.orderItem.deleteMany({
        where: { sessionId, status: { in: ['CART', 'PENDING'] } }
      });
      const itemIds = input.items.map(i => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, price: true }
      });
      const priceMap = new Map(menuItems.map(m => [m.id, m.price]));

      const newItemsData = input.items
        .filter(item => priceMap.has(item.menuItemId))
        .map(item => ({
          sessionId,
          tenantId: session.tenantId,
          menuItemId: item.menuItemId,
          qty: item.qty,
          note: item.note || null,
          unitPrice: priceMap.get(item.menuItemId) || 0,
          status: 'PENDING' as const
        }));

      if (newItemsData.length > 0) {
        await tx.orderItem.createMany({
          data: newItemsData
        });
      }
    }

    const pointsResult = await calculateCustomerPoints({
      tenantId: session.tenantId,
      customerPhone: input.customerPhone,
      usePoints: input.usePoints,
      pointsToUse: input.pointsToUse,
      subtotal,
    }, tx);

    const customerId = pointsResult.customerId;
    const cleanPhone = pointsResult.cleanPhone;
    const pointsEarned = pointsResult.pointsEarned;
    const pointsRedeemed = pointsResult.pointsRedeemed;
    const pointsDiscountAmount = pointsResult.pointsDiscountAmount;

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
      discountAmount: discountAmount + pointsDiscountAmount,
      total: Math.max(0, total - pointsDiscountAmount),
      customerId,
      customerPhone: cleanPhone,
      pointsEarned,
      pointsRedeemed,
      pointsDiscountAmount,
    }, tx);

    // Neu payment PENDING (nhu VietQR), ta chua cap nhat kho/ban/session
    if (payment.status === PaymentStatus.PENDING) {
      return { payment, providerData, isPending: true, itemsToDeduct: [] };
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

    // 2. Lấy danh sách món để trừ tồn kho nguyen lieu (chạy ngầm ngoài transaction)
    const updatedOrderItems = await tx.orderItem.findMany({ where: { sessionId } });
    const itemsToDeduct = updatedOrderItems
      .filter(i => i.status === 'CART' || i.status === 'PENDING')
      .map(i => ({ menuItemId: i.menuItemId, qty: i.qty }));

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
    if (session.tableId) {
      await tx.table.update({
        where: { id: session.tableId },
        data: { status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE' },
      });
    }

    return { payment, providerData: null, isPending: false, itemsToDeduct };
  }, {
    timeout: 15_000,
    maxWait: 5_000,
  });

  // Chạy ngầm trừ kho bằng setImmediate để API phản hồi tức thì
  if (result.itemsToDeduct && result.itemsToDeduct.length > 0) {
    setImmediate(() => {
      deductInventory(result.itemsToDeduct, sessionId, 'SYSTEM_CASHIER', prisma as any, session.tenantId, session.branchId).catch((deductErr: any) => {
        console.warn('[processPayment] deductInventory async skip:', deductErr?.message);
      });
    });
  }

  if (result.isPending) {
    return {
      paymentId: result.payment.id,
      sessionId,
      tableId: session.tableId || session.id,
      total: Number(result.payment.total),
      method,
      status: result.payment.status,
      providerData: result.providerData,
      orderNo: session.orderNo,
      paidAt: null as any, // Not paid yet
    };
  }

  // 4. Emit socket + webhook + gửi món tới bếp (dùng chung cho cả 2 luồng)
  await emitPaymentCompletion({
    session,
    paymentId: result.payment.id,
    method,
    provider: providerName,
    subtotal,
    discountAmount,
    total: Number(result.payment.total),
    customerPhone: (input as any).customerPhone || (result.payment as any).customerPhone || null,
    customerId: (result.payment as any).customerId || null,
    keepOccupied,
    paidAt,
  });

  return {
    paymentId: result.payment.id,
    sessionId,
    tableId: session.tableId || session.id,
    total: Number(result.payment.total),
    method,
    status: result.payment.status,
    orderNo: session.orderNo,
    paidAt,
  };
}

/**
 * Chia sẻ logic phát socket + webhook sau khi thanh toán thành công.
 * Dùng chung cho processPayment (CASH) và confirmManualPayment (VIETQR confirm).
 */
async function emitPaymentCompletion({
  session,
  paymentId,
  method,
  provider,
  subtotal,
  discountAmount,
  total,
  customerPhone,
  customerId,
  keepOccupied,
  paidAt,
}: {
  session: any; // TableSession + table + orderItems (include menuItem)
  paymentId: string;
  method: PaymentMethod;
  provider: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  customerPhone?: string | null;
  customerId?: string | null;
  keepOccupied: boolean;
  paidAt: Date;
}): Promise<void> {
  // 1. Emit session closed → khách thấy "Phiên kết thúc"
  emitSessionClosed(session.tenantId, session.branchId, session.tableId || session.id, {
    sessionId: session.id,
    tableId: session.tableId || session.id,
    status: 'PAID',
    closedAt: paidAt.toISOString(),
  });

  // 2. Cập nhật trạng thái bàn realtime
  if (session.tableId) {
    emitTableStatusChanged(session.tenantId, session.branchId, {
      tableId: session.tableId,
      status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE',
      tableNumber: session.table?.tableNumber ?? 0,
      label: session.table?.label ?? 'Mang về',
    });
  }

  // 3. Webhook payment:completed
  const itemsPayload = session.orderItems.map((item: any) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.menuItem?.name || '',
    qty: item.qty,
    unitPrice: Number(item.unitPrice),
    itemDiscountType: item.itemDiscountType || null,
    itemDiscountValue: item.itemDiscountValue ? Number(item.itemDiscountValue) : 0,
    note: item.note || null,
    selectedModifiers: item.selectedModifiers || null,
    status: item.status,
  }));

  dispatchEvent(session.tenantId, 'payment:completed', {
    paymentId,
    sessionId: session.id,
    orderNo: session.orderNo,
    tenantId: session.tenantId,
    branchId: session.branchId,
    tableId: session.tableId || null,
    tableNumber: session.table?.tableNumber ?? 0,
    tableLabel: session.table?.label ?? 'Mang về',
    method,
    provider,
    subtotal,
    discountAmount,
    total,
    paidAt: paidAt.toISOString(),
    customerPhone: customerPhone || null,
    customerId: customerId || null,
    items: itemsPayload,
  }).catch((err) => console.error('[Webhook] dispatch payment:completed error:', err));

  // 4. Gửi món còn PENDING/PREPARING tới bếp (KDS) realtime
  const pendingItemsForKitchen = await prisma.orderItem.findMany({
    where: {
      sessionId: session.id,
      status: { in: ['PENDING', 'PREPARING'] }
    },
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  });

  if (pendingItemsForKitchen.length > 0) {
    emitKitchenNewTicket(session.tenantId, session.branchId, {
      sessionId: session.id,
      orderNo: session.orderNo || undefined,
      tableId: session.tableId || session.id,
      tableNumber: session.table?.tableNumber ?? 0,
      tableLabel: session.table?.label ?? 'Mang về',
      items: pendingItemsForKitchen.map(item => ({
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        note: item.note || undefined,
        status: item.status,
      })),
      createdAt: paidAt.toISOString(),
    });
  }
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
        await deductInventory(itemsToDeduct, session.id, 'SYSTEM_CASHIER', tx as any, session.tenantId, session.branchId);
      } catch (e) {
        console.warn('[confirmManualPayment] deduct skip', e);
      }
    }

    await tx.tableSession.update({
      where: { id: session.id },
      data: { status: 'PAID', closedAt: paidAt, lockedAt: session.lockedAt || paidAt }
    });

    if (session.tableId) {
      await tx.table.update({
        where: { id: session.tableId },
        data: { status: keepOccupied ? 'OCCUPIED' : 'AVAILABLE' }
      });
    }
  });

  // Emit socket + webhook + gửi món tới bếp (dùng chung cho cả 2 luồng)
  await emitPaymentCompletion({
    session,
    paymentId,
    method: payment.method,
    provider: payment.provider || 'VIETQR',
    subtotal: Number(payment.subtotal),
    discountAmount: Number(payment.discountAmount || 0),
    total: Number(payment.total),
    customerPhone: payment.customerPhone || null,
    customerId: payment.customerId || null,
    keepOccupied,
    paidAt,
  });

  return { 
    success: true, 
    paymentId, 
    orderNo: session.orderNo,
    sessionId: session.id,
    tableId: session.tableId || session.id,
    tenantId: session.tenantId,
    branchId: session.branchId,
    total: Number(payment.total),
  };
}

/**
 * Xử lý cộng/trừ điểm tích luỹ cho khách hàng khi giao dịch thanh toán hoàn tất (SUCCESS).
 */
export async function settleCustomerPoints(payment: {
  id: string;
  tenantId: string;
  customerId: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
}, tx: any): Promise<void> {
  if (!payment.customerId) return;

  const customer = await tx.customer.findUnique({ where: { id: payment.customerId } });
  if (!customer) return;

  let currentPoints = customer.points;
  let accumulatedPoints = customer.accumulatedPoints ?? 0;

  if (payment.pointsRedeemed > 0) {
    currentPoints = Math.max(0, currentPoints - payment.pointsRedeemed);
    await tx.customerPointLog.create({
      data: {
        tenantId: payment.tenantId,
        customerId: payment.customerId,
        paymentId: payment.id,
        type: 'REDEEM',
        points: -payment.pointsRedeemed,
        note: `Sử dụng ${payment.pointsRedeemed} điểm cho thanh toán`,
      },
    });
  }

  if (payment.pointsEarned > 0) {
    currentPoints = currentPoints + payment.pointsEarned;
    accumulatedPoints = accumulatedPoints + payment.pointsEarned;
    await tx.customerPointLog.create({
      data: {
        tenantId: payment.tenantId,
        customerId: payment.customerId,
        paymentId: payment.id,
        type: 'EARN',
        points: payment.pointsEarned,
        note: `Tích lũy ${payment.pointsEarned} điểm từ đơn hàng`,
      },
    });
  }

  // Evaluate tier upgrade
  const tiers = await tx.membershipTier.findMany({
    where: { tenantId: payment.tenantId },
    orderBy: { minPoints: 'desc' },
  });

  let newTierId = customer.membershipTierId;
  if (tiers.length > 0) {
    const eligibleTier = tiers.find((t: any) => accumulatedPoints >= t.minPoints);
    if (eligibleTier) {
      newTierId = eligibleTier.id;
    }
  }

  await tx.customer.update({
    where: { id: payment.customerId },
    data: {
      points: currentPoints,
      accumulatedPoints,
      membershipTierId: newTierId,
    },
  });
}


