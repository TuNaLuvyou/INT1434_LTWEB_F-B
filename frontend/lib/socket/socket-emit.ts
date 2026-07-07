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

/**
 * Gọi internal backend endpoint để emit cashier:new-order event.
 * Gracefully fail nếu backend không available (log warning, không throw).
 */
export async function emitCashierNewOrder(
  payload: CashierNewOrderPayload
): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/emit/cashier-new-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal secret để backend validate nguồn gốc request
      'X-Internal-Secret': process.env.INTERNAL_SECRET || 'hiaimenugo-internal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Emit endpoint trả về ${res.status}`);
  }
}
