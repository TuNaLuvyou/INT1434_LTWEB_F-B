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
  addItem: (item: Omit<CartItem, 'qty' | 'note'>) => void;

  /**
   * Giảm qty xuống 1, nếu qty về 0 thì xóa khỏi items.
   */
  removeItem: (menuItemId: string) => void;

  /**
   * Set qty trực tiếp. Nếu qty <= 0 thì xóa item khỏi cart.
   */
  updateQty: (menuItemId: string, qty: number) => void;

  /**
   * Cập nhật ghi chú cho một item.
   */
  updateNote: (menuItemId: string, note: string) => void;

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
          data: { session: { id: string; tableId: string }; isNew: boolean };
        };

        set({
          sessionId: data.session.id,
          tableId: data.session.tableId,
        });

        return { sessionId: data.session.id, isNew: data.isNew };
      },

      // ── addItem ───────────────────────────────────────────────────────────
      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.menuItemId === item.menuItemId
                  ? { ...i, qty: i.qty + 1 }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, qty: 1, note: '' },
            ],
          };
        });
      },

      // ── removeItem ────────────────────────────────────────────────────────
      removeItem: (menuItemId) => {
        set((state) => {
          const item = state.items.find((i) => i.menuItemId === menuItemId);
          if (!item) return state;

          if (item.qty <= 1) {
            return { items: state.items.filter((i) => i.menuItemId !== menuItemId) };
          }
          return {
            items: state.items.map((i) =>
              i.menuItemId === menuItemId ? { ...i, qty: i.qty - 1 } : i
            ),
          };
        });
      },

      // ── updateQty ─────────────────────────────────────────────────────────
      updateQty: (menuItemId, qty) => {
        if (qty <= 0) {
          set((state) => ({
            items: state.items.filter((i) => i.menuItemId !== menuItemId),
          }));
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, qty } : i
          ),
        }));
      },

      // ── updateNote ────────────────────────────────────────────────────────
      updateNote: (menuItemId, note) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, note } : i
          ),
        }));
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
