'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setAccessToken, getAccessTokenFromCookie } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

export function useAutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Xác định xem trang hiện tại có phải là trang yêu cầu đăng nhập không
  const isProtected = pathname ? (
    pathname.startsWith('/admin') || 
    pathname.startsWith('/cashier') || 
    pathname.startsWith('/kds') ||
    pathname.startsWith('/platform-admin')
  ) : false;

  // Xử lý bfcache (Back-Forward Cache):
  // Khi user bấm Back/Forward, trình duyệt khôi phục trang từ bfcache mà không chạy lại useEffect.
  // Điều này khiến Zustand store bị stale (user = null) và nút đăng xuất biến mất.
  // Fix: lắng nghe event pageshow với persisted = true để re-sync trạng thái auth.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Trang được khôi phục từ bfcache → re-sync auth state
        const { fetchCurrentUser } = useAuthStore.getState();
        fetchCurrentUser();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  useEffect(() => {
    // 13 minutes = 780000ms
    const refreshInterval = 13 * 60 * 1000;

    const refreshToken = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (res.ok) {
          const result = await res.json();
          setAccessToken(result.data.accessToken);
          console.log('[Auth] Token automatically refreshed');
          
          // Cập nhật lại thông tin user trong store nếu refresh thành công
          const { fetchCurrentUser, user } = useAuthStore.getState();
          if (!user) {
            fetchCurrentUser();
          } else {
            useAuthStore.setState({ isLoading: false });
          }
        } else {
          console.warn('[Auth] Auto-refresh failed');
          const currentToken = getAccessTokenFromCookie();
          if (currentToken && !useAuthStore.getState().user) {
            // Still have access token, try to fetch user
            useAuthStore.getState().fetchCurrentUser();
          } else {
            useAuthStore.setState({ isLoading: false });
            if (isProtected && !currentToken) {
              router.replace('/login?reason=expired');
            }
          }
        }
      } catch (error) {
        console.warn('[Auth] Auto-refresh network error');
        const currentToken = getAccessTokenFromCookie();
        if (currentToken && !useAuthStore.getState().user) {
          useAuthStore.getState().fetchCurrentUser();
        } else {
          useAuthStore.setState({ isLoading: false });
        }
      }
    };

    // 1. Gọi ngay 1 lần khi người dùng vừa load web
    refreshToken();

    // 2. Sau đó thiết lập vòng lặp 13 phút
    const intervalId = setInterval(refreshToken, refreshInterval);

    return () => clearInterval(intervalId);
  }, [router, isProtected]);
}
