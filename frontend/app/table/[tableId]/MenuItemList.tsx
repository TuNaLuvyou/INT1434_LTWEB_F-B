'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, Receipt, X, Trash, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

import MenuCard, { MenuCardItem } from '@/components/MenuCard';
import CategoryFilter from '@/components/CategoryFilter';
import { useMenuSoldOut } from '../hooks/useMenuSoldOut';
import { useCartStore, CartItem } from '@/stores/cart.store';
import { submitOrder } from '@/app/actions/order.actions';
import { useCartSync } from '@/hooks/useCartSync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface MenuItemForDisplay {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  isSoldOut: boolean;
  isActive: boolean;
  [key: string]: unknown;
}

interface MenuItemListProps {
  initialItems: MenuItemForDisplay[];
  categories: CategoryInfo[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (price: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

// ─── Component ────────────────────────────────────────────────────────────────

export default function MenuItemList({ initialItems, categories }: MenuItemListProps) {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params?.tableId as string;

  // ── Realtime sold-out sync (Lắng nghe sự thay đổi hết món qua Socket.io) ──
  const { items: rawItems, isConnected } = useMenuSoldOut(initialItems, {
    onItemSoldOut: (payload) => {
      if (payload.isSoldOut) {
        // Find the item name if possible, or just say 'Một món ăn'
        const item = initialItems.find(i => i.id === payload.menuItemId);
        const name = item ? item.name : 'Một món ăn';
        showToast({ type: 'error', message: `Món "${name}" hiện đã hết.` });
      }
    }
  });
  const items = rawItems as MenuItemForDisplay[];

  // ── Zustand Store State & Actions ──
  const cartItems = useCartStore((s) => s.items);
  const sessionId = useCartStore((s) => s.sessionId);
  const sessionTableId = useCartStore((s) => s.tableId);
  const isSubmitting = useCartStore((s) => s.isSubmitting);
  const submitError = useCartStore((s) => s.submitError);

  const initSession = useCartStore((s) => s.initSession);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const updateNote = useCartStore((s) => s.updateNote);
  const clearCart = useCartStore((s) => s.clearCart);
  const setSubmitting = useCartStore((s) => s.setSubmitting);
  const setSubmitError = useCartStore((s) => s.setSubmitError);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();

  // ── UI state ──
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<CartItem[] | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingItemIds, setLoadingItemIds] = useState<Record<string, boolean>>({});
  const [isSessionClosed, setIsSessionClosed] = useState(false);

  // ── Realtime cart synchronization ──
  const { registerActivity } = useCartSync(
    sessionId,
    sessionTableId,
    useCallback((message: string) => {
      showToast({ type: 'success', message });
    }, []),
    useCallback(() => {
      clearCart();
      setLastOrder(null);
      setIsSessionClosed(true);
    }, [clearCart])
  );

  const handleUpdateQty = useCallback(async (itemId: string, qty: number) => {
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateQty(itemId, qty);
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [updateQty, registerActivity]);

  const handleUpdateNote = useCallback(async (itemId: string, note: string) => {
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateNote(itemId, note);
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [updateNote, registerActivity]);

  // ── Khởi tạo session tự động khi quét QR code / vào bàn ──
  useEffect(() => {
    if (tableNumber) {
      initSession(tableNumber).then(async ({ sessionId }) => {
        try {
          const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);
          if (res.ok) {
            const result = await res.json();
            if (result.success && result.data && result.data.orderItems) {
              const dbItems = result.data.orderItems;
              if (dbItems.length > 0) {
                const mapped = dbItems.map((oi: any) => ({
                  menuItemId: oi.menuItemId,
                  name: oi.menuItem?.name || oi.menuItemName || '',
                  price: Number(oi.unitPrice),
                  imageUrl: oi.menuItem?.imageUrl || null,
                  qty: oi.qty,
                  note: oi.note || '',
                }));
                setLastOrder(mapped);
              }
            }
          }
        } catch (err) {
          console.error('[MenuItemList] Lấy chi tiết phiên bàn thất bại:', err);
        }
      }).catch((err) => {
        console.error('[MenuItemList] Khởi tạo session thất bại:', err);
        const msg = (err as Error)?.message || '';
        if (msg.includes('404') || msg.toLowerCase().includes('bàn không tồn tại')) {
          router.replace('/404');
        }
      });
    }
  }, [tableNumber, initSession, router]);

  // ── Lắng nghe sự kiện phiên đã đóng ──
  useEffect(() => {
    const handleSessionClosed = () => {
      setIsSessionClosed(true);
    };
    window.addEventListener('session-closed', handleSessionClosed);
    return () => {
      window.removeEventListener('session-closed', handleSessionClosed);
    };
  }, []);

  // Thao tác với DOM để phục vụ auto-scroll của CategoryFilter
  const handleCategoryChange = (id: string | null) => {
    setActiveCategoryId(id);
    if (id === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      const el = document.getElementById(`category-${cat.slug}`);
      if (el) {
        // Khoảng bù cho CategoryFilter sticky + khoảng đệm an toàn
        const offset = 80;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  // ── Toast helper ──
  const showToast = (t: { type: 'success' | 'error'; message: string }) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Cart actions bridge ──
  const addToCart = useCallback(async (itemId: string) => {
    const found = items.find((i) => i.id === itemId);
    if (!found || found.isSoldOut) return;
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await addItem({
        menuItemId: found.id,
        name: found.name,
        price: Number(found.price),
        imageUrl: found.imageUrl,
      });
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [items, addItem, registerActivity]);

  const visibleCategories = categories.filter((cat) => {
    if (activeCategoryId !== null && cat.id !== activeCategoryId) return false;
    return items.some((i) => i.categoryId === cat.id);
  });

  // Tự động đóng Drawer khi giỏ hàng trống và không có lịch sử đơn hàng cũ
  useEffect(() => {
    if (cartItems.length === 0 && !lastOrder) {
      setMobileCartOpen(false);
    }
  }, [cartItems.length, lastOrder]);

  // ── Gọi món chính thức bằng Server Action ──
  const handleOrder = async () => {
    if (!sessionId || !sessionTableId || cartItems.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitOrder({
        sessionId,
        tableId: sessionTableId,
        items: cartItems.map((i) => ({
          menuItemId: i.menuItemId,
          qty: i.qty,
          note: i.note || undefined,
        })),
      });

      if (result.success) {
        const updatedLastOrder = [...(lastOrder || [])];
        for (const cartItem of cartItems) {
          const existing = updatedLastOrder.find((i) => i.menuItemId === cartItem.menuItemId);
          if (existing) {
            existing.qty += cartItem.qty;
            if (cartItem.note) {
              existing.note = existing.note ? `${existing.note}, ${cartItem.note}` : cartItem.note;
            }
          } else {
            updatedLastOrder.push({ ...cartItem });
          }
        }
        setLastOrder(updatedLastOrder);
        clearCart();
        setMobileCartOpen(true); // Tiếp tục mở để khách tiện quan sát các món đã gọi
        showToast({
          type: 'success',
          message: '🍳 Gửi món lên hệ thống thành công! Nhà bếp đang xử lý.',
        });
      } else {
        let errMsg = result.message || 'Có lỗi xảy ra khi gọi món.';
        if (result.errors && (result.errors as any).itemErrors) {
          const specificErrors = (result.errors as any).itemErrors.map((e: any) => e.message);
          errMsg = `Không thể đặt các món: ${specificErrors.join(', ')}`;
        }
        setSubmitError(errMsg);
        showToast({ type: 'error', message: errMsg });
      }
    } catch (networkErr) {
      const errMsg = 'Mất kết nối mạng. Vui lòng kiểm tra lại kết nối và thử lại.';
      setSubmitError(errMsg);
      showToast({ type: 'error', message: errMsg });
      console.error('[MenuItemList] submitOrder error:', networkErr);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Giao diện danh sách món ăn trong Giỏ hàng ──
  const CartItemList = ({ entries, showActions = true }: { entries: CartItem[]; showActions?: boolean }) => (
    <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-hide py-1">
      {entries.map((item) => (
        <div
          key={item.menuItemId}
          className="flex flex-col gap-2 bg-gray-50/80 rounded-xl p-3 border border-gray-100/50 group"
        >
          <div className="flex items-center gap-3">
            {/* Ảnh thu nhỏ */}
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-orange-50 shrink-0 border border-gray-100">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="48px" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100" />
              )}
            </div>

            {/* Tên và giá tiền */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-gray-800 truncate leading-snug">{item.name}</p>
              <p className="text-xs text-amber-600 font-bold tabular-nums mt-0.5">
                {fmt(item.price * item.qty)}
              </p>
            </div>

            {/* Nút tăng/giảm và xóa */}
            {showActions ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdateQty(item.menuItemId, item.qty - 1)}
                  disabled={loadingItemIds[item.menuItemId]}
                  aria-label="Giảm số lượng"
                  className="h-7 w-7 rounded-full bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                {loadingItemIds[item.menuItemId] ? (
                  <Loader2 size={12} className="animate-spin text-amber-600 w-5 text-center" />
                ) : (
                  <span className="text-xs sm:text-sm font-extrabold text-gray-900 w-5 text-center tabular-nums">{item.qty}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleUpdateQty(item.menuItemId, item.qty + 1)}
                  disabled={loadingItemIds[item.menuItemId]}
                  aria-label="Tăng số lượng"
                  className="h-7 w-7 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateQty(item.menuItemId, 0)}
                  disabled={loadingItemIds[item.menuItemId]}
                  aria-label="Xóa khỏi đơn"
                  className="h-7 w-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 flex items-center justify-center transition-colors ml-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div className="text-xs font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full tabular-nums shrink-0">
                Số lượng: {item.qty}
              </div>
            )}
          </div>

          {/* Ghi chú chi tiết cho từng món ăn */}
          {showActions && (
            <input
              type="text"
              placeholder="Ghi chú (ít cay, không hành...)"
              value={item.note || ''}
              disabled={loadingItemIds[item.menuItemId]}
              onChange={(e) => handleUpdateNote(item.menuItemId, e.target.value)}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-2.5 py-1 text-[11px] text-gray-700 placeholder-gray-400 focus:outline-none transition-all disabled:opacity-50 disabled:bg-gray-50"
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Socket disconnect toast (Báo mất kết nối realtime) */}
      {!isConnected && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-gray-900/90 text-white text-xs px-3.5 py-2 rounded-full shadow-lg backdrop-blur-sm border border-white/10"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Đang kết nối lại...
        </div>
      )}

      {/* ── CategoryFilter sticky đỉnh trang ── */}
      <CategoryFilter
        categories={categories}
        activeId={activeCategoryId}
        onChange={handleCategoryChange}
      />

      {/* ══════════════════════════════════════════════════
          LAYOUT CHÍNH: max-w-2xl tập trung cao cấp
          ══════════════════════════════════════════════════ */}
      <main className="max-w-2xl mx-auto w-full px-4 py-6 flex-1 space-y-8 pb-32">
        {visibleCategories.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          if (catItems.length === 0) return null;

          return (
            <section
              key={cat.id}
              id={`category-${cat.slug}`}
              aria-labelledby={`heading-${cat.id}`}
              className="scroll-mt-20"
            >
              {/* Tiêu đề danh mục kèm đường kẻ phân tách */}
              <div className="flex items-center gap-3 mb-5">
                <h2
                  id={`heading-${cat.id}`}
                  className="text-xs sm:text-sm font-black text-gray-400 tracking-widest uppercase shrink-0"
                >
                  {cat.name}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
              </div>

              {/* Lưới MenuCard: 1 cột mobile → 2 cột sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catItems.map((item, index) => {
                  const card: MenuCardItem = {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    price: Number(item.price),
                    imageUrl: item.imageUrl,
                    isSoldOut: item.isSoldOut,
                  };
                  return <MenuCard key={item.id} item={card} onAddToCart={addToCart} priority={index < 2} />;
                })}
              </div>
            </section>
          );
        })}

        {visibleCategories.length === 0 && (
          <div className="py-20 text-center text-gray-400 text-sm font-light">
            Không tìm thấy món ăn nào thuộc danh mục này.
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════
          GIỎ HÀNG NỔI (Floating Cart Button)
          ══════════════════════════════════════════════════ */}
      {cartItems.length > 0 && (
        <button
          onClick={() => setMobileCartOpen(true)}
          type="button"
          aria-label="Xem chi tiết giỏ hàng"
          className="
            fixed bottom-6 right-6 z-40
            bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600
            text-white shadow-2xl rounded-full px-5 py-3.5
            flex items-center gap-3 hover:scale-105 active:scale-95
            transition-all duration-200 ease-out cursor-pointer
            border border-orange-400/20
          "
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-white" />
            <span
              className="
                absolute -top-2.5 -right-2.5
                bg-red-500 text-white text-[10px] font-black
                rounded-full h-5 w-5 flex items-center justify-center
                border-2 border-white animate-scale-in
              "
            >
              {totalItems}
            </span>
          </div>
          <span className="font-extrabold text-sm tracking-wide tabular-nums">
            {fmt(subtotal)}
          </span>
        </button>
      )}

      {/* Lịch sử nút gọi món phụ khi không có giỏ hàng hoạt động nhưng đã gọi món trước đó */}
      {cartItems.length === 0 && lastOrder && lastOrder.length > 0 && (
        <button
          onClick={() => setMobileCartOpen(true)}
          type="button"
          aria-label="Xem đơn đã gửi tới bếp"
          className="
            fixed bottom-6 right-6 z-40
            bg-white text-gray-700 shadow-2xl rounded-full px-4 py-3
            flex items-center gap-2 hover:scale-105 active:scale-95
            border border-gray-200/80 transition-all duration-200 cursor-pointer
          "
        >
          <Receipt className="w-4.5 h-4.5 text-orange-500 animate-pulse" />
          <span className="font-bold text-xs">Đơn đã gửi ({lastOrder.reduce((sum, i) => sum + i.qty, 0)})</span>
        </button>
      )}

      {/* ══════════════════════════════════════════════════
          BOTTOM SHEET DRAWER (Giỏ hàng kéo từ đáy)
          ══════════════════════════════════════════════════ */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          {/* Backdrop tối mờ có hiệu ứng nhòe (blur) sang xịn */}
          <div
            onClick={() => setMobileCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px]"
            aria-hidden="true"
          />

          {/* Khung Drawer cuộn lên tự động */}
          <div
            className="
              fixed bottom-0 left-0 right-0 z-50
              max-w-2xl mx-auto bg-white rounded-t-[32px]
              shadow-2xl border-t border-orange-100/60
              p-5 pb-8 flex flex-col max-h-[85vh]
              animate-in slide-in-from-bottom duration-300 ease-out
            "
          >
            {/* Thanh dẫn kéo tay mô phỏng ở đỉnh */}
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Tiêu đề Drawer */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  {cartItems.length > 0 ? 'Chi tiết đơn gọi món' : 'Món đã gửi nhà bếp'}
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5">
                  {cartItems.length > 0
                    ? `Bạn có ${totalItems} món ăn đang chờ gọi`
                    : `Đang được chuẩn bị và phục vụ`
                  }
                </p>
              </div>

              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    onClick={clearCart}
                    type="button"
                    className="
                      flex items-center gap-1 text-[11px] font-bold text-red-500
                      hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer
                    "
                  >
                    <Trash size={12} />
                    Xóa tất cả
                  </button>
                )}
                <button
                  onClick={() => setMobileCartOpen(false)}
                  type="button"
                  aria-label="Đóng"
                  className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Nội dung danh sách món */}
            <div className="flex-1 overflow-y-auto min-h-0 mb-5 scrollbar-hide space-y-6">
              {cartItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-black text-gray-400 tracking-wider uppercase">
                    Món đang chọn ({totalItems} món)
                  </div>
                  <CartItemList entries={cartItems} showActions={true} />
                </div>
              )}

              {lastOrder && lastOrder.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="text-[11px] font-black text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Món đã gửi bếp ({lastOrder.reduce((sum, i) => sum + i.qty, 0)} món)
                  </div>
                  <div className="bg-emerald-50/50 text-emerald-800 text-[11px] font-medium p-3 rounded-xl border border-emerald-100/50 flex items-start gap-2">
                    <span className="text-xs">🍳</span>
                    <div>
                      <p className="font-bold">Nhà bếp đang chế biến các món này!</p>
                      <p className="font-normal opacity-90 mt-0.5">Món ăn sẽ sớm được phục vụ tại bàn của bạn.</p>
                    </div>
                  </div>
                  <CartItemList entries={lastOrder} showActions={false} />
                </div>
              )}

              {cartItems.length === 0 && (!lastOrder || lastOrder.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-3">
                  <ShoppingBag size={48} strokeWidth={1} className="text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">Giỏ hàng trống</p>
                </div>
              )}
            </div>

            {/* Tóm tắt tổng tiền & Hành động gửi món */}
            {cartItems.length > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>Tạm tính ({totalItems} món)</span>
                    <span className="tabular-nums font-semibold text-gray-700">{fmt(subtotal)}</span>
                  </div>
                  {submitError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                      <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-600 leading-relaxed">{submitError}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                    <span className="text-sm font-black text-gray-900">Tổng thanh toán</span>
                    <span className="text-lg font-black text-amber-600 tabular-nums">{fmt(subtotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleOrder}
                  type="button"
                  disabled={isSubmitting || !sessionId}
                  className="
                    w-full py-3.5 rounded-2xl
                    bg-gradient-to-r from-orange-500 to-amber-500
                    hover:from-orange-600 hover:to-amber-600
                    text-white text-sm font-bold tracking-wide
                    flex items-center justify-center gap-2
                    shadow-lg shadow-orange-200/50 transition-all duration-200
                    active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang gửi yêu cầu...
                    </>
                  ) : (
                    <>
                      <Receipt size={16} strokeWidth={2.5} />
                      Gửi yêu cầu Gọi món ({totalItems} món)
                    </>
                  )}
                </button>

                {!sessionId && (
                  <p className="text-center text-[10px] text-gray-400">
                    Đang thiết lập phiên kết nối bàn... Vui lòng chờ giây lát.
                  </p>
                )}
              </div>
            )}

            {cartItems.length === 0 && lastOrder && lastOrder.length > 0 && (
              <button
                onClick={() => setMobileCartOpen(false)}
                type="button"
                className="w-full py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold tracking-wide transition-colors cursor-pointer"
              >
                Tiếp tục xem thực đơn
              </button>
            )}
          </div>
        </div>
      )}

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
      {/* Màn hình Cảm ơn & Thanh toán thành công (Bàn trống) */}
      {isSessionClosed && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 animate-bounce">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Thanh toán thành công!</h2>
          <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
            Hóa đơn cho bàn của bạn đã được thanh toán hoàn tất. Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của RestoFlow!
          </p>
          <div className="text-xs text-gray-400 font-medium">
            Chúc quý khách một ngày tốt lành và hẹn gặp lại!
          </div>
        </div>
      )}
    </>
  );
}
