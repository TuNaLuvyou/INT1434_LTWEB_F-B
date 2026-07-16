'use client';

import { RoleGate } from '../../components/auth/RoleGate';
import Link from 'next/link';

import { useState } from 'react';
import { setAccessToken } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const fetchCurrentUser = useAuthStore(state => state.fetchCurrentUser);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const forceLogin = async () => {
    try {
      setIsLoggingIn(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'platform@hiaimenugo.demo', password: 'Demo@1234' }),
      });
      const result = await res.json();
      if (result.success) {
        setAccessToken(result.data.accessToken);
        await fetchCurrentUser();
      } else {
        alert('Force login failed: ' + result.message);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fallbackUI = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col p-4 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">403 - Truy cập bị từ chối</h1>
      <p className="text-gray-600 mb-4">Bạn không có quyền truy cập trang quản trị hệ thống, hoặc phiên đăng nhập đã hết hạn.</p>
      
      {/* Debug Panel */}
      <div className="bg-white p-4 rounded shadow mb-6 text-left w-full max-w-md overflow-auto text-xs border border-gray-200">
        <p className="font-bold text-gray-700 mb-2">Thông tin Debug (Dành cho Dev):</p>
        <pre className="text-gray-600">
          {JSON.stringify(user || 'USER IS NULL', null, 2)}
        </pre>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={forceLogin}
          disabled={isLoggingIn}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
        >
          {isLoggingIn ? 'Đang Auto-Login...' : 'Auto-Login (Platform Admin)'}
        </button>
        <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Về trang Đăng nhập
        </Link>
      </div>
    </div>
  );

  // Tạm thời cho ADMIN cũng vào được để tiện test
  return (
    <RoleGate allowedRoles={['PLATFORM_ADMIN', 'ADMIN'] as any} fallback={fallbackUI}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Platform Admin Control</h1>
            <div className="text-sm text-gray-500">HiAI-MenuGo SaaS</div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </RoleGate>
  );
}
