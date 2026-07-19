'use client';

import Image from 'next/image';
import { Plus, UtensilsCrossed } from 'lucide-react';

export type MenuCardItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isSoldOut: boolean;
};

type MenuCardProps = {
  item: MenuCardItem;
  onAddToCart: (itemId: string) => void;
  priority?: boolean;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

export default function MenuCard({ item, onAddToCart, priority = false }: MenuCardProps) {
  const { id, name, description, price, imageUrl, isSoldOut } = item;

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
        flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5
        transition-colors duration-150
        ${isSoldOut
          ? 'opacity-50 cursor-not-allowed'
          : 'active:bg-orange-50 cursor-pointer'
        }
      `}
    >
      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            priority={priority}
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed className="text-gray-300" size={20} />
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 bg-white/40" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate leading-snug">
            {name}
          </h3>
          {!isSoldOut && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(id); }}
              type="button"
              aria-label={`Thêm ${name}`}
              className="shrink-0 h-7 w-7 rounded-full bg-amber-500 text-white flex items-center justify-center active:bg-amber-600 transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-bold text-amber-600 tabular-nums">
            {formatPrice(price)}
          </span>
          {isSoldOut && (
            <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded">
              Hết
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
