import { create } from 'zustand';
import { getAccessTokenFromCookie } from '../lib/auth/client';

type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN';

type AuthStore = {
  user: { id: string; email: string; name: string; role: Role } | null;
  isLoading: boolean;
  setUser: (user: AuthStore['user']) => void;
  clearUser: () => void;
  fetchCurrentUser: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
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
  }
}));
