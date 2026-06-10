'use client';
import { useAuthStore } from '@/stores/auth.store';

export type Role = 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';

export function useRole(): Role | null {
  return useAuthStore(state => state.user?.role ?? null);
}

export function useHasRole(allowedRoles: Role[]): boolean {
  const role = useRole();
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function useIsAdmin(): boolean {
  return useHasRole(['ADMIN']);
}

export function useIsManagerOrAbove(): boolean {
  return useHasRole(['ADMIN', 'MANAGER']);
}
