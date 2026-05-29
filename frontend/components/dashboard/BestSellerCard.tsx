'use client';

import Image from 'next/image';
import { useMemo } from 'react';

export type TopSellingItem = {
  rank: number;
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
  orderCount: number;
};

export default function BestSellerCard({ 
  items, 
  period, 
  isLoading 
}: { 
  items: TopSellingItem[], 
  period: { from: string, to: string } | null, 
  isLoading?: boolean 
}) {
  const maxQty = useMemo(() => {
    if (!items?.length) return 0;
    return Math.max(...items.map(i => i.totalQty));
  }, [items]);

  const fmtCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl flex flex-col h-full w-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
            🏆 Món bán chạy nhất
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">Khoảng thời gian đã chọn</p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 bg-zinc-800 rounded-md"></div>
              <div className="w-10 h-10 bg-zinc-800 rounded-full shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                <div className="h-2 bg-zinc-800 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : items?.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Chưa có dữ liệu bán hàng
          </div>
        ) : (
          items?.map((item) => (
            <div key={item.menuItemId} className="flex items-center gap-3 relative">
              <div className={`flex items-center justify-center font-bold shrink-0 ${
                item.rank === 1 ? 'text-amber-400 text-xl w-8' :
                item.rank === 2 ? 'text-zinc-300 text-lg w-8' :
                item.rank === 3 ? 'text-amber-600 text-lg w-8' :
                'text-zinc-600 text-sm w-8'
              }`}>
                #{item.rank}
              </div>
              
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center border border-zinc-700">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                ) : (
                  <span className="text-lg">🍽️</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1">
                  <p className="text-sm font-semibold text-zinc-100 truncate pr-2">{item.name}</p>
                  <p className="text-xs font-bold text-emerald-400 shrink-0">{item.totalQty} phần</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-zinc-500 truncate">{item.categoryName}</p>
                  <p className="text-[10px] text-zinc-400">{fmtCurrency(item.totalRevenue)}</p>
                </div>
                
                <div className="mt-1.5 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      item.rank === 1 ? 'bg-amber-400' :
                      item.rank === 2 ? 'bg-zinc-300' :
                      item.rank === 3 ? 'bg-amber-600' :
                      'bg-violet-500'
                    }`} 
                    style={{ width: `${(item.totalQty / maxQty) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
