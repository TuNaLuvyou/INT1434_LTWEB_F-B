'use client';

/**
 * MenuCard — Thẻ món ăn responsive, thẩm mỹ cao
 *
 * Giao diện responsive:
 *   - Mobile (< 640px): Dạng ngang (horizontal) — ảnh trái 80x80px (rounded-xl, object-cover), thông tin bên phải
 *   - Tablet trở lên (≥ 640px): Dạng đứng (vertical) — ảnh trên tỉ lệ 4:3, thông tin bên dưới
 *
 * Trạng thái Hết món (Sold-out):
 *   - Overlay mờ toàn thẻ, thang độ xám (grayscale)
 *   - Badge "Hết món" màu đỏ sành điệu ở góc trên phải
 *   - Nút "Thêm" bị ẩn hoàn toàn và vô hiệu hóa tương tác
 *
 * Nút "Thêm (+)"
 *   - Dạng tròn rounded-full màu cam nổi bật
 *   - Luôn hiển thị trên Mobile nhằm tối ưu thao tác một chạm
 *   - Ẩn trên Desktop và chỉ xuất hiện mượt mà khi di chuột (hover) qua thẻ
 *
 * Hiệu ứng tương tác:
 *   - Hover scale nhẹ [1.02], bóng mờ shadow tinh tế tăng dần (duration-200)
 */

import Image from 'next/image';
import { Plus, UtensilsCrossed } from 'lucide-react';

export interface Decimal {
  toString(): string;
}

export type MenuCardItem = {
  id: string;
  name: string;
  description?: string | null;
  price: Decimal;
  imageUrl?: string | null;
  isSoldOut: boolean;
};

type MenuCardProps = {
  item: MenuCardItem;
  onAddToCart: (itemId: string) => void;
};

const formatPrice = (price: Decimal): string => {
  const numericPrice = Number(price?.toString() || 0);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numericPrice);
};

export default function MenuCard({ item, onAddToCart }: MenuCardProps) {
  const { id, name, description, price, imageUrl, isSoldOut } = item;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click bùng lên thẻ cha
    if (!isSoldOut) {
      onAddToCart(id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isSoldOut ? -1 : 0}
      aria-disabled={isSoldOut}
      aria-label={`Món ăn: ${name}. Giá ${formatPrice(price)}. ${isSoldOut ? 'Đã hết món' : 'Bấm để thêm vào giỏ hàng'}`}
      onKeyDown={(e) => {
        if (isSoldOut) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddToCart(id);
        }
      }}
      onClick={() => {
        if (!isSoldOut) onAddToCart(id);
      }}
      className={`
        group relative flex sm:flex-col
        bg-white rounded-2xl border border-gray-100 overflow-hidden
        transition-all duration-200 ease-in-out
        ${isSoldOut
          ? 'opacity-60 grayscale cursor-not-allowed select-none'
          : 'hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/40 hover:scale-[1.02] cursor-pointer'
        }
      `}
    >
      {/* ── Badge Hết món (Chỉ hiển thị khi đã bán hết) ── */}
      {isSoldOut && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <span
            className="
              inline-flex items-center gap-1
              text-[10px] font-extrabold text-white uppercase tracking-wider
              bg-red-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-red-400/40
            "
            aria-label="Đã hết món"
          >
            Hết món
          </span>
        </div>
      )}

      {/* ─────────────────── PHẦN ẢNH ─────────────────── */}
      {/* Mobile: cố định 80x80px bên trái | sm trở lên: tỉ lệ 4:3 bên trên */}
      <div className="relative shrink-0 w-20 h-20 m-3 sm:m-0 sm:w-full sm:h-auto sm:aspect-[4/3] rounded-xl sm:rounded-none overflow-hidden bg-gradient-to-br from-orange-50/70 to-amber-100/60">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Hình ảnh món ${name}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 80px, (max-width: 1024px) 300px, 400px"
          />
        ) : (
          // Fallback placeholder gradient sang trọng với icon dĩa & thìa chéo
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed
              className="text-orange-400/60"
              strokeWidth={1.5}
              size={28}
            />
          </div>
        )}

        {/* Lớp overlay mờ chồng lên ảnh khi hết món */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[0.5px]" aria-hidden="true" />
        )}
      </div>

      {/* ─────────────────── PHẦN THÔNG TIN ─────────────────── */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4 pl-0 sm:pl-4 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-snug tracking-tight mb-1 group-hover:text-orange-600 transition-colors">
            {name}
          </h3>
          {description && (
            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed hidden sm:block font-normal mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Phần Giá và Nút Thêm */}
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-sm sm:text-base font-semibold text-amber-600 tabular-nums">
            {formatPrice(price)}
          </span>

          {/* Nút Thêm (+) — Ẩn hoàn toàn khi hết món */}
          {!isSoldOut && (
            <button
              onClick={handleAddClick}
              disabled={isSoldOut}
              type="button"
              aria-label={`Thêm món ${name} vào đơn hàng`}
              className="
                flex items-center justify-center
                h-8 w-8 rounded-full bg-amber-600 hover:bg-amber-700 text-white
                shadow-md shadow-orange-100/50 hover:shadow-orange-200/50
                active:scale-90 transition-all duration-200
                sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100
              "
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
