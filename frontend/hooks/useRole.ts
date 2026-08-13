'use client';
import { useAuthStore } from '@/stores/auth.store';

export type Role = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';

export function useRole(): Role | null {
  return useAuthStore(state => state.user?.role ?? null);
}
