"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAuthStore } from "@/stores/auth.store";
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { fetchCurrentUser, isLoading, user } = useAuthStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Nếu đã load xong mà vẫn không có user → redirect về login
  // Dùng router.replace để xóa trang admin khỏi history (bấm Back không quay lại được)
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Render a beautiful, premium glassmorphic loading screen during initial auth fetch
  if (isLoading && !user) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
          <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase animate-pulse">Đang xác thực phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans relative">
      {/* Left Sidebar */}
      <AdminSidebar />

      {/* Main Page Area */}
      <div className="flex-1 min-w-0 relative flex flex-col overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
