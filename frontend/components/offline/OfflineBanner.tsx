'use client';

import { useOfflineStore } from '@/stores/offline.store';

export function OfflineBanner() {
  const { isOffline, pendingCount, isSyncing } = useOfflineStore();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      className={[
        'fixed top-0 left-0 right-0 z-[9999] py-2 px-4 text-center',
        'text-sm font-medium flex items-center justify-center gap-2',
        isOffline ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white',
      ].join(' ')}
    >
      {isOffline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse inline-block" />
          Bạn đang offline — Đơn hàng sẽ được gửi khi có mạng
          {pendingCount > 0 && (
            <span className="ml-2 bg-white text-red-600 rounded-full px-2 py-0.5 text-xs font-bold">
              {pendingCount} chờ sync
            </span>
          )}
        </>
      ) : isSyncing ? (
        <span>Đang đồng bộ {pendingCount} đơn hàng chờ...</span>
      ) : (
        <span>Đã kết nối lại — Đồng bộ hoàn tất</span>
      )}
    </div>
  );
}
