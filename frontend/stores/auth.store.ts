import { create } from 'zustand';
import { getAccessTokenFromCookie } from '../lib/auth/client';

type Role = 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER' | 'PLATFORM_ADMIN';

type UserData = {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenants?: any[];
  currentTenantId?: string;
  currentBranchId?: string;
  customRole?: string;
  permissions?: string[];
  currentTenant?: any;
};

type AuthStore = {
  user: UserData | null;
  isLoading: boolean;
  setUser: (user: AuthStore['user']) => void;
  clearUser: () => void;
  fetchCurrentUser: () => Promise<void>;
  selectTenant: (tenantId: string, branchId?: string) => Promise<boolean>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  fetchCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const token = getAccessTokenFromCookie();
      if (!token) {
        set({ user: null, isLoading: false });
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        set({ user: data.data.user });
      } else {
        set({ user: null });
      }
    } catch (error) {
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },
  selectTenant: async (tenantId: string, branchId?: string) => {
    try {
      const token = getAccessTokenFromCookie();
      if (!token) return false;

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tenantId, branchId })
      });

      if (res.ok) {
        // Sau khi select tenant, server trả JWT mới vào refresh token cookie + trả access token mới trong response
        // Client cần refresh lại getMe
        await get().fetchCurrentUser();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Select tenant failed', e);
      return false;
    }
  }
}));
