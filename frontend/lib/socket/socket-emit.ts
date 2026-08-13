/**
 * socket-emit.ts — Helper gọi backend để emit Socket.io từ Next.js Server Action
 *
 * ─── Tại sao không import backend emit.helpers.ts trực tiếp? ────────────────
 * Frontend (Next.js) và Backend (Express) là 2 process riêng biệt.
 * Frontend không thể import module của backend (khác runtime, khác port).
 * Giải pháp: tạo internal API endpoint trên backend, Server Action gọi HTTP.
 *
 * Alternative: nếu monorepo share code, có thể dùng shared package.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CashierNewOrderPayload } from '@/types/socket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function internalEmit(endpoint: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_SECRET || '',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Emit endpoint ${endpoint} trả về ${res.status}`);
  }
}

/**
 * Gọi internal backend endpoint để emit cashier:new-order event.
 * Gracefully fail nếu backend không available (log warning, không throw).
 */
export async function emitCashierNewOrder(
  payload: CashierNewOrderPayload
): Promise<void> {
  await internalEmit('/api/sessions/emit/cashier-new-order', payload as any);
}

/**
 * Gọi internal backend endpoint để emit cart:updated event.
 * Dùng sau khi submitOrder để đồng bộ giỏ hàng về empty cho các thiết bị khác cùng bàn.
 */
export async function emitCartUpdatedAfterSubmit(payload: {
  tenantId: string;
  branchId: string;
  tableId: string;
  sessionId: string;
}): Promise<void> {
  await internalEmit('/api/sessions/emit/cart-updated', payload as any);
}
