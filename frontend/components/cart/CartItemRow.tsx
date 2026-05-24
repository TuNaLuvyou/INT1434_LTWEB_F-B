'use client';

/**
 * CartItemRow.tsx — Row hiển thị 1 item trong Cart Drawer
 *
 * Props:
 *   item        — CartItem data
 *   onQtyChange — callback khi tăng/giảm qty
 *   onNoteChange— callback khi nhập ghi chú (debounced ở đây để tránh re-render)
 *   onRemove    — callback khi xóa hẳn item (qty về 0)
 */

import Image from 'next/image';
import { Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CartItem } from '@/stores/cart.store';

const formatVND = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

type CartItemRowProps = {
  item: CartItem;
  onQtyChange: (menuItemId: string, newQty: number) => void;
  onNoteChange: (menuItemId: string, note: string) => void;
  onRemove: (menuItemId: string) => void;
};

export default function CartItemRow({
  item,
  onQtyChange,
  onNoteChange,
  onRemove,
}: CartItemRowProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onNoteChange(item.menuItemId, value);
    }, 300);
  };

  const handleDecrement = () => {
    if (item.qty <= 1) {
      onRemove(item.menuItemId);
    } else {
      onQtyChange(item.menuItemId, item.qty - 1);
    }
  };

  return (
    <div className="group flex flex-col gap-2 py-3 border-b border-gray-100 last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-orange-50 border border-orange-100">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-orange-300" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
            {item.name}
          </p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">
            {formatVND(item.price)} / phần
          </p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            = {formatVND(item.price * item.qty)}
          </p>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nút giảm / xóa */}
          <button
            type="button"
            onClick={handleDecrement}
            aria-label={item.qty <= 1 ? `Xóa ${item.name}` : `Giảm số lượng ${item.name}`}
            className={`
              flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-150
              ${item.qty <= 1
                ? 'border-red-200 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600'
                : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }
            `}
          >
            {item.qty <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
          </button>

          <span className="w-5 text-center text-sm font-bold text-gray-800 tabular-nums">
            {item.qty}
          </span>

          {/* Nút tăng */}
          <button
            type="button"
            onClick={() => onQtyChange(item.menuItemId, item.qty + 1)}
            disabled={item.qty >= 20}
            aria-label={`Tăng số lượng ${item.name}`}
            className="flex items-center justify-center w-7 h-7 rounded-full border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Note toggle */}
      <div className="pl-[68px]">
        <button
          type="button"
          onClick={() => setNoteOpen((o) => !o)}
          className="text-[11px] text-gray-400 hover:text-amber-600 transition-colors"
        >
          {noteOpen ? '▲ Ẩn ghi chú' : '✎ Thêm ghi chú...'}
          {item.note && !noteOpen && (
            <span className="ml-1 text-amber-500 font-medium">({item.note.slice(0, 20)}{item.note.length > 20 ? '…' : ''})</span>
          )}
        </button>

        {noteOpen && (
          <textarea
            rows={2}
            defaultValue={item.note}
            onChange={handleNoteChange}
            placeholder="VD: không cay, ít muối, không hành..."
            maxLength={200}
            className="mt-1.5 w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:bg-white resize-none transition-all"
          />
        )}
      </div>
    </div>
  );
}
