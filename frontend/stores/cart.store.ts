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
  isLocked: boolean; // Trạng thái khóa giỏ hàng của bàn
  isGeofenceEnabled: boolean; // Trạng thái định vị giới hạn đặt món của quán

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
      isLocked: false,
      isGeofenceEnabled: false,

      initSession: async (tableId: string) => {
        const state = get();

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
          data: { session: { id: string; tableId: string; lockedAt?: string | null }; isNew: boolean; serverTime?: number; isGeofenceEnabled?: boolean };
        };

        const serverTime = data.serverTime || Date.now();
        const clockOffset = serverTime - Date.now();

        const isLocked = Boolean(data.session.lockedAt);
        const isGeofenceEnabled = Boolean(data.isGeofenceEnabled);

        // Nếu session ID thay đổi (phiên cũ đã đóng, phiên mới được tạo)
        if (state.sessionId !== data.session.id) {
          set({
            sessionId: data.session.id,
            tableId: data.session.tableId,
            items: [], // Reset giỏ hàng của phiên cũ
            clockOffset,
            isLocked,
            isGeofenceEnabled,
          });
        } else {
          set({
            sessionId: data.session.id,
            tableId: data.session.tableId,
            clockOffset,
            isLocked,
            isGeofenceEnabled,
          });
        }

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
        const previousItems = state.items;

        // OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức
        set({
          items: existing
            ? state.items.map((i) => (i.menuItemId === item.menuItemId ? { ...i, qty: newQty } : i))
            : [...state.items, { ...item, qty: 1, note: '' }],
        });

        // Fire and forget (chạy ngầm)
        (async () => {
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
                get().syncCartFromServer(data.currentCart);
              }
              return;
            }

            if (res.status === 423) {
              const data = await res.json().catch(() => ({}));
              set({ items: previousItems, isLocked: true, submitError: data.message || 'Order đang được chuẩn bị bởi nhà hàng' });
              window.dispatchEvent(new CustomEvent('cart-locked', { detail: { message: data.message } }));
              return;
            }

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              
              if (res.status === 400 && data.message === 'Phiên đặt món đã kết thúc') {
                console.log('[cartStore] Phát hiện phiên đã kết thúc trên server.');
                set({ sessionId: null, items: [] });
                window.dispatchEvent(new CustomEvent('session-closed', { detail: { status: 'UNKNOWN' } }));
                return;
              }
              
              throw new Error(data.message || `HTTP ${res.status}`);
            }

            const { data: updatedCart } = await res.json() as { data: any[] };
            get().syncCartFromServer(updatedCart);
          } catch (err: any) {
            console.error('[cartStore] addItem failed:', err);
            set({ items: previousItems, submitError: err.message || 'Lỗi thêm món' });
          }
        })();
        
        return Promise.resolve(); // Trả về ngay lập tức để UI không bị block
      },

      // ── removeItem ────────────────────────────────────────────────────────
      removeItem: async (menuItemId) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        const newQty = item.qty - 1;
        const previousItems = state.items;

        // OPTIMISTIC UPDATE
        set({
          items: newQty <= 0
            ? state.items.filter((i) => i.menuItemId !== menuItemId)
            : state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, qty: newQty } : i)),
        });

        // Chạy ngầm
        (async () => {
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
                get().syncCartFromServer(data.currentCart);
              }
              return;
            }

            if (res.status === 423) {
              const data = await res.json().catch(() => ({}));
              set({ items: previousItems, isLocked: true, submitError: data.message || 'Order đang được chuẩn bị bởi nhà hàng' });
              window.dispatchEvent(new CustomEvent('cart-locked', { detail: { message: data.message } }));
              return;
            }

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.message || `HTTP ${res.status}`);
            }

            const { data: updatedCart } = await res.json() as { data: any[] };
            get().syncCartFromServer(updatedCart);
          } catch (err: any) {
            console.error('[cartStore] removeItem failed:', err);
            set({ items: previousItems, submitError: err.message || 'Lỗi bớt món' });
          }
        })();
        
        return Promise.resolve();
      },

      // ── updateQty ─────────────────────────────────────────────────────────
      updateQty: async (menuItemId, qty) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        const note = item?.note || '';
        const previousItems = state.items;

        // OPTIMISTIC UPDATE
        set({
          items: qty <= 0
            ? state.items.filter((i) => i.menuItemId !== menuItemId)
            : state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, qty } : i)),
        });

        // Chạy ngầm
        (async () => {
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
                get().syncCartFromServer(data.currentCart);
              }
              return;
            }

            if (res.status === 423) {
              const data = await res.json().catch(() => ({}));
              set({ items: previousItems, isLocked: true, submitError: data.message || 'Order đang được chuẩn bị bởi nhà hàng' });
              window.dispatchEvent(new CustomEvent('cart-locked', { detail: { message: data.message } }));
              return;
            }

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.message || `HTTP ${res.status}`);
            }

            const { data: updatedCart } = await res.json() as { data: any[] };
            get().syncCartFromServer(updatedCart);
          } catch (err: any) {
            console.error('[cartStore] updateQty failed:', err);
            set({ items: previousItems, submitError: err.message || 'Lỗi cập nhật số lượng' });
          }
        })();
        
        return Promise.resolve();
      },

      // ── updateNote ────────────────────────────────────────────────────────
      updateNote: async (menuItemId, note) => {
        const state = get();
        if (!state.sessionId) return;

        const item = state.items.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        const previousItems = state.items;

        // OPTIMISTIC UPDATE
        set({
          items: state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, note } : i)),
        });

        // Chạy ngầm
        (async () => {
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
                get().syncCartFromServer(data.currentCart);
              }
              return;
            }

            if (res.status === 423) {
              const data = await res.json().catch(() => ({}));
              set({ items: previousItems, isLocked: true, submitError: data.message || 'Order đang được chuẩn bị bởi nhà hàng' });
              window.dispatchEvent(new CustomEvent('cart-locked', { detail: { message: data.message } }));
              return;
            }

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.message || `HTTP ${res.status}`);
            }

            const { data: updatedCart } = await res.json() as { data: any[] };
            get().syncCartFromServer(updatedCart);
          } catch (err: any) {
            console.error('[cartStore] updateNote failed:', err);
            set({ items: previousItems, submitError: err.message || 'Lỗi cập nhật ghi chú' });
          }
        })();
        
        return Promise.resolve();
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
      name: 'hiaimenugo-cart',

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
        isLocked: state.isLocked,
        isGeofenceEnabled: state.isGeofenceEnabled,
      }),
    }
  )
);
