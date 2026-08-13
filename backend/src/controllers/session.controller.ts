import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as sessionService from '../services/session.service';
import { AppError } from '../utils/app-error';
import { emitCartUpdated, emitPaymentPending, emitPaymentCancelled } from '../socket/emit.helpers';
import { InsufficientStockError } from '../services/inventory.service';

import prisma from '../config/prisma';
import { verifyQrToken } from '../utils/jwt.utils';
import { PaymentFactory } from '../services/payment/payment.factory';
import { PaymentStatus } from '@prisma/client';
import { calculateCustomerPoints } from '../services/loyalty.service';
import { ApiResponse } from '../utils/response';
import { buildVietQrUrl } from '../utils/vietqr';


// ─── POST /api/sessions/takeaway ──────────────────────────────────────────────
/**
 * PROTECTED endpoint — Tạo đơn mang về mới độc lập không gắn bàn.
 */
export async function createTakeawaySession(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    const branchId = authReq.user?.branchId;
    if (!tenantId || !branchId) {
      res.status(400).json({ success: false, message: 'Thiếu thông tin chi nhánh hoặc cửa hàng' });
      return;
    }

    const { session, table } = await sessionService.createTakeawaySession(tenantId, branchId);

    res.status(201).json({
      success: true,
      data: {
        session,
        isNew: true,
        serverTime: Date.now(),
        table,
        tenantId,
        branchId,
      },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Lỗi tạo đơn mang về' });
  }
}

// ─── POST /api/sessions/join ──────────────────────────────────────────────────
/**
 * PUBLIC endpoint — được gọi khi khách quét QR code.
 * Trả về session hiện tại hoặc tạo session mới cho bàn.
 */
export async function joinSession(req: Request, res: Response): Promise<void> {
  try {
    const { tableId: posTableId, source, qrToken } = req.body as { tableId?: string; source?: string; qrToken?: string };

    let tableId = posTableId;
    let qrPayload: { tenantId?: string; branchId?: string; tableId: string } | null = null;

    if (qrToken) {
      try {
        qrPayload = verifyQrToken(qrToken);
        tableId = qrPayload.tableId;
      } catch (err) {
        res.status(400).json({ success: false, message: 'Mã QR không hợp lệ hoặc đã hỏng' });
        return;
      }
    }

    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
      res.status(400).json({ success: false, message: 'tableId hoặc qrToken là bắt buộc' });
      return;
    }

    const createdViaPos = source === 'POS';
    const { session, isNew, table } = await sessionService.joinOrCreateSession(
      tableId.trim(),
      createdViaPos,
      qrPayload?.tenantId
    );

    let isGeofenceEnabled = false;
    if (!createdViaPos) {
      const config = await prisma.systemConfig.findUnique({ where: { id: 'singleton' } });
      isGeofenceEnabled = config?.isGeofenceEnabled ?? false;
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: { 
        session, 
        isNew, 
        serverTime: Date.now(), 
        isGeofenceEnabled,
        table: {
          id: table.id,
          tableNumber: table.tableNumber,
          label: table.label,
        },
        tenantId: table.tenantId,
        branchId: table.branchId,
      },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    const message = error.message ?? 'Internal server error';
    res.status(status).json({ success: false, message });
  }
}

// ─── GET /api/sessions/:sessionId ─────────────────────────────────────────────
/**
 * Lấy chi tiết session theo ID — dùng cho client polling sau reconnect.
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const session = await sessionService.getSessionById(sessionId);
    const { orderItems, ...sessionMeta } = session as any;

    res.status(200).json({
      success: true,
      data: { session: sessionMeta, orderItems },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── GET /api/sessions/table/:tableId/active ──────────────────────────────────
/**
 * Lấy session OPEN đang hoạt động của bàn — màn hình cashier.
 */
export async function getActiveSession(req: Request, res: Response): Promise<void> {
  try {
    const { tableId } = req.params as { tableId: string };

    const session = await sessionService.getActiveSessionByTableId(tableId);
    const { orderItems, ...sessionMeta } = session as any;

    res.status(200).json({
      success: true,
      data: { session: sessionMeta, orderItems },
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── GET /api/sessions/:sessionId/receipt ────────────────────────────────────
/**
 * PUBLIC endpoint — lấy dữ liệu hoá đơn cho trang /receipt/[sessionId].
 * Không cần auth — khách có thể xem/print hoá đơn bằng sessionId.
 */
export async function getReceiptData(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const data = await sessionService.getReceiptData(sessionId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── PATCH /api/sessions/:sessionId/status ───────────────────────────────────
/**
 * Đóng session (PAID | CANCELLED) — yêu cầu auth: ADMIN, MANAGER, CASHIER.
 */
export async function updateSessionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { status, keepOccupied } = req.body as { status?: string; keepOccupied?: boolean };

    if (!status || !['PAID', 'CANCELLED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status phải là "PAID" hoặc "CANCELLED"',
      });
      return;
    }

    const updatedSession = await sessionService.updateSessionStatus(
      sessionId,
      status as 'PAID' | 'CANCELLED',
      keepOccupied,
      req.user?.tenantId
    );

    res.status(200).json({
      success: true,
      data: { session: updatedSession },
    });
  } catch (error: any) {
    // ── Xử lý đặc biệt: Tồn kho không đủ ────────────────────────────────────
    // HTTP 422 Unprocessable Entity — request hợp lệ nhưng không thể thực thi
    // vì điều kiện nghiệp vụ không thỏa mãn (thiếu nguyên liệu).
    if (error instanceof InsufficientStockError) {
      res.status(422).json({
        success:  false,
        code:     'INSUFFICIENT_STOCK',
        message:  error.message,
        shortages: error.shortages, // [{ingredientName, required, available, shortage, unit}]
      });
      return;
    }
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── POST /api/sessions/:sessionId/cart ────────────────────────────────────────
/**
 * PUBLIC endpoint — thêm hoặc cập nhật một món ăn trong giỏ hàng.
 */
export async function handleAddToCart(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { menuItemId, qty, note, clientTimestamp, itemDiscountType, itemDiscountValue } = req.body as {
      menuItemId?: string;
      qty?: number;
      note?: string;
      clientTimestamp?: number;
      itemDiscountType?: string;
      itemDiscountValue?: number;
    };

    if (!menuItemId || typeof qty !== 'number' || typeof clientTimestamp !== 'number') {
      res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ (thiếu menuItemId, qty hoặc clientTimestamp)' });
      return;
    }

    const { session, updatedCart } = await sessionService.addToCart(
      sessionId,
      menuItemId,
      qty,
      note,
      clientTimestamp,
      itemDiscountType || null,
      itemDiscountValue || null
    );

    // Emit Socket Update realtime tới tất cả thiết bị cùng bàn
    const total = updatedCart.reduce((sum, item) => sum + item.qty * Number(item.unitPrice), 0);
    emitCartUpdated((session as any).tenantId, (session as any).branchId, session.tableId || session.id, {
      sessionId,
      tableId: session.tableId || session.id,
      orderItems: updatedCart.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
      total,
    });

    res.status(200).json({
      success: true,
      data: updatedCart,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (error.code === 'CONFLICT') {
        res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: error.message,
          currentCart: error.data?.currentCart,
        });
        return;
      }
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── DELETE /api/sessions/:sessionId/cart/:menuItemId ─────────────────────────
/**
 * PUBLIC endpoint — xóa hẳn một món ăn khỏi giỏ hàng.
 */
export async function handleDeleteCartItem(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, menuItemId } = req.params as { sessionId: string; menuItemId: string };
    
    // Đọc clientTimestamp từ query parameter hoặc headers, mặc định Date.now()
    const tsQuery = req.query.clientTimestamp ? Number(req.query.clientTimestamp) : NaN;
    const tsHeader = req.headers['x-client-timestamp'] ? Number(req.headers['x-client-timestamp']) : NaN;
    const clientTimestamp = !isNaN(tsQuery) ? tsQuery : (!isNaN(tsHeader) ? tsHeader : Date.now());

    const { session, updatedCart } = await sessionService.deleteCartItem(
      sessionId,
      menuItemId,
      clientTimestamp
    );

    // Emit Socket Update realtime tới tất cả thiết bị cùng bàn
    const total = updatedCart.reduce((sum, item) => sum + item.qty * Number(item.unitPrice), 0);
    emitCartUpdated((session as any).tenantId, (session as any).branchId, session.tableId || session.id, {
      sessionId,
      tableId: session.tableId || session.id,
      orderItems: updatedCart.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
      total,
    });

    res.status(200).json({
      success: true,
      data: updatedCart,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      if (error.code === 'CONFLICT') {
        res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: error.message,
          currentCart: error.data?.currentCart,
        });
        return;
      }
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── DELETE /api/sessions/:sessionId/cart ────────────────────────────────────
/**
 * PUBLIC endpoint — xoá tất cả items khỏi giỏ hàng.
 */
export async function handleClearCart(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };

    await sessionService.clearCartItems(sessionId);

    res.status(200).json({
      success: true,
      data: [],
    });
  } catch (error: any) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ success: false, message: error.message ?? 'Internal server error' });
  }
}

// ─── POST /api/sessions/:sessionId/request-payment ────────────────────────────
/**
 * PUBLIC endpoint — khách chọn phương thức thanh toán từ trang QR Menu.
 * method = 'COUNTER': chỉ trả thông báo "ra quầy".
 * method = 'VIETQR' : tạo Payment PENDING, sinh QR URL, emit payment:pending tới POS cashier.
 *
 * Phương án A (cashierId): tìm Shift OPEN đang có của branch → dùng cashierId của ca đó.
 */
export async function requestPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { method, customerPhone, usePoints, pointsToUse } = req.body as {
      method?: 'COUNTER' | 'VIETQR';
      customerPhone?: string;
      usePoints?: boolean;
      pointsToUse?: number;
    };

    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId.' });
      return;
    }

    if (!method || !['COUNTER', 'VIETQR'].includes(method)) {
      res.status(400).json({ success: false, message: 'method phải là "COUNTER" hoặc "VIETQR".' });
      return;
    }

    // Lấy session cùng thông tin bàn (cần tenantId, branchId)
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orderItems: { where: { status: { not: 'VOID' } } },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Phiên không tồn tại.' });
      return;
    }

    if (session.status !== 'OPEN') {
      res.status(400).json({ success: false, message: 'Phiên đã kết thúc, không thể thanh toán.' });
      return;
    }

    const { tenantId, branchId } = session;

    // Tính tiền món (không bao gồm món VOID)
    const placedItemsForPoints = session.orderItems.filter(i => i.status !== 'VOID');
    const subtotalForPoints = placedItemsForPoints.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0);

    const pointsResult = await calculateCustomerPoints({
      tenantId,
      customerPhone,
      usePoints,
      pointsToUse,
      subtotal: subtotalForPoints,
    }, prisma as any);

    const customerId = pointsResult.customerId;
    const cleanPhone = pointsResult.cleanPhone;
    const pointsEarned = pointsResult.pointsEarned;
    const pointsRedeemed = pointsResult.pointsRedeemed;
    const pointsDiscountAmount = pointsResult.pointsDiscountAmount;

    // Tính tổng tiền thực tế từ các order item (tất cả món chưa bị VOID)
    const placedItems = session.orderItems.filter(i => i.status !== 'VOID');
    if (placedItems.length === 0) {
      res.status(400).json({ success: false, message: 'Chưa có món nào được gọi để thanh toán.' });
      return;
    }

    const subtotal = placedItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0);
    const tax = Math.round(subtotal * 0.1);
    const total = Math.max(0, subtotal - pointsDiscountAmount + tax);

    // ── COUNTER: không cần tạo payment, chỉ hướng dẫn khách ra quầy ──
    if (method === 'COUNTER') {
      res.status(200).json({
        success: true,
        method: 'COUNTER',
        message: 'Vui lòng di chuyển ra quầy thu ngân để thanh toán.',
        total,
      });
      return;
    }

    // ── VIETQR: Tạo Payment PENDING + sinh QR URL ──

    // Kiểm tra nếu đã có Payment PENDING rồi → trả lại QR cũ (idempotent)
    const existingPending = await prisma.payment.findFirst({
      where: { sessionId, status: PaymentStatus.PENDING },
    });

    if (existingPending && existingPending.paymentCode) {
      const bankAccount = await prisma.tenantBankAccount.findFirst({
        where: { tenantId, isActive: true, OR: [{ branchId }, { branchId: null }] },
        orderBy: { isDefault: 'desc' },
      });

      if (bankAccount) {
        const qrUrl = buildVietQrUrl({
          bankId: bankAccount.bankId,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
          amount: existingPending.total,
          addInfo: existingPending.paymentCode,
        });

        res.status(200).json({
          success: true,
          method: 'VIETQR',
          paymentId: existingPending.id,
          paymentCode: existingPending.paymentCode,
          qrUrl,
          subtotal: Number(existingPending.subtotal),
          tax: Math.round(Number(existingPending.subtotal) * 0.1),
          discountAmount: Number(existingPending.discountAmount || 0),
          pointsRedeemed: existingPending.pointsRedeemed || 0,
          total: Number(existingPending.total),
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
        });
        return;
      }
    }

    // Phương án A: Tìm Shift OPEN của branch để lấy cashierId
    const openShift = await prisma.shift.findFirst({
      where: { tenantId, branchId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      select: { id: true, cashierId: true },
    });

    if (!openShift) {
      res.status(400).json({
        success: false,
        message: 'Nhà hàng chưa mở ca thu ngân. Vui lòng thanh toán tại quầy.',
      });
      return;
    }

    const provider = PaymentFactory.getProvider('VIETQR');

    const { payment, providerData } = await prisma.$transaction(async (tx) => {
      // Xoá các payment cũ chưa thành công (PENDING / FAILED) của session này để không bị vướng Unique Constraint
      await tx.payment.deleteMany({ where: { sessionId, status: { not: PaymentStatus.SUCCESS } } });
      return provider.createPayment({
        sessionId,
        cashierId: openShift.cashierId,
        tenantId,
        branchId,
        method: 'TRANSFER',
        provider: 'VIETQR',
        subtotal,
        discountAmount: pointsDiscountAmount,
        total,
        customerId,
        customerPhone: cleanPhone,
        pointsEarned,
        pointsRedeemed,
        pointsDiscountAmount,
      }, tx);
    });

    const finalTotal = Number(payment.total);

    // Emit socket event tới POS cashier để lock nút thanh toán bàn này
    emitPaymentPending(tenantId, branchId, session.tableId || sessionId, {
      sessionId,
      tableId: session.tableId || sessionId,
      tableNumber: session.table?.tableNumber ?? 0,
      label: session.table?.label ?? 'Mang về',
      paymentId: payment.id,
      paymentCode: payment.paymentCode!,
      total: finalTotal,
      qrUrl: (providerData as any).qrUrl,
      bankName: (providerData as any).bankName,
      accountNumber: (providerData as any).accountNumber,
      accountName: (providerData as any).accountName,
    });

    res.status(200).json({
      success: true,
      method: 'VIETQR',
      paymentId: payment.id,
      paymentCode: payment.paymentCode,
      qrUrl: (providerData as any).qrUrl,
      subtotal: Number(payment.subtotal),
      tax: Math.round(Number(payment.subtotal) * 0.1),
      discountAmount: Number(payment.discountAmount || 0),
      pointsRedeemed: payment.pointsRedeemed || 0,
      total: finalTotal,
      bankName: (providerData as any).bankName,
      accountNumber: (providerData as any).accountNumber,
      accountName: (providerData as any).accountName,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
      return;
    }
    console.error('[requestPaymentHandler] error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ.' });
  }
}

/**
 * PUBLIC endpoint — khách hủy yêu cầu VietQR (đóng modal / quay lại / đổi ý ra quầy).
 * POST /api/sessions/:sessionId/cancel-payment
 */
export async function cancelPaymentRequestHandler(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params as { sessionId: string };

    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId.' });
      return;
    }

    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Phiên không tồn tại.' });
      return;
    }

    // Xoá các payment status PENDING của session này
    await prisma.payment.deleteMany({
      where: { sessionId, status: PaymentStatus.PENDING },
    });

    const { tenantId, branchId } = session;
    const tableId = session.tableId || session.id;
    const tableNumber = session.table?.tableNumber ?? 0;

    emitPaymentCancelled(tenantId, branchId, tableId, {
      sessionId,
      tableId,
      tableNumber,
    });

    res.status(200).json({
      success: true,
      message: 'Đã hủy yêu cầu chuyển khoản thành công.',
    });
  } catch (error: any) {
    console.error('[cancelPaymentRequestHandler] error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ.' });
  }
}

// ─── POST /api/sessions/offline-sync ──────────────────────────────────────────
/**
 * PUBLIC endpoint — đồng bộ hành động offline khi client có mạng trở lại.
 * Nhận mảng actions, xử lý từng action, trả về kết quả cho từng action.
 */
export async function offlineSyncHandler(req: Request, res: Response): Promise<void> {
  try {
    const { actions } = req.body as {
      actions: Array<{ id: string; type: string; payload: Record<string, any> }>;
    };

    if (!Array.isArray(actions) || actions.length === 0) {
      ApiResponse.error(res, 'INVALID_INPUT', 'actions must be a non-empty array', 400);
      return;
    }

    const results = await Promise.allSettled(
      actions.map(async (action) => {
        try {
          switch (action.type) {
            case 'ADD_ORDER_ITEMS': {
              const { sessionId, menuItemId, qty, note, clientTimestamp, itemDiscountType, itemDiscountValue } = action.payload;
              if (!sessionId || !menuItemId) {
                return { clientId: action.id, success: false, error: 'Missing required fields' };
              }
              await sessionService.addToCart(
                sessionId,
                menuItemId,
                qty || 1,
                note || '',
                clientTimestamp || Date.now(),
                itemDiscountType || null,
                itemDiscountValue || null
              );
              return { clientId: action.id, success: true };
            }

            default:
              return { clientId: action.id, success: false, error: `Unknown action type: ${action.type}` };
          }
        } catch (err: any) {
          if (err.code === 'P2002') {
            return { clientId: action.id, success: true };
          }
          return { clientId: action.id, success: false, error: err.message || 'Internal error' };
        }
      })
    );

    const data = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { clientId: 'unknown', success: false, error: 'Internal error' }
    );

    ApiResponse.success(res, data, 'Offline sync completed');
  } catch (err: any) {
    ApiResponse.error(res, 'SYNC_ERROR', err.message || 'Sync failed', 500);
  }
}
