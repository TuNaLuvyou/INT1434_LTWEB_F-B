/**
 * socket.ts — Shared types cho Socket.io events (dùng ở cả frontend và types layer)
 */

export interface CashierNewOrderPayload {
  sessionId: string;
  tableId: string;
  tableNumber?: number;
  newItems: Array<{
    id?: string;
    menuItemId: string;
    menuItemName: string;
    qty: number;
    unitPrice: number;
    note?: string;
  }>;
  total: number;
  createdAt: string;
}
