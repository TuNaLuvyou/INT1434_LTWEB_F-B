/**
 * emit.helpers.ts — Helper functions để emit Socket.io events từ controllers
 *
 * ─── Tại sao cần file này? ──────────────────────────────────────────────────
 * - Controller không nên import getIO() trực tiếp → coupling cao.
 * - Helpers che giấu detail room name, io instance, event name.
 * - Nếu đổi tên room/event, chỉ sửa ở đây, không cần tìm khắp codebase.
 * - TypeScript type-safe payload cho từng event.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getIO } from './index';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './events';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartUpdatedPayload {
  sessionId: string;
  tableId: string;
  orderItems: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    qty: number;
    unitPrice: number;
    status: string;
  }>;
  total: number;
  isLocked?: boolean;
  message?: string;
}

export interface TableStatusChangedPayload {
  tableId: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  tableNumber?: number;
  label?: string;
}

export interface SessionClosedPayload {
  sessionId: string;
  tableId: string;
  status: 'PAID' | 'CANCELLED';
  closedAt: string;
}

export interface SessionAllDonePayload {
  sessionId: string;
  tableId: string;
  tableNumber?: number;
  label?: string;
}

export interface KitchenTicketPayload {
  sessionId: string;
  orderNo?: string;
  tableId: string;
  tableNumber?: number;
  label?: string;
  tableLabel?: string;
  items: Array<{
    orderItemId: string;
    menuItemName: string;
    qty: number;
    note?: string;
    status: string;
  }>;
  createdAt: string;
}

export interface KitchenItemUpdatedPayload {
  orderItemId: string;
  sessionId: string;
  tableId: string;
  menuItemName?: string;
  qty?: number;
  deltaQty?: number;
  note?: string | null;
  removedOrderItemId?: string;
  status: 'PREPARING' | 'DONE' | 'DELIVERED' | 'VOID';
  updatedAt: string;
}

export interface OrderStatusChangedPayload {
  orderItemId: string;
  menuItemId?: string;
  sessionId: string;
  tableId: string;
  status: 'PENDING' | 'PREPARING' | 'DONE' | 'DELIVERED' | 'VOID';
  menuItemName?: string;
  updatedAt: string;
}

export interface CashierNewOrderPayload {
  sessionId: string;
  tableId: string;
  tableNumber?: number;
  newItems: Array<{
    menuItemId: string;
    menuItemName: string;
    qty: number;
    unitPrice: number;
    note?: string;
  }>;
  total: number;
  createdAt: string;
}

// ─── Cart & Session helpers ───────────────────────────────────────────────────

/**
 * Emit khi giỏ hàng của bàn thay đổi.
 * Target: room table:[tableId]
 */
export function emitCartUpdated(tenantId: string, branchId: string, tableId: string, payload: CartUpdatedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.CART_UPDATED, payload);
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.CART_UPDATED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.CART_UPDATED, payload);
    logger.info('emit', `cart:updated → room table:${tableId} & cashier`);
  } catch (err) {
    logger.warn('emit', 'emitCartUpdated failed (socket chưa init?):', err);
  }
}

/**
 * Emit khi cashier đóng bill hoặc huỷ session.
 * Target: room table:[tableId] → khách thấy modal "Phiên kết thúc"
 *         room cashier → cập nhật sơ đồ bàn realtime
 */
export function emitSessionClosed(tenantId: string, branchId: string, tableId: string, payload: SessionClosedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.SESSION_CLOSED, payload);
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.SESSION_CLOSED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.SESSION_CLOSED, payload);
    logger.info('emit', `session:closed → table:${tableId} & cashier | status: ${payload.status}`);
  } catch (err) {
    logger.warn('emit', 'emitSessionClosed failed:', err);
  }
}

/**
 * Emit khi tất cả order items trong session đã hoàn thành (DONE).
 * Target: room cashier → thông báo thu ngân có thể tính tiền
 */
export function emitSessionAllDone(tenantId: string, branchId: string, payload: SessionAllDonePayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.SESSION_ALL_DONE, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.SESSION_ALL_DONE, payload);
    logger.info('emit', `session:all-done → cashier | session: ${payload.sessionId}`);
  } catch (err) {
    logger.warn('emit', 'emitSessionAllDone failed:', err);
  }
}

// ─── Floor Plan helpers ───────────────────────────────────────────────────────

/**
 * Emit khi trạng thái bàn thay đổi.
 * Target: room floor-plan → staff/admin cập nhật sơ đồ bàn realtime
 */
export function emitTableStatusChanged(tenantId: string, branchId: string, payload: TableStatusChangedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.FLOOR_PLAN(tenantId, branchId)).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, payload);
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, payload);
    logger.info('emit', `table:status-changed → floor-plan & cashier | table ${payload.tableId}: ${payload.status}`);
  } catch (err) {
    logger.warn('emit', 'emitTableStatusChanged failed:', err);
  }
}

// ─── Kitchen helpers ──────────────────────────────────────────────────────────

/**
 * Emit khi có order mới cần bếp xử lý.
 * Target: room kitchen → KDS bếp hiển thị ticket mới
 */
export function emitKitchenNewTicket(tenantId: string, branchId: string, payload: KitchenTicketPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.KITCHEN(tenantId, branchId)).emit(SOCKET_EVENTS.KITCHEN_NEW_TICKET, payload);
    logger.info('emit', `kitchen:new-ticket → kitchen | session: ${payload.sessionId}`);
  } catch (err) {
    logger.warn('emit', 'emitKitchenNewTicket failed:', err);
  }
}

/**
 * Emit khi KDS cập nhật trạng thái item.
 * Target: room kitchen (broadcast cho các KDS khác nếu nhiều màn hình)
 */
export function emitKitchenItemUpdated(tenantId: string, branchId: string, payload: KitchenItemUpdatedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.KITCHEN(tenantId, branchId)).emit(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, payload);
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, payload);
    logger.info('emit', `kitchen:item-updated → kitchen & cashier | item: ${payload.orderItemId} → ${payload.status}`);
  } catch (err) {
    logger.warn('emit', 'emitKitchenItemUpdated failed:', err);
  }
}

/**
 * Emit khi status của order item thay đổi.
 * Target: room table:[tableId] → khách theo dõi tiến độ món ăn
 */
export function emitOrderStatusChanged(tableId: string, payload: OrderStatusChangedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.ORDER_STATUS_CHANGED, payload);
    logger.info('emit', `order:status-changed → table:${tableId} | item: ${payload.orderItemId} → ${payload.status}`);
  } catch (err) {
    logger.warn('emit', 'emitOrderStatusChanged failed:', err);
  }
}

// ─── Cashier helpers ──────────────────────────────────────────────────────────

/**
 * Emit khi khách submit order mới từ QR.
 * Target: room cashier → thu ngân nhận notification order mới
 */
export function emitCashierNewOrder(tenantId: string, branchId: string, payload: CashierNewOrderPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.CASHIER_NEW_ORDER, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.CASHIER_NEW_ORDER, payload);
    logger.info('emit', `cashier:new-order → cashier | session: ${payload.sessionId}`);
  } catch (err) {
    logger.warn('emit', 'emitCashierNewOrder failed:', err);
  }
}


// ─── Payment helpers ──────────────────────────────────────────────────────────

export interface PaymentPendingPayload {
  sessionId: string;
  tableId: string;
  tableNumber?: number;
  label?: string;
  paymentId: string;
  paymentCode: string;
  total: number;
  qrUrl: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface PaymentCompletedPayload {
  sessionId: string;
  tableId: string;
  paymentId: string;
  total: number;
  paidAt: string;
}

/**
 * Emit khi khách chọn thanh toán VietQR tại bàn.
 * Target: room cashier (POS lock nút) + room table (khách thấy QR đang chờ)
 */
export function emitPaymentPending(tenantId: string, branchId: string, tableId: string, payload: PaymentPendingPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.PAYMENT_PENDING, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.PAYMENT_PENDING, payload);
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.PAYMENT_PENDING, payload);
    logger.info('emit', `payment:pending → cashier + table:${tableId} | payment: ${payload.paymentId}`);
  } catch (err) {
    logger.warn('emit', 'emitPaymentPending failed:', err);
  }
}

/**
 * Emit khi cashier xác nhận đã nhận tiền (confirm manual VietQR).
 * Target: room cashier + room table (khách thấy màn hình thanh toán thành công)
 */
export function emitPaymentCompleted(tenantId: string, branchId: string, tableId: string, payload: PaymentCompletedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.PAYMENT_COMPLETED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.PAYMENT_COMPLETED, payload);
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.PAYMENT_COMPLETED, payload);
    logger.info('emit', `payment:completed → cashier + table:${tableId} | payment: ${payload.paymentId}`);
  } catch (err) {
    logger.warn('emit', 'emitPaymentCompleted failed:', err);
  }
}

/**
 * Emit khi khách huỷ yêu cầu VietQR (chuyển sang trả tại quầy).
 */
export function emitPaymentCancelled(tenantId: string, branchId: string, tableId: string, payload: { sessionId: string; tableId: string; tableNumber?: number }): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER(tenantId, branchId)).emit(SOCKET_EVENTS.PAYMENT_CANCELLED, payload);
    getIO().to(SOCKET_ROOMS.TENANT_CASHIER(tenantId)).emit(SOCKET_EVENTS.PAYMENT_CANCELLED, payload);
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.PAYMENT_CANCELLED, payload);
    logger.info('emit', `payment:cancelled → cashier + table:${tableId} | session: ${payload.sessionId}`);
  } catch (err) {
    logger.warn('emit', 'emitPaymentCancelled failed:', err);
  }
}

