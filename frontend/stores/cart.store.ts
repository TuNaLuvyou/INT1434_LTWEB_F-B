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
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { enqueueAction, getQueueCount } from '@/lib/offline/queue';
import { useOfflineStore } from '@/stores/offline.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

/** CartItem lưu trữ trên client — denormalized để hiển thị không cần fetch lại */
export type CartItem = {
  menuItemId: string;
  name: string;
  englishName?: string | null;
  price: number;
  imageUrl: string | null;
  qty: number;
  note: string;
  itemDiscountType?: 'PERCENT' | 'FIXED' | null;
  itemDiscountValue?: number | null;
};

type HistoryItem = CartItem & { status?: string };

export type CartStore = {
  // ── State ──────────────────────────────────────────────────────────────────
  sessionId: string | null;
  tableId: string | null;
  tenantId: string | null;
  branchId: string | null;
  items: CartItem[];
  isSubmitting: boolean;
  submitError: string | null;
  clockOffset: number; // Thêm clockOffset để bù giờ client-server
  isLocked: boolean; // Trạng thái khóa giỏ hàng của bàn
  isGeofenceEnabled: boolean; // Trạng thái định vị giới hạn đặt món của quán
  lastOrder: HistoryItem[] | null;
  isSessionClosed: boolean;
  sessionClosedStatus: 'PAID' | 'CANCELLED' | 'UNKNOWN' | null;

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
  addItem: (item: Omit<CartItem, 'qty' | 'note'> & { qty?: number; note?: string; englishName?: string | null }) => Promise<void>;

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

  /** Lưu lịch sử đơn hàng đã gửi */
  setLastOrder: (items: HistoryItem[] | null) => void;

  /** Set trạng thái session đã đóng */
  setSessionClosed: (status: 'PAID' | 'CANCELLED' | 'UNKNOWN' | null) => void;
};

// ─── Store implementation ─────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => {
      // ── Helper dùng chung: chạy request giỏ hàng ngầm (fire & forget) ────
      // Xử lý các trường hợp lỗi nghiệp vụ: 409 conflict (thiết bị khác sửa cart),
      // 423 locked (nhà hàng đã duyệt), 400 session-closed (phiên đã kết thúc).
      const runCartMutation = async (
        previousItems: CartItem[],
        buildRequest: () => Promise<Response>,
        logLabel: string,
        fallbackError: string,
        detectSessionClosed = false
      ) => {
        try {
          const res = await buildRequest();

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

            if (detectSessionClosed && res.status === 400 && data.message === 'Phiên đặt món đã kết thúc') {
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
          console.error(`[cartStore] ${logLabel} failed:`, err);
          set({ items: previousItems, submitError: err.message || fallbackError });
        }
      };

      return {
      // ── Initial state ─────────────────────────────────────────────────────
      sessionId: null,
      tableId: null,
      tenantId: null,
      branchId: null,
      items: [],
      isSubmitting: false,
      submitError: null,
      clockOffset: 0,
      isLocked: false,
      isGeofenceEnabled: false,
      lastOrder: null,
      isSessionClosed: false,
      sessionClosedStatus: null,

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
          data: { session: { id: string; tableId: string; lockedAt?: string | null }; isNew: boolean; serverTime?: number; isGeofenceEnabled?: boolean; tenantId?: string; branchId?: string };
        };

        const serverTime = data.serverTime || Date.now();
        const clockOffset = serverTime - Date.now();

        const isLocked = Boolean(data.session.lockedAt);
        const isGeofenceEnabled = Boolean(data.isGeofenceEnabled);

        const branchChanged = state.branchId && data.branchId && state.branchId !== data.branchId;
        const sessionChanged = state.sessionId !== data.session.id;

        if (branchChanged || sessionChanged) {
          set({
            sessionId: data.session.id,
            tableId: data.session.tableId,
            tenantId: data.tenantId ?? state.tenantId,
            branchId: data.branchId ?? state.branchId,
            items: [],
            clockOffset,
            isLocked,
            isGeofenceEnabled,
            lastOrder: null,
            isSessionClosed: false,
            sessionClosedStatus: null,
          });
        } else {
          set({
            sessionId: data.session.id,
            tableId: data.session.tableId,
            tenantId: data.tenantId ?? state.tenantId,
            branchId: data.branchId ?? state.branchId,
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
          englishName: item.menuItem?.englishName || null,
          price: Number(item.unitPrice),
          imageUrl: item.menuItem?.imageUrl || null,
          qty: item.qty,
          note: item.note || '',
          itemDiscountType: item.itemDiscountType || null,
          itemDiscountValue: item.itemDiscountValue ? Number(item.itemDiscountValue) : null,
        }));
        set({ items: mappedItems });
      },

      // ── addItem ───────────────────────────────────────────────────────────
      addItem: async (item) => {
        const state = get();
        if (!state.sessionId) return;

        const addQty = item.qty && item.qty > 0 ? item.qty : 1;
        const addNote = item.note || '';

        const existing = state.items.find((i) => i.menuItemId === item.menuItemId && (i.note || '') === addNote);
        const newQty = existing ? existing.qty + addQty : addQty;
        const previousItems = state.items;

        // OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức
        set({
          items: existing
            ? state.items.map((i) => (i.menuItemId === item.menuItemId && (i.note || '') === addNote ? { ...i, qty: newQty } : i))
            : [...state.items, { ...item, qty: addQty, note: addNote }],
        });

        // Chạy ngầm (fire & forget) — nếu offline thì đưa vào hàng đợi
        const isOffline = useOfflineStore.getState().isOffline;
        if (isOffline) {
          try {
            await enqueueAction('ADD_ORDER_ITEMS', {
              sessionId: state.sessionId,
              menuItemId: item.menuItemId,
              qty: newQty,
              note: existing?.note || '',
              clientTimestamp: Date.now() + state.clockOffset,
              itemDiscountType: item.itemDiscountType || null,
              itemDiscountValue: item.itemDiscountValue || null,
            });
            const count = await getQueueCount();
            useOfflineStore.getState().setPendingCount(count);
          } catch (err) {
            console.error('[cartStore] enqueue offline failed:', err);
          }
          return;
        }

        const clientTimestamp = Date.now() + state.clockOffset;
        void runCartMutation(
          previousItems,
          () => fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menuItemId: item.menuItemId,
              qty: newQty,
              note: addNote,
              clientTimestamp,
              itemDiscountType: item.itemDiscountType || null,
              itemDiscountValue: item.itemDiscountValue || null,
            }),
            keepalive: true,
          }),
          'addItem',
          'Lỗi thêm món',
          true // detectSessionClosed: phiên đã kết thúc → reset store
        );
        
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

        // Chạy ngầm (fire & forget)
        const clientTimestamp = Date.now() + state.clockOffset;
        void runCartMutation(
          previousItems,
          () => newQty <= 0
            ? fetch(`${API_URL}/api/sessions/${state.sessionId}/cart/${menuItemId}?clientTimestamp=${clientTimestamp}`, {
                method: 'DELETE',
                keepalive: true,
              })
            : fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuItemId, qty: newQty, note: item.note, clientTimestamp }),
                keepalive: true,
              }),
          'removeItem',
          'Lỗi bớt món'
        );
        
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

        // Chạy ngầm (fire & forget)
        const clientTimestamp = Date.now() + state.clockOffset;
        void runCartMutation(
          previousItems,
          () => qty <= 0
            ? fetch(`${API_URL}/api/sessions/${state.sessionId}/cart/${menuItemId}?clientTimestamp=${clientTimestamp}`, {
                method: 'DELETE',
                keepalive: true,
              })
            : fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuItemId, qty, note, clientTimestamp }),
                keepalive: true,
              }),
          'updateQty',
          'Lỗi cập nhật số lượng'
        );
        
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

        // Chạy ngầm (fire & forget)
        const clientTimestamp = Date.now() + state.clockOffset;
        void runCartMutation(
          previousItems,
          () => fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menuItemId, qty: item.qty, note, clientTimestamp }),
            keepalive: true,
          }),
          'updateNote',
          'Lỗi cập nhật ghi chú'
        );
        
        return Promise.resolve();
      },

      // ── clearCart ─────────────────────────────────────────────────────────
      clearCart: () => {
        const state = get();
        // Giữ sessionId/tableId để khách gọi tiếp không cần scan lại
        set({ items: [], submitError: null });

        // Xoá trên server để tránh hiện lại khi reload
        if (state.sessionId) {
          (async () => {
            try {
              await fetch(`${API_URL}/api/sessions/${state.sessionId}/cart`, {
                method: 'DELETE',
                keepalive: true,
              });
            } catch (err) {
              console.error('[cartStore] clearCart server error:', err);
            }
          })();
        }
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
      setLastOrder: (items) => set({ lastOrder: items }),
      setSessionClosed: (status) => set({ isSessionClosed: status !== null, sessionClosedStatus: status }),
      };
    },

    {
      name: 'hiaimenugo-cart',

      // Dùng sessionStorage: tồn tại trong tab, mất khi đóng tab
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        const ss = window.sessionStorage;

        const getBranchSuffix = () => {
          const params = new URLSearchParams(window.location.search);
          return params.get('branchId') || params.get('tenantId') || '';
        };

        const storage: StateStorage = {
          getItem: (name) => ss.getItem(`${name}__${getBranchSuffix()}`),
          setItem: (name, value) => {
            ss.setItem(`${name}__${getBranchSuffix()}`, value);
          },
          removeItem: (name) => {
            ss.removeItem(`${name}__${getBranchSuffix()}`);
          },
        };

        return storage;
      }),

      // Chỉ persist dữ liệu cart, KHÔNG persist UI state
      partialize: (state) => ({
        items: state.items,
        sessionId: state.sessionId,
        tableId: state.tableId,
        tenantId: state.tenantId,
        branchId: state.branchId,
        isLocked: state.isLocked,
        isGeofenceEnabled: state.isGeofenceEnabled,
        lastOrder: state.lastOrder,
        isSessionClosed: state.isSessionClosed,
        sessionClosedStatus: state.sessionClosedStatus,
      }),
    }
  )
);
