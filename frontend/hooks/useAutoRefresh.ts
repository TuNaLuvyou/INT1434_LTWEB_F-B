'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setAccessToken } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

export function useAutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Xác định xem trang hiện tại có phải là trang yêu cầu đăng nhập không
  const isProtected = pathname ? (
    pathname.startsWith('/admin') || 
    pathname.startsWith('/cashier') || 
    pathname.startsWith('/kds')
  ) : false;

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
          // Tránh lỗi fetchCurrentUser trả về null khi access token cũ đã hết hạn lúc load trang
          const { fetchCurrentUser, user } = useAuthStore.getState();
          if (!user) {
            fetchCurrentUser();
          }
        } else {
          console.warn('[Auth] Auto-refresh failed');
          // CHỈ văng ra màn hình đăng nhập nếu đang ở trang cần bảo mật
          // Nếu ở trang public (menu QR của khách), thì kệ không làm gì cả
          if (isProtected) {
            // Nếu không có token từ cookie (thực sự hết hạn toàn bộ) thì mới văng ra
            const currentToken = getAccessTokenFromCookie();
            if (!currentToken) {
              router.push('/login?reason=expired');
            }
          }
        }
      } catch (error) {
        console.warn('[Auth] Auto-refresh network error');
      }
    };

    // 1. Gọi ngay 1 lần khi người dùng vừa load web để đảm bảo có token tươi mới nhất
    refreshToken();

    // 2. Sau đó mới thiết lập vòng lặp 13 phút
    const intervalId = setInterval(refreshToken, refreshInterval);

    return () => clearInterval(intervalId);
  }, [router, isProtected]);
}
