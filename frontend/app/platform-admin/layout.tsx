'use client';

import { RoleGate } from '../../components/auth/RoleGate';
import Link from 'next/link';

import { useAuthStore } from '@/stores/auth.store';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  
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

      <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
        Về trang Đăng nhập
      </Link>
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
