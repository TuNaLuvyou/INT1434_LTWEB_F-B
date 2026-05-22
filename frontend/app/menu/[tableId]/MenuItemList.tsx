'use client';

/**
 * MenuItemList — Client Component
 *
 * Tại sao tách Client Component riêng?
 * ─────────────────────────────────────
 * - Page /menu/[tableId] là Server Component (SSG) → không thể dùng useState/useEffect.
 * - Chỉ phần hiển thị items cần reactivity (realtime sold-out updates).
 * - Giải pháp: "islands architecture" — Server Component render mọi thứ tĩnh,
 *   chỉ nhúng MenuItemList (Client Component) vào nơi cần interactive.
 * - Lợi ích: Toàn bộ HTML header, category tabs vẫn là static HTML
 *   → không tăng JS bundle size cho những phần không cần interactivity.
 */

import Image from 'next/image';
import { useMenuSoldOut } from '../hooks/useMenuSoldOut';

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
  // Index signature cần thiết để tương thích với MenuItemSoldOutState generic constraint
  [key: string]: unknown;
}

interface MenuItemListProps {
  /** Danh sách items từ SSG — được dùng làm initialState của hook */
  initialItems: MenuItemForDisplay[];
  categories: CategoryInfo[];
}

export default function MenuItemList({ initialItems, categories }: MenuItemListProps) {
  // Hook quản lý realtime state:
  // - Bắt đầu từ initialItems (data từ SSG, load siêu nhanh)
  // - Patch isSoldOut theo Socket.io event "menu:soldout" khi bếp cập nhật
  const { items: rawItems, isConnected } = useMenuSoldOut(initialItems);
  // Cast lại về kiểu cụ thể vì hook dùng generic T extends MenuItemSoldOutState
  const items = rawItems as MenuItemForDisplay[];

  return (
    <>
      {/* Indicator kết nối Socket.io — chỉ hiển thị khi mất kết nối */}
      {!isConnected && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-gray-800/90 text-white text-xs px-3 py-2 rounded-full shadow-lg backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Đang kết nối lại...
        </div>
      )}

      {/* Danh sách món theo category */}
      {categories.map((cat) => {
        const catItems = items.filter((item) => item.categoryId === cat.id);
        if (catItems.length === 0) return null;

        return (
          <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-36">
            {/* Tiêu đề category */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-[2px] bg-gradient-to-r from-transparent to-orange-400 w-12 md:w-20" />
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-wide text-center">
                {cat.name}
              </h2>
              <div className="h-[2px] bg-gradient-to-l from-transparent to-orange-400 w-12 md:w-20" />
            </div>

            {/* Grid cards */}
            <div className="flex flex-wrap justify-center gap-6">
              {catItems.map((item, idx) => (
                <MenuItemCard key={item.id} item={item} idx={idx} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

// ─── Sub-component: MenuItemCard ──────────────────────────────────────────────

interface MenuItemCardProps {
  item: MenuItemForDisplay;
  idx: number;
}

function MenuItemCard({ item, idx }: MenuItemCardProps) {
  /**
   * CSS transition khi sold-out thay đổi:
   * - `transition-[opacity,filter]` + `duration-300`: smooth 0.3s
   * - `opacity-50` + `grayscale` khi hết món → visual cue rõ ràng
   * - `cursor-not-allowed` để UX feedback khi hover
   */
  const soldOutClasses = item.isSoldOut
    ? 'opacity-50 grayscale cursor-not-allowed pointer-events-none'
    : 'hover:border-orange-100 hover:shadow-md hover:-translate-y-0.5 cursor-pointer';

  return (
    <div
      className={`
        relative flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100
        transition-[opacity,filter,transform,box-shadow] duration-300 ease-in-out
        w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] max-w-sm shrink-0
        ${soldOutClasses}
      `}
      aria-disabled={item.isSoldOut}
    >
      {/* Badge "Hết món" — xuất hiện/biến mất với transition */}
      {item.isSoldOut && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span
            className="
              text-xs font-black text-white bg-red-500 px-3 py-1.5 rounded-full
              shadow-lg border border-red-400 tracking-wide uppercase
              animate-in fade-in duration-200
            "
          >
            Hết món
          </span>
        </div>
      )}

      {/* Hình ảnh */}
      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
        <Image
          src={item.imageUrl || '/placeholder-food.svg'}
          alt={item.name}
          fill
          className="object-cover"
          priority={idx === 0}
        />
      </div>

      {/* Thông tin món */}
      <div className="flex flex-col flex-grow justify-between py-0.5">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-sm font-extrabold text-gray-800 line-clamp-2 leading-snug">
              {item.name}
            </h3>
            {/* Badge nhỏ bên tên — chỉ hiện khi isSoldOut */}
            {item.isSoldOut && (
              <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md whitespace-nowrap border border-red-100 flex-shrink-0">
                Hết món
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-black text-orange-600">
            {new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND',
            }).format(Number(item.price))}
          </span>

          {/* Nút thêm vào giỏ — disabled khi hết món */}
          <button
            type="button"
            disabled={item.isSoldOut}
            aria-disabled={item.isSoldOut}
            className={`
              text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200
              ${item.isSoldOut
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
              }
            `}
          >
            {item.isSoldOut ? 'Hết' : '+ Thêm'}
          </button>
        </div>
      </div>
    </div>
  );
}
