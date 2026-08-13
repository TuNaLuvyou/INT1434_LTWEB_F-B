'use client';

import Image from 'next/image';
import { Plus, UtensilsCrossed } from 'lucide-react';

export type MenuCardItem = {
  id: string;
  name: string;
  englishName?: string | null;
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

const COMMON_FNB_TRANSLATIONS: Record<string, string> = {
  'cà phê sữa đá': 'Iced Milk Coffee',
  'cà phê đen đá': 'Iced Black Coffee',
  'cà phê muối': 'Salted Coffee',
  'bạc xỉu': 'White Coffee',
  'nước chanh tươi': 'Fresh Lemonade',
  'trà đào cam sả': 'Peach Orange Lemongrass Tea',
  'trà sữa trân châu': 'Boba Milk Tea',
  'trà chanh': 'Lemon Tea',
  'trà tắc': 'Kumquat Tea',
  'trà vải': 'Lychee Tea',
  'bánh flan': 'Caramel Flan',
  'chè đậu xanh': 'Mung Bean Sweet Soup',
  'chè thái': 'Thai Sweet Soup',
  'sinh tố bơ': 'Avocado Smoothie',
  'sinh tố xoài': 'Mango Smoothie',
  'sinh tố dâu': 'Strawberry Smoothie',
  'phở bò': 'Beef Pho',
  'bún chả': 'Grilled Pork Noodles',
  'cơm tấm': 'Broken Rice',
};

export const getCleanEnglishName = (name: string, englishName?: string | null): string | null => {
  if (englishName && typeof englishName === 'string') {
    const trimmed = englishName.trim();
    if (
      !trimmed.startsWith('{') && 
      !trimmed.startsWith('[') && 
      !trimmed.includes('"sugar"') && 
      !trimmed.includes('"ice"') && 
      !trimmed.includes('100%')
    ) {
      return trimmed;
    }
  }

  const lowerName = (name || '').toLowerCase().trim();
  if (COMMON_FNB_TRANSLATIONS[lowerName]) {
    return COMMON_FNB_TRANSLATIONS[lowerName];
  }

  return null;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

export default function MenuCard({ item, onAddToCart, priority = false }: MenuCardProps) {
  const { id, name, englishName, description, price, imageUrl, isSoldOut } = item;
  const cleanEn = getCleanEnglishName(name, englishName);

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
        flex items-center gap-3 bg-white rounded-2xl border border-gray-100/90 shadow-2xs p-2.5 sm:p-3
        transition-all duration-200 hover:shadow-xs active:scale-[0.99]
        ${isSoldOut
          ? 'opacity-50 cursor-not-allowed'
          : 'active:bg-gray-50/80 cursor-pointer'
        }
      `}
    >
      <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-gray-50/80">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            priority={priority}
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60">
            <UtensilsCrossed className="text-gray-300" size={20} />
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 bg-white/40" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate leading-snug">
            {name}
            {cleanEn && <span className="ml-1.5 text-[11px] font-normal text-gray-400">({cleanEn})</span>}
          </h3>
          {!isSoldOut && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(id); }}
              type="button"
              aria-label={`Thêm ${name}`}
              className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full text-white flex items-center justify-center transition-transform active:scale-90 shadow-xs"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs sm:text-sm font-bold tabular-nums" style={{ color: 'var(--color-secondary)' }}>
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </div>
  );
}
