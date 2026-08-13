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
  features?: string[];
  planName?: string | null;
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

let fetchSeq = 0;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,
  setUser: (user) => set({ user, isLoading: false }),
  clearUser: () => set({ user: null, isLoading: false, error: null }),
  fetchCurrentUser: async () => {
    // Sequence number để bỏ qua kết quả của các request cũ/đã bị hủy nếu có request mới hơn.
    // Không dùng mutation trực tiếp trong state — dùng biến module-scoped để tránh render lại.
    const seq = ++fetchSeq;
    if (!get().user) {
      set({ isLoading: true, error: null });
    }
    try {
      const token = getAccessTokenFromCookie();
      if (!token) {
        // Chỉ null user nếu chưa có user (bỏ qua nếu đã có — tránh mất session do lỗi tạm thời)
        if (seq === fetchSeq && !get().user) {
          set({ user: null, isLoading: false });
        }
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Nếu có request fetchCurrentUser mới hơn bắt đầu, bỏ qua kết quả này (đã stale)
      if (seq !== fetchSeq) return;

      if (res.ok) {
        const data = await res.json();
        const userData = data.data.user;
        
        // Tự động select tenant đầu tiên nếu chưa có (để có context tenantId trong token)
        if (!userData.currentTenantId && userData.tenants?.length > 0 && userData.role !== 'PLATFORM_ADMIN') {
          // selectTenant tự động gọi lại fetchCurrentUser sau khi lấy token mới
          const ok = await get().selectTenant(userData.tenants[0].id);
          if (!ok && seq === fetchSeq) {
            set({ user: null, isLoading: false });
          }
          return; // Dừng luồng hiện tại để luồng đệ quy fetchCurrentUser xử lý
        }
        
        set({ user: userData });
      } else {
        // /me lỗi (401/403/...): chỉ null user nếu chưa có — nếu đã có session thì giữ nguyên,
        // tránh "bounce" về /login khi token tạm thời chưa được refresh xong.
        if (!get().user) {
          set({ user: null });
        }
      }
    } catch (error) {
      // Network error / request bị hủy (ví dụ user vừa bấm navigation): giữ session hiện tại
      if (!get().user) {
        set({ user: null });
      }
    } finally {
      if (seq === fetchSeq) {
        set(state => { if (state.isLoading) return { isLoading: false }; return {}; });
      }
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
