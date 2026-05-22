'use client';

/**
 * MenuItemList — Client Component chính quản lý luồng hiển thị thực đơn và giỏ hàng.
 *
 * Tái cấu trúc giao diện (Pure UI Commit):
 *   - Layout: Chuyển đổi thành layout tập trung `max-w-2xl mx-auto px-4 py-6`.
 *   - Grid MenuCard: Hiển thị 1 cột trên mobile, 2 cột trên sm+, không dùng 3 cột.
 *   - Cuộn theo danh mục: Áp dụng `category-${cat.slug}` làm ID phần và tự động cuộn chuẩn xác
 *     với độ lệch bù (offset) 80px để không bị che khuất bởi thanh CategoryFilter sticky.
 *   - Giỏ hàng nổi (Floating Cart Button): Xuất hiện sinh động ở góc dưới bên phải (`fixed bottom-6 right-6`)
 *     khi có món trong giỏ hàng. Hiển thị số lượng món ăn dạng badge và tổng tiền với animation tinh tế.
 *   - Bottom Drawer (Giỏ hàng trượt đáy): Bảng điều khiển chi tiết giỏ hàng trượt lên mượt mà
 *     khi nhấp vào nút giỏ hàng, kết hợp lớp backdrop mờ và blur sang trọng.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, Receipt, X, Trash } from 'lucide-react';
import Image from 'next/image';

import MenuCard, { MenuCardItem, Decimal } from '@/components/MenuCard';
import CategoryFilter from '@/components/CategoryFilter';
import { useMenuSoldOut } from '../hooks/useMenuSoldOut';

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

interface CartEntry {
  item: MenuItemForDisplay;
  quantity: number;
}

interface MenuItemListProps {
  initialItems: MenuItemForDisplay[];
  categories: CategoryInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (price: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

// ─── Component ────────────────────────────────────────────────────────────────

export default function MenuItemList({ initialItems, categories }: MenuItemListProps) {
  // ── Realtime sold-out sync (Lắng nghe sự thay đổi hết món qua Socket.io) ──
  const { items: rawItems, isConnected } = useMenuSoldOut(initialItems);
  const items = rawItems as MenuItemForDisplay[];

  // ── UI state ──
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<CartEntry[] | null>(null);

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

  // ── Cart logic ──
  const addToCart = useCallback((itemId: string) => {
    const found = items.find((i) => i.id === itemId);
    if (!found || found.isSoldOut) return;
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === itemId);
      if (existing) {
        return prev.map((e) =>
          e.item.id === itemId ? { ...e, quantity: e.quantity + 1 } : e
        );
      }
      return [...prev, { item: found, quantity: 1 }];
    });
  }, [items]);

  const updateQty = (itemId: string, delta: number) =>
    setCart((prev) =>
      prev.map((e) =>
        e.item.id === itemId ? { ...e, quantity: e.quantity + delta } : e
      )
      .filter((e) => e.quantity > 0)
    );

  const removeFromCart = (itemId: string) =>
    setCart((prev) => prev.filter((e) => e.item.id !== itemId));

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((s, e) => s + e.quantity, 0);
  const subtotal = cart.reduce((s, e) => s + Number(e.item.price) * e.quantity, 0);

  const visibleCategories = categories.filter((cat) => {
    if (activeCategoryId !== null && cat.id !== activeCategoryId) return false;
    return items.some((i) => i.categoryId === cat.id);
  });

  // Tự động đóng Drawer khi giỏ hàng trống và không có lịch sử đơn hàng cũ
  useEffect(() => {
    if (cart.length === 0 && !lastOrder) {
      setMobileCartOpen(false);
    }
  }, [cart.length, lastOrder]);

  // ── Xử lý gọi món ──
  const handleOrder = () => {
    if (cart.length === 0) return;
    alert(`✅ Đã gửi ${totalItems} món tới bếp! Tổng: ${fmt(subtotal)}`);
    setLastOrder(cart.map((c) => ({ ...c })));
    clearCart();
    setMobileCartOpen(true); // Tiếp tục mở để khách tiện quan sát các món đã gọi
  };

  // ── Giao diện danh sách món ăn trong Giỏ hàng (Tái sử dụng) ──
  const CartItemList = ({ entries, showActions = true }: { entries: CartEntry[]; showActions?: boolean }) => (
    <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-hide py-1">
      {entries.map(({ item, quantity }) => (
        <div
          key={item.id}
          className="flex items-center gap-3 bg-gray-50/80 rounded-xl p-3 border border-gray-100/50 group"
        >
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
              {fmt(Number(item.price) * quantity)}
            </p>
          </div>

          {/* Nút tăng/giảm và xóa */}
          {showActions ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => updateQty(item.id, -1)}
                aria-label="Giảm số lượng"
                className="h-7 w-7 rounded-full bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition-colors shadow-sm cursor-pointer"
              >
                <Minus size={12} strokeWidth={2.5} />
              </button>
              <span className="text-xs sm:text-sm font-extrabold text-gray-900 w-5 text-center tabular-nums">{quantity}</span>
              <button
                onClick={() => updateQty(item.id, 1)}
                aria-label="Tăng số lượng"
                className="h-7 w-7 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                aria-label="Xóa khỏi đơn"
                className="h-7 w-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 flex items-center justify-center transition-colors ml-1 cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <div className="text-xs font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full tabular-nums shrink-0">
              Số lượng: {quantity}
            </div>
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
                {catItems.map((item) => {
                  const card: MenuCardItem = {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    price: item.price as unknown as Decimal,
                    imageUrl: item.imageUrl,
                    isSoldOut: item.isSoldOut,
                  };
                  return <MenuCard key={item.id} item={card} onAddToCart={addToCart} />;
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
      {cart.length > 0 && (
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
      {cart.length === 0 && lastOrder && lastOrder.length > 0 && (
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
          <span className="font-bold text-xs">Đơn đã gửi</span>
        </button>
      )}

      {/* ══════════════════════════════════════════════════
          BOTTOM SHEET DRAWER (Giỏ hàng kéo từ đáy)
          ══════════════════════════════════════════════════ */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop tối mờ có hiệu ứng nhòe (blur) sang xịn */}
          <div
            onClick={() => setMobileCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-300"
            aria-hidden="true"
          />

          {/* Khung Drawer cuộn lên tự động */}
          <div
            className="
              fixed bottom-0 left-0 right-0 z-50
              max-w-2xl mx-auto bg-white rounded-t-[32px]
              shadow-2xl border-t border-orange-100/60
              p-5 pb-8 flex flex-col max-h-[85vh]
              transition-transform duration-300 ease-out transform translate-y-0
            "
          >
            {/* Thanh dẫn kéo tay mô phỏng ở đỉnh */}
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Tiêu đề Drawer */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  {cart.length > 0 ? 'Chi tiết đơn gọi món' : 'Đơn đã gửi bếp thành công'}
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5">
                  {cart.length > 0
                    ? `Bạn có ${totalItems} món ăn đang chờ gọi`
                    : `Đã gửi bếp chế biến lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                  }
                </p>
              </div>

              <div className="flex items-center gap-2">
                {cart.length > 0 && (
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
            <div className="flex-1 overflow-y-auto min-h-0 mb-5 scrollbar-hide">
              {cart.length > 0 ? (
                <CartItemList entries={cart} showActions={true} />
              ) : lastOrder && lastOrder.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 text-xs font-semibold p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                    <span className="text-base">🍳</span>
                    <div>
                      <p className="font-bold">Nhà bếp đang chuẩn bị món ăn cho bạn!</p>
                      <p className="font-normal opacity-90 mt-0.5">Món ăn sẽ sớm được phục vụ tại bàn của bạn.</p>
                    </div>
                  </div>
                  <CartItemList entries={lastOrder} showActions={false} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-3">
                  <ShoppingBag size={48} strokeWidth={1} className="text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">Giỏ hàng trống</p>
                </div>
              )}
            </div>

            {/* Tóm tắt tổng tiền & Hành động gửi món */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>Tạm tính ({totalItems} món)</span>
                    <span className="tabular-nums font-semibold text-gray-700">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                    <span className="text-sm font-black text-gray-900">Tổng thanh toán</span>
                    <span className="text-lg font-black text-amber-600 tabular-nums">{fmt(subtotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleOrder}
                  type="button"
                  className="
                    w-full py-3.5 rounded-2xl
                    bg-gradient-to-r from-orange-500 to-amber-500
                    hover:from-orange-600 hover:to-amber-600
                    text-white text-sm font-bold tracking-wide
                    flex items-center justify-center gap-2
                    shadow-lg shadow-orange-200/50 transition-all duration-200
                    active:scale-[0.98] cursor-pointer
                  "
                >
                  <Receipt size={16} strokeWidth={2.5} />
                  Gửi yêu cầu Gọi món ({totalItems} món)
                </button>
              </div>
            )}

            {cart.length === 0 && lastOrder && lastOrder.length > 0 && (
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
    </>
  );
}
