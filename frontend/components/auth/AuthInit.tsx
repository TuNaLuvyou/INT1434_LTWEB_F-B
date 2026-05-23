'use client';

import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function AuthInit() {
  useAutoRefresh(); // Kích hoạt vòng lặp chạy ngầm refresh token mỗi 13 phút
  return null; // Không render giao diện
}
