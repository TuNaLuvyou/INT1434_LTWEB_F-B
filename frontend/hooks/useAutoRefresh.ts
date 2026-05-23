'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/auth/client';

export function useAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // 13 minutes = 780000ms
    const refreshInterval = 13 * 60 * 1000;

    const intervalId = setInterval(async () => {
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
        } else {
          console.warn('[Auth] Auto-refresh failed, redirecting to login');
          router.push('/login?reason=expired');
        }
      } catch (error) {
        console.error('[Auth] Auto-refresh network error');
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [router]);
}
