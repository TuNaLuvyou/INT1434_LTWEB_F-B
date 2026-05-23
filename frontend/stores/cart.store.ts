/**
 * cart.store.ts — Zustand store cho giỏ hàng của khách tại bàn
 *
 * ─── Thiết kế ────────────────────────────────────────────────────────────────
 * - Persist qua sessionStorage (không phải localStorage) vì:
 *   + Cart chỉ cần tồn tại trong tab hiện tại (1 phiên trình duyệt)
 *   + Nếu khách mở tab mới → session mới, cart mới — tránh lẫn data
 *   + Refresh trang: cart vẫn còn (UX tốt hơn), không mất vì reload
 * - partialize: chỉ persist items/sessionId/tableId, KHÔNG persist
 *   isSubmitting/submitError (transient UI state, reset sau reload là đúng)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

/** CartItem lưu trữ trên client — denormalized để hiển thị không cần fetch lại */
export type CartItem = {
  menuItemId: string;
  name: string;       // Denormalize từ MenuItem khi add vào cart
  price: number;      // Decimal → number cho client (đơn vị VND)
  imageUrl: string | null;
  qty: number;
  note: string;
};

export type CartStore = {
  // ── State ──────────────────────────────────────────────────────────────────
  sessionId: string | null;
  tableId: string | null;
  items: CartItem[];
  isSubmitting: boolean;
  submitError: string | null;
  clockOffset: number; // Thêm clockOffset để bù giờ client-server

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Gọi POST /api/sessions/join để tạo/lấy session cho bàn.
   * Set sessionId và tableId vào store.
   * Throws nếu bàn không tồn tại (để caller redirect 404).
   */
  initSession: (tableId: string) => Promise<{ sessionId: string; isNew: boolean }>;

  /**
   * Thêm item vào cart.
   * - Nếu đã có (theo menuItemId): tăng qty lên 1
   * - Nếu chưa có: thêm mới với qty=1, note=""
   */
  addItem: (item: Omit<CartItem, 'qty' | 'note'>) => Promise<void>;

  /**
   * Giảm qty xuống 1, nếu qty về 0 thì xóa khỏi items.
   */
  removeItem: (menuItemId: string) => Promise<void>;

  /**
   * Set qty trực tiếp. Nếu qty <= 0 thì xóa item khỏi cart.
   */
  updateQty: (menuItemId: string, qty: number) => Promise<void>;

  /**
   * Cập nhật ghi chú cho một item.
   */
  updateNote: (menuItemId: string, note: string) => Promise<void>;

  /**
   * Đồng bộ toàn bộ giỏ hàng từ server.
   */
  syncCartFromServer: (items: any[]) => void;

  /**
   * Xóa toàn bộ items nhưng GIỮ sessionId (dùng sau khi submit thành công,
   * khách có thể gọi tiếp mà không cần scan QR lại).
   */
  clearCart: () => void;

  /** Computed: tổng tiền = sum(item.price * item.qty) */
  getTotalPrice: () => number;

  /** Computed: tổng số lượng = sum(item.qty) */
  getTotalItems: () => number;

  /** Reset submitError khi cần */
  clearSubmitError: () => void;

  /** Set trạng thái submitting từ ngoài (CartDrawer gọi) */
  setSubmitting: (v: boolean) => void;
  setSubmitError: (msg: string | null) => void;
};

// ─── Store implementation ─────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ─────────────────────────────────────────────────────
      sessionId: null,
      tableId: null,
      items: [],
      isSubmitting: false,
      submitError: null,
      clockOffset: 0,

      // ── initSession ───────────────────────────────────────────────────────
      initSession: async (tableId: string) => {
        // Nếu đã có session cho đúng bàn này → dùng lại, không gọi API
        const state = get();
        if (state.sessionId && state.tableId === tableId) {
          return { sessionId: state.sessionId, isNew: false };
        }

        const res = await fetch(`${API_URL}/api/sessions/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId }),
        });

        if (!res.ok) {
          // 404: bàn không tồn tại | 400: tableId không hợp lệ
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `HTTP ${res.status}`);
        }

        const { data } = await res.json() as {
          data: { session: { id: string; tableId: string }; isNew: boolean; serverTime?: number };
        };

        const serverTime = data.serverTime || Date.now();
        const clockOffset = serverTime - Date.now();

        set({
          sessionId: data.session.id,
          tableId: data.session.tableId,
          clockOffset,
        });

        return { sessionId: data.session.id, isNew: data.isNew };
      },

      // ── syncCartFromServer ────────────────────────────────────────────────
      syncCartFromServer: (items) => {
        const mappedItems = items.map((item: any) => ({
          menuItemId: item.menuItemId,
          name: item.menuItem?.name || item.menuItemName || '',
          price: Number(item.unitPrice),
          imageUrl: item.menuItem?.imageUrl || null,
          qty: item.qty,
          note: item.note || '',
        }));
        set({ items: mappedItems });
      },

      // ── addItem ───────────────────────────────────────────────────────────
      addItem: async (item) => {
        const state = get();
        if (!state.sessionId) return;

        const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
        const newQty = existing ? existing.qty + 1 : 1;

        try {
          const clientTimestamp = Date.now() + state.clockOffset;
          const res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menuItemId: item.menuItemId,
              qty: newQty,
              note: existing?.note || '',
              clientTimestamp,
            }),
          });

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            if (data.code === 'CONFLICT' && data.currentCart) {
              state.syncCartFromServer(data.currentCart);
            }
            return;
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || `HTTP ${res.status}`);
          }

          const { data: updatedCart } = await res.json() as { data: any[] };
          state.syncCartFromServer(updatedCart);
        } catch (err: any) {
          console.error('[cartStore] addItem failed:', err);
          set({ submitError: err.message || 'Lỗi thêm món' });
        }
      },

      // ── removeItem ────────────────────────────────────────────────────────
      removeItem: async (menuItemId) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        const newQty = item.qty - 1;
        try {
          const clientTimestamp = Date.now() + state.clockOffset;
          let res;
          if (newQty <= 0) {
            res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart/${menuItemId}?clientTimestamp=${clientTimestamp}`, {
              method: 'DELETE',
            });
          } else {
            res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                menuItemId,
                qty: newQty,
                note: item.note,
                clientTimestamp,
              }),
            });
          }

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            if (data.code === 'CONFLICT' && data.currentCart) {
              state.syncCartFromServer(data.currentCart);
            }
            return;
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || `HTTP ${res.status}`);
          }

          const { data: updatedCart } = await res.json() as { data: any[] };
          state.syncCartFromServer(updatedCart);
        } catch (err: any) {
          console.error('[cartStore] removeItem failed:', err);
          set({ submitError: err.message || 'Lỗi bớt món' });
        }
      },

      // ── updateQty ─────────────────────────────────────────────────────────
      updateQty: async (menuItemId, qty) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        const note = item?.note || '';

        try {
          const clientTimestamp = Date.now() + state.clockOffset;
          let res;
          if (qty <= 0) {
            res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart/${menuItemId}?clientTimestamp=${clientTimestamp}`, {
              method: 'DELETE',
            });
          } else {
            res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                menuItemId,
                qty,
                note,
                clientTimestamp,
              }),
            });
          }

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            if (data.code === 'CONFLICT' && data.currentCart) {
              state.syncCartFromServer(data.currentCart);
            }
            return;
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || `HTTP ${res.status}`);
          }

          const { data: updatedCart } = await res.json() as { data: any[] };
          state.syncCartFromServer(updatedCart);
        } catch (err: any) {
          console.error('[cartStore] updateQty failed:', err);
          set({ submitError: err.message || 'Lỗi cập nhật số lượng' });
        }
      },

      // ── updateNote ────────────────────────────────────────────────────────
      updateNote: async (menuItemId, note) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        try {
          const clientTimestamp = Date.now() + state.clockOffset;
          const res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menuItemId,
              qty: item.qty,
              note,
              clientTimestamp,
            }),
          });

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            if (data.code === 'CONFLICT' && data.currentCart) {
              state.syncCartFromServer(data.currentCart);
            }
            return;
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || `HTTP ${res.status}`);
          }

          const { data: updatedCart } = await res.json() as { data: any[] };
          state.syncCartFromServer(updatedCart);
        } catch (err: any) {
          console.error('[cartStore] updateNote failed:', err);
          set({ submitError: err.message || 'Lỗi cập nhật ghi chú' });
        }
      },

      // ── clearCart ─────────────────────────────────────────────────────────
      clearCart: () => {
        // Giữ sessionId/tableId để khách gọi tiếp không cần scan lại
        set({ items: [], submitError: null });
      },

      // ── Computed ──────────────────────────────────────────────────────────
      getTotalPrice: () => {
        return get().items.reduce((sum, i) => sum + i.price * i.qty, 0);
      },

      getTotalItems: () => {
        return get().items.reduce((sum, i) => sum + i.qty, 0);
      },

      // ── Helper setters ────────────────────────────────────────────────────
      clearSubmitError: () => set({ submitError: null }),
      setSubmitting: (v) => set({ isSubmitting: v }),
      setSubmitError: (msg) => set({ submitError: msg }),
    }),

    {
      name: 'restoflow-cart',

      // Dùng sessionStorage: tồn tại trong tab, mất khi đóng tab
      storage: createJSONStorage(() => {
        // SSR guard: sessionStorage chỉ có ở client
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.sessionStorage;
      }),

      // Chỉ persist dữ liệu cart, KHÔNG persist UI state
      partialize: (state) => ({
        items: state.items,
        sessionId: state.sessionId,
        tableId: state.tableId,
      }),
    }
  )
);
