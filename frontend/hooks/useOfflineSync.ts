'use client';

import { useEffect } from 'react';
import { useOfflineStore } from '@/stores/offline.store';

export function useOfflineSync() {
  const { setOnline, setOffline, sync, setPendingCount } = useOfflineStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!navigator.onLine) setOffline();

    const handleOnline = async () => {
      setOnline();
      await sync();
    };
    const handleOffline = () => setOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    import('@/lib/offline/queue')
      .then(({ getQueueCount }) => getQueueCount())
      .then(setPendingCount)
      .catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline, setOffline, sync, setPendingCount]);
}
