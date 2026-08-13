'use client';

import { create } from 'zustand';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type OfflineStore = {
  isOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;

  setOnline: () => void;
  setOffline: () => void;
  setPendingCount: (n: number) => void;
  sync: () => Promise<void>;
};

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  isOffline: false,
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,

  setOnline: () => set({ isOffline: false }),
  setOffline: () => set({ isOffline: true }),
  setPendingCount: (n) => set({ pendingCount: n }),

  sync: async () => {
    if (get().isSyncing) return;
    const { getQueue, removeFromQueue, incrementRetry } = await import('@/lib/offline/queue');
    const queue = await getQueue();
    if (queue.length === 0) return;

    set({ isSyncing: true, syncError: null });

    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/sessions/offline-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ actions: queue }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json() as {
        data: { clientId: string; success: boolean; error?: string }[]
      };

      for (const result of json.data) {
        if (result.success) {
          await removeFromQueue(result.clientId);
        } else {
          await incrementRetry(result.clientId);
        }
      }

      const remaining = await getQueue();
      set({ pendingCount: remaining.length, lastSyncAt: new Date() });
    } catch (err: any) {
      set({ syncError: err.message });
    } finally {
      set({ isSyncing: false });
    }
  },
}));
