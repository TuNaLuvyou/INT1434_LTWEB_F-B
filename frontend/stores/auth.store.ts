import { create } from 'zustand';
import { getAccessTokenFromCookie, setAccessToken } from '../lib/auth/client';

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
  currentBranch?: any;
};

type AuthStore = {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthStore['user']) => void;
  clearUser: () => void;
  fetchCurrentUser: () => Promise<void>;
  selectTenant: (tenantId: string, branchId?: string) => Promise<boolean>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,
  setUser: (user) => set({ user, isLoading: false }),
  clearUser: () => set({ user: null, isLoading: false, error: null }),
  fetchCurrentUser: async () => {
    set({ isLoading: true, error: null });
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
        const userData = data.data.user;
        
        // Tự động select tenant đầu tiên nếu chưa có (để có context tenantId trong token)
        if (!userData.currentTenantId && userData.tenants?.length > 0 && userData.role !== 'PLATFORM_ADMIN') {
          // selectTenant tự động gọi lại fetchCurrentUser sau khi lấy token mới
          const ok = await get().selectTenant(userData.tenants[0].id);
          if (!ok) {
            set({ user: null, isLoading: false });
          }
          return; // Dừng luồng hiện tại để luồng đệ quy fetchCurrentUser xử lý
        }
        
        set({ user: userData });
      } else {
        set({ user: null });
      }
    } catch (error) {
      set({ user: null });
    } finally {
      set(state => { if (state.isLoading) return { isLoading: false }; return {}; });
    }
  },
  selectTenant: async (tenantId: string, branchId?: string) => {
    try {
      const token = getAccessTokenFromCookie();
      if (!token) return false;

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/tenant`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tenantId, branchId })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        await get().fetchCurrentUser();
        return true;
      }
      set({ error: data.message || 'Không thể chọn tenant', isLoading: false });
      return false;
    } catch (e) {
      set({ error: 'Lỗi kết nối', isLoading: false });
      return false;
    }
  }
}));
