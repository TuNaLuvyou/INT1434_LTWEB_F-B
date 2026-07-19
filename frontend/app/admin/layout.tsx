"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAuthStore } from "@/stores/auth.store";
import { Loader2, LogOut, Store } from 'lucide-react';
import { logout } from '@/lib/auth/client';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchCurrentUser, isLoading, user } = useAuthStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // ADMIN chưa chọn branch → redirect đến trang chọn branch
  useEffect(() => {
    if (!isLoading && user && user.role === 'ADMIN' && !user.currentBranchId) {
      if (pathname !== '/branch-select') {
        router.replace('/branch-select');
      }
    }
  }, [isLoading, user, router, pathname]);

  if (!user && isLoading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
          <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase animate-pulse">Đang xác thực phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  // MANAGER/KITCHEN/CASHIER chưa có branch → báo lỗi không được tham gia công ty
  if (user && (user.role === 'MANAGER' || user.role === 'KITCHEN' || user.role === 'CASHIER') && !user.currentBranchId) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center font-sans text-center px-6">
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800 shadow-xl max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <Store className="h-8 w-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-black text-zinc-300 mb-2">Chưa có chi nhánh</h2>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            Bạn chưa được tham gia vào công ty nào. Vui lòng liên hệ quản trị viên để được gán chi nhánh.
          </p>
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-red-950/30 border border-zinc-700 hover:border-red-900/50 text-xs font-bold text-zinc-300 hover:text-red-300 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // ADMIN chưa có branch → chờ useEffect redirect
  if (user && user.role === 'ADMIN' && !user.currentBranchId) {
    return pathname === '/branch-select' ? <>{children}</> : null;
  }

  // Không render sidebar nếu chưa có branch hoặc đang ở trang chọn branch
  if (!user || pathname === '/branch-select') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans relative">
      <AdminSidebar />
      <div className="flex-1 min-w-0 relative flex flex-col overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
