'use client';
import { useAuthStore } from '@/stores/auth.store';

export type Role = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';

export function useRole(): Role | null {
  return useAuthStore(state => state.user?.role ?? null);
}

function useHasRole(allowedRoles: Role[]): boolean {
  const role = useRole();
  if (!role) return false;
  return allowedRoles.includes(role);
}

function useIsAdmin(): boolean {
  return useHasRole(['ADMIN']);
}

function useIsManagerOrAbove(): boolean {
  return useHasRole(['ADMIN', 'MANAGER']);
}
