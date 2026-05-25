'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export interface KdsItem {
  orderItemId: string;
  menuItemName: string;
  menuItemImage: string | null;
  qty: number;
  note: string;
  status: 'PENDING' | 'PREPARING' | 'DONE';
  waitMinutes: number;
  createdAt: string;
}

export interface KdsTicket {
  sessionId: string;
  tableNumber: number;
  tableLabel: string;
  items: KdsItem[];
}

interface TicketCardProps {
  ticket: KdsTicket;
  onStatusChange: (orderItemId: string, status: 'PREPARING' | 'DONE') => Promise<void>;
}

export default function TicketCard({ ticket, onStatusChange }: TicketCardProps) {
  const [localItems, setLocalItems] = useState<KdsItem[]>(ticket.items);
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  // Sync with props when socket updates arrive
  useEffect(() => {
    setLocalItems(ticket.items);
  }, [ticket.items]);

  const maxWaitMinutes = localItems.length > 0
    ? Math.max(...localItems.map(item => item.waitMinutes))
    : 0;

  // Determine border and colors based on maxWaitMinutes
  let borderColor = 'border-green-500';
  let headerColor = 'bg-green-500/10 text-green-400';
  let isPulsing = false;

  if (maxWaitMinutes >= 10) {
    borderColor = 'border-red-500';
    headerColor = 'bg-red-500/10 text-red-400';
    isPulsing = true;
  } else if (maxWaitMinutes >= 5) {
    borderColor = 'border-yellow-500';
    headerColor = 'bg-yellow-500/10 text-yellow-400';
  }

  const allDone = localItems.length > 0 && localItems.every(item => item.status === 'DONE');

  const handleStatusClick = async (item: KdsItem) => {
    if (loadingItems[item.orderItemId]) return;
    if (item.status === 'DONE') return;

    const newStatus = item.status === 'PENDING' ? 'PREPARING' : 'DONE';
    
    // Prevent double tap
    setLoadingItems(prev => ({ ...prev, [item.orderItemId]: true }));

    // Optimistic Update
    const originalItems = [...localItems];
    setLocalItems(prev => prev.map(i => 
      i.orderItemId === item.orderItemId 
        ? { ...i, status: newStatus } 
        : i
    ));

    try {
      await onStatusChange(item.orderItemId, newStatus);
    } catch (error) {
      // Rollback
      setLocalItems(originalItems);
      console.error('Failed to update status', error);
    } finally {
      setTimeout(() => {
        setLoadingItems(prev => ({ ...prev, [item.orderItemId]: false }));
      }, 1000);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`flex flex-col bg-gray-800 rounded-xl border-2 ${allDone ? 'border-green-500 opacity-50 transition-opacity duration-1000' : borderColor} ${isPulsing && !allDone ? 'animate-pulse' : ''} overflow-hidden shadow-lg`}
    >
      {/* Header */}
      <div className={`p-4 ${allDone ? 'bg-green-500/20 text-green-400' : headerColor} flex justify-between items-center border-b border-gray-700`}>
        <h3 className="text-lg font-bold">
          Bàn {ticket.tableNumber} <span className="text-sm font-normal opacity-80">({ticket.tableLabel})</span>
        </h3>
        <div className="flex items-center gap-2 font-mono text-sm font-semibold">
          ⏱ {maxWaitMinutes} phút
        </div>
      </div>

      {/* Items List */}
      <div className="p-3 flex-1 overflow-y-auto">
        <ul className="space-y-3">
          {localItems.map((item) => (
            <li key={item.orderItemId} className="bg-gray-900/50 p-3 rounded-lg flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-3">
                  <div className="w-12 h-12 relative rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
                    {item.menuItemImage ? (
                      <Image src={item.menuItemImage} alt={item.menuItemName} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No img</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-100 text-base leading-tight flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-lg">{item.qty}x</span>
                      {item.menuItemName}
                    </h4>
                    {item.note && (
                      <p className="text-yellow-400 text-sm mt-1 flex gap-1 items-start">
                        <span className="mt-0.5">📝</span> {item.note}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTime(item.createdAt)} • chờ {item.waitMinutes}p
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-1 flex justify-end">
                {item.status === 'PENDING' && (
                  <button
                    onClick={() => handleStatusClick(item)}
                    disabled={loadingItems[item.orderItemId]}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    ▶ Bắt đầu làm
                  </button>
                )}
                
                {item.status === 'PREPARING' && (
                  <button
                    onClick={() => handleStatusClick(item)}
                    disabled={loadingItems[item.orderItemId]}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    ✓ Xong
                  </button>
                )}

                {item.status === 'DONE' && (
                  <span className="text-green-500 font-medium text-sm flex items-center gap-1 py-2 px-2">
                    ✓ Hoàn thành
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
