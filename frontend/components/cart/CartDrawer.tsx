'use client';

/**
 * CartDrawer.tsx — Slide-over panel hiển thị giỏ hàng từ phải
 *
 * ─── Thiết kế ─────────────────────────────────────────────────────────────────
 * - Floating trigger button: góc dưới phải, badge số lượng item
 * - Drawer slide từ phải với overlay backdrop mờ
 * - Danh sách CartItem: thumbnail, tên, giá, qty controls, textarea ghi chú
 * - Tổng tiền realtime theo từng thay đổi Zustand
 * - Nút "Gửi order": disabled nếu cart rỗng hoặc đang submit
 * - Toast thông báo sau submit (thành công / thất bại)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/stores/cart.store';
import { submitOrder } from '@/app/actions/order.actions';
import CartItemRow from './CartItemRow';

const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// ─── Toast types ──────────────────────────────────────────────────────────────
type Toast = {
  type: 'success' | 'error';
  message: string;
};

// ─── CartDrawer ───────────────────────────────────────────────────────────────
export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useCartStore((s) => s.items);
  const sessionId = useCartStore((s) => s.sessionId);
  const tableId = useCartStore((s) => s.tableId);
  const isSubmitting = useCartStore((s) => s.isSubmitting);
  const submitError = useCartStore((s) => s.submitError);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const updateNote = useCartStore((s) => s.updateNote);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const setSubmitting = useCartStore((s) => s.setSubmitting);
  const setSubmitError = useCartStore((s) => s.setSubmitError);

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Auto dismiss toast ───────────────────────────────────────────────────
  const showToast = (t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!sessionId || !tableId || items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitOrder({
        sessionId,
        tableId,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          qty: i.qty,
          note: i.note || undefined,
        })),
      });

      if (result.success) {
        clearCart();
        setOpen(false);
        showToast({
          type: 'success',
          message: '✅ Đã gửi order! Chờ thu ngân xác nhận.',
        });
      } else {
        // Server trả về lỗi có cấu trúc
        const errMsg =
          result.message ||
          'Có lỗi xảy ra khi gửi order. Vui lòng thử lại.';
        setSubmitError(errMsg);
        showToast({ type: 'error', message: errMsg });
      }
    } catch (networkErr) {
      // Network error / server down (Server Action throw hoặc fetch fail)
      const errMsg = 'Mất kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.';
      setSubmitError(errMsg);
      showToast({ type: 'error', message: errMsg });
      console.error('[CartDrawer] submitOrder network error:', networkErr);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = items.length > 0 && !!sessionId && !isSubmitting;

  return (
    <>
      {/* ── Floating Trigger Button ─────────────────────────────────────── */}
      <button
        type="button"
        id="cart-trigger-btn"
        onClick={() => setOpen(true)}
        aria-label={`Giỏ hàng — ${totalItems} món`}
        className="
          fixed bottom-6 right-6 z-40
          flex items-center gap-2
          bg-amber-600 hover:bg-amber-700 text-white
          rounded-full shadow-xl shadow-amber-900/30
          px-4 py-3
          transition-all duration-200 hover:scale-105 active:scale-95
        "
      >
        <ShoppingCart size={20} strokeWidth={2} />
        {totalItems > 0 && (
          <span className="flex items-center justify-center min-w-[22px] h-5 bg-white text-amber-700 text-xs font-extrabold rounded-full px-1 tabular-nums">
            {totalItems}
          </span>
        )}
        {totalItems > 0 && (
          <span className="text-sm font-bold tabular-nums hidden sm:inline">
            {formatVND(totalPrice)}
          </span>
        )}
      </button>

      {/* ── Backdrop Overlay ────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer Panel ────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="Giỏ hàng"
        aria-modal="true"
        className={`
          fixed top-0 right-0 z-50 h-full w-full max-w-sm
          bg-white shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">
              Giỏ hàng
              {totalItems > 0 && (
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  ({totalItems} món)
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng giỏ hàng"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
                <ShoppingCart size={32} className="text-orange-200" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">Giỏ hàng trống</p>
                <p className="text-xs text-gray-400 mt-1">Chọn món từ thực đơn để bắt đầu</p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {items.map((item) => (
                <CartItemRow
                  key={item.menuItemId}
                  item={item}
                  onQtyChange={updateQty}
                  onNoteChange={updateNote}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-white">
            {/* Tổng tiền tạm tính */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Tạm tính</span>
              <span className="text-lg font-extrabold text-amber-600 tabular-nums">
                {formatVND(totalPrice)}
              </span>
            </div>

            {/* Lỗi submit */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600 leading-relaxed">{submitError}</p>
              </div>
            )}

            {/* Nút Gửi order */}
            <button
              type="button"
              id="submit-order-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-busy={isSubmitting}
              className="
                w-full h-12 rounded-2xl
                flex items-center justify-center gap-2
                text-sm font-bold text-white
                bg-amber-600 hover:bg-amber-700
                shadow-md shadow-amber-900/20
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 active:scale-[0.98]
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Đang gửi order...
                </>
              ) : (
                <>
                  Gửi order — {formatVND(totalPrice)}
                </>
              )}
            </button>

            {!sessionId && (
              <p className="text-center text-xs text-gray-400">
                Đang khởi tạo phiên... Vui lòng chờ.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Toast Notification ─────────────────────────────────────────── */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className={`
            fixed bottom-24 right-4 z-[60] max-w-xs
            flex items-start gap-3 p-4 rounded-2xl shadow-2xl
            text-white text-sm font-medium
            transition-all duration-300 animate-in slide-in-from-bottom-4
            ${toast.type === 'success'
              ? 'bg-emerald-600 shadow-emerald-900/30'
              : 'bg-red-600 shadow-red-900/30'
            }
          `}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={18} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
