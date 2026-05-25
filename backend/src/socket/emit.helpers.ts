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
  tableId: string;
  tableNumber?: number;
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
  tableId: string;
  menuItemName?: string;
  status: 'PREPARING' | 'DONE' | 'VOID';
  updatedAt: string;
}

export interface OrderStatusChangedPayload {
  orderItemId: string;
  sessionId: string;
  tableId: string;
  status: 'PENDING' | 'PREPARING' | 'DONE' | 'VOID';
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

export interface MenuSoldOutPayload {
  menuItemId: string;
  isSoldOut: boolean;
  menuItemName?: string;
}

// ─── Cart & Session helpers ───────────────────────────────────────────────────

/**
 * Emit khi giỏ hàng của bàn thay đổi.
 * Target: room table:[tableId]
 */
export function emitCartUpdated(tableId: string, payload: CartUpdatedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.CART_UPDATED, payload);
    console.log(`[emit] cart:updated → room table:${tableId}`);
  } catch (err) {
    console.warn('[emit] emitCartUpdated failed (socket chưa init?):', err);
  }
}

/**
 * Emit khi cashier đóng bill hoặc huỷ session.
 * Target: room table:[tableId] → khách thấy modal "Phiên kết thúc"
 */
export function emitSessionClosed(tableId: string, payload: SessionClosedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.SESSION_CLOSED, payload);
    console.log(`[emit] session:closed → room table:${tableId} | status: ${payload.status}`);
  } catch (err) {
    console.warn('[emit] emitSessionClosed failed:', err);
  }
}

/**
 * Emit khi tất cả order items trong session đã hoàn thành (DONE).
 * Target: room cashier → thông báo thu ngân có thể tính tiền
 */
export function emitSessionAllDone(payload: SessionAllDonePayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER).emit(SOCKET_EVENTS.SESSION_ALL_DONE, payload);
    console.log(`[emit] session:all-done → cashier | session: ${payload.sessionId}`);
  } catch (err) {
    console.warn('[emit] emitSessionAllDone failed:', err);
  }
}

/**
 * Emit khi một item trong giỏ hàng bị sold-out (bếp toggle).
 * Target: room table:[tableId]
 */
export function emitCartItemSoldOut(tableId: string, payload: { menuItemId: string; isSoldOut: boolean }): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.CART_ITEM_SOLD_OUT, payload);
    console.log(`[emit] cart:item-soldout → room table:${tableId} | item: ${payload.menuItemId}`);
  } catch (err) {
    console.warn('[emit] emitCartItemSoldOut failed:', err);
  }
}

// ─── Floor Plan helpers ───────────────────────────────────────────────────────

/**
 * Emit khi trạng thái bàn thay đổi.
 * Target: room floor-plan → staff/admin cập nhật sơ đồ bàn realtime
 */
export function emitTableStatusChanged(payload: TableStatusChangedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.FLOOR_PLAN).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, payload);
    getIO().to(SOCKET_ROOMS.CASHIER).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, payload);
    console.log(`[emit] table:status-changed → floor-plan & cashier | bàn ${payload.tableId}: ${payload.status}`);
  } catch (err) {
    console.warn('[emit] emitTableStatusChanged failed:', err);
  }
}

/**
 * Emit khi session của bàn được cập nhật (thêm order, thay đổi tổng).
 * Target: room floor-plan
 */
export function emitTableSessionUpdated(payload: { tableId: string; sessionId: string; total?: number }): void {
  try {
    getIO().to(SOCKET_ROOMS.FLOOR_PLAN).emit(SOCKET_EVENTS.TABLE_SESSION_UPDATED, payload);
    console.log(`[emit] table:session-updated → floor-plan | bàn ${payload.tableId}`);
  } catch (err) {
    console.warn('[emit] emitTableSessionUpdated failed:', err);
  }
}

// ─── Kitchen helpers ──────────────────────────────────────────────────────────

/**
 * Emit khi có order mới cần bếp xử lý.
 * Target: room kitchen → KDS bếp hiển thị ticket mới
 */
export function emitKitchenNewTicket(payload: KitchenTicketPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.KITCHEN).emit(SOCKET_EVENTS.KITCHEN_NEW_TICKET, payload);
    console.log(`[emit] kitchen:new-ticket → kitchen | session: ${payload.sessionId}`);
  } catch (err) {
    console.warn('[emit] emitKitchenNewTicket failed:', err);
  }
}

/**
 * Emit khi KDS cập nhật trạng thái item.
 * Target: room kitchen (broadcast cho các KDS khác nếu nhiều màn hình)
 */
export function emitKitchenItemUpdated(payload: KitchenItemUpdatedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.KITCHEN).emit(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, payload);
    console.log(`[emit] kitchen:item-updated → kitchen | item: ${payload.orderItemId} → ${payload.status}`);
  } catch (err) {
    console.warn('[emit] emitKitchenItemUpdated failed:', err);
  }
}

/**
 * Emit khi status của order item thay đổi.
 * Target: room table:[tableId] → khách theo dõi tiến độ món ăn
 */
export function emitOrderStatusChanged(tableId: string, payload: OrderStatusChangedPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.table(tableId)).emit(SOCKET_EVENTS.ORDER_STATUS_CHANGED, payload);
    console.log(`[emit] order:status-changed → table:${tableId} | item: ${payload.orderItemId} → ${payload.status}`);
  } catch (err) {
    console.warn('[emit] emitOrderStatusChanged failed:', err);
  }
}

// ─── Cashier helpers ──────────────────────────────────────────────────────────

/**
 * Emit khi khách submit order mới từ QR.
 * Target: room cashier → thu ngân nhận notification order mới
 */
export function emitCashierNewOrder(payload: CashierNewOrderPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER).emit(SOCKET_EVENTS.CASHIER_NEW_ORDER, payload);
    console.log(`[emit] cashier:new-order → cashier | session: ${payload.sessionId}`);
  } catch (err) {
    console.warn('[emit] emitCashierNewOrder failed:', err);
  }
}

/**
 * Emit khi cashier cần confirm void một item.
 * Target: room cashier
 */
export function emitCashierVoidConfirm(payload: { orderItemId: string; tableId: string; menuItemName: string }): void {
  try {
    getIO().to(SOCKET_ROOMS.CASHIER).emit(SOCKET_EVENTS.CASHIER_VOID_CONFIRM, payload);
    console.log(`[emit] cashier:void-confirm → cashier | item: ${payload.orderItemId}`);
  } catch (err) {
    console.warn('[emit] emitCashierVoidConfirm failed:', err);
  }
}

// ─── Menu helpers ─────────────────────────────────────────────────────────────

/**
 * Emit khi admin/bếp toggle sold-out một menu item.
 * Target: room menu-updates → tất cả trang /menu cập nhật realtime
 */
export function emitMenuSoldOut(payload: MenuSoldOutPayload): void {
  try {
    getIO().to(SOCKET_ROOMS.MENU_UPDATES).emit(SOCKET_EVENTS.MENU_SOLD_OUT, payload);
    console.log(`[emit] menu:soldout → menu-updates | item: ${payload.menuItemId} → isSoldOut: ${payload.isSoldOut}`);
  } catch (err) {
    console.warn('[emit] emitMenuSoldOut failed:', err);
  }
}
