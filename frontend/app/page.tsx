"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Store, 
  ChefHat, 
  BarChart3, 
  ArrowRight, 
  Layers,
  Table,
  LogOut,
  Server
} from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { logout, getAccessTokenFromCookie } from "../lib/auth/client";

export default function Home() {
  const router = useRouter();
  const { user, isLoading, fetchCurrentUser } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [stats, setStats] = useState({
    pendingOrdersCount: 0,
    occupiedTablesCount: 0,
    todayRevenue: 0
  });

  useEffect(() => {
    setIsMounted(true);
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Ready khi auth đã resolve
  useEffect(() => {
    if (isMounted && !isLoading) {
      const timer = setTimeout(() => setPageReady(true), 200);
      return () => clearTimeout(timer);
    }
  }, [isMounted, isLoading]);

  // Chưa đăng nhập → redirect login
  useEffect(() => {
    if (isMounted && !isLoading && !user) {
      router.replace('/login');
    }
  }, [isMounted, isLoading, user, router]);

  // ADMIN chưa chọn branch → redirect
  useEffect(() => {
    if (!isLoading && user && user.role === 'ADMIN' && !user.currentBranchId) {
      router.replace('/branch-select');
    }
  }, [isLoading, user, router]);

  // MANAGER/KITCHEN/CASHIER chưa có branch → chặn
  const noBranchBlocked = user && (user.role === 'MANAGER' || user.role === 'KITCHEN' || user.role === 'CASHIER') && !user.currentBranchId;

  useEffect(() => {
    const fetchStats = async () => {
      const token = getAccessTokenFromCookie();
      if (!token) return;
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/system/overview`);
        if (user?.currentBranchId) {
          url.searchParams.append('branchId', user.currentBranchId);
        }
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      } catch (err) {}
    };
    if (isMounted && hasToken) {
      fetchStats();
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isMounted, user?.currentBranchId]);

  const hasToken = isMounted ? !!getAccessTokenFromCookie() : false;

  const isGuest = !hasToken;
  const isAuthLoading = hasToken && isLoading;

  const apps = [
    {
      title: "Point of Sale (POS)",
      description: "Hệ thống bán hàng tại quầy nhanh chóng, trực quan. Quản lý giỏ hàng, tính hóa đơn và thanh toán mô phỏng.",
      href: "/pos",
      icon: Store,
      color: "from-blue-600 to-cyan-500",
      accent: "blue",
      metrics: { label: "Hệ thống", value: "Online" },
      borderHover: "hover:border-blue-800",
      visible: !isAuthLoading && (isGuest || (user && ["ADMIN", "MANAGER", "CASHIER"].includes(user.role)))
    },
    {
      title: "Kitchen Display (KDS)",
      description: "Màn hình hiển thị nhà bếp thời gian thực. Theo dõi thời gian chuẩn bị món ăn, điều phối đơn hàng và trạng thái nấu nướng.",
      href: "/kds",
      icon: ChefHat,
      color: "from-amber-500 to-orange-600",
      accent: "orange",
      metrics: { label: "Đang xử lý", value: `${stats.pendingOrdersCount} Đơn hàng` },
      borderHover: "hover:border-amber-800",
      visible: !isAuthLoading && (isGuest || (user && ["ADMIN", "MANAGER", "KITCHEN"].includes(user.role)))
    },
    {
      title: "Admin Analytics",
      description: "Trình quản trị và phân tích dữ liệu kinh doanh. Theo dõi doanh thu, số lượng đơn hàng, lịch sử giao dịch và biểu đồ tăng trưởng.",
      href: "/admin/dashboard",
      icon: BarChart3,
      color: "from-violet-600 to-purple-500",
      accent: "violet",
      metrics: { label: "Doanh thu hôm nay", value: isMounted ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.todayRevenue) : "0 ₫" },
      borderHover: "hover:border-violet-800",
      visible: !isAuthLoading && (isGuest || (user && ["ADMIN", "MANAGER"].includes(user.role)))
    },

    {
      title: "Table",
      description: "Danh sách các bàn trong nhà hàng — giao diện nội bộ (quản lý, POS, KDS).",
      href: "/table",
      icon: Table,
      color: "from-emerald-700 to-emerald-500",
      accent: "emerald",
      metrics: { label: "Đang phục vụ", value: `${stats.occupiedTablesCount} Bàn` },
      borderHover: "hover:border-emerald-800",
      visible: !isAuthLoading && (isGuest || (user && ["ADMIN", "MANAGER", "CASHIER"].includes(user.role)))
    },
    {
      title: "Platform Admin",
      description: "Bảng điều khiển trung tâm dành cho System Admin. Quản lý toàn bộ SaaS, các chuỗi nhà hàng (Tenants) và hệ thống.",
      href: "/platform-admin",
      icon: Server,
      color: "from-rose-600 to-pink-500",
      accent: "rose",
      metrics: { label: "Hệ thống", value: "Root" },
      borderHover: "hover:border-rose-800",
      visible: !isAuthLoading && user?.role === "PLATFORM_ADMIN"
    }
  ].filter(app => app.visible);

  const visibleApps = apps.filter((app) => app.visible !== false);

  // Loading splash screen
  if (!pageReady && !noBranchBlocked) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-2 text-center">
            <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mx-auto" />
            <div className="h-3 w-20 bg-zinc-800/50 rounded animate-pulse mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Màn hình chặn khi chưa có chi nhánh
  if (noBranchBlocked) {
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

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      {/* Background Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Server className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                HiAI OS
              </span>
              <span className="text-[9px] sm:text-[10px] block font-medium text-indigo-400 uppercase tracking-widest leading-none mt-0.5">
                Enterprise Suite
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isMounted && (
              user ? (
                <div className="flex items-center gap-3 animate-fade-in">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-zinc-200 leading-none">{user.name}</p>
                    <p className="text-[9px] text-indigo-400 font-semibold tracking-wider uppercase mt-1">
                      {user.role}
                      {user.currentTenant?.name ? <span className="text-zinc-500 font-normal ml-1">· {user.currentTenant.name}</span> : ''}
                      {user.currentBranch?.name ? <span className="text-violet-400 font-normal ml-1">· {user.currentBranch.name}</span> : ''}
                    </p>
                  </div>
                  {user.currentBranchId && user.role === 'ADMIN' && (
                    <Link
                      href="/branch-select"
                      className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-500 text-white text-xs font-bold transition-all"
                    >
                      <Store className="h-3.5 w-3.5" />
                      Đổi chi nhánh
                    </Link>
                  )}
                  <button
                    onClick={() => logout()}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-300 text-xs font-bold text-zinc-300 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Đăng xuất
                  </button>
                </div>
              ) : (isLoading || hasToken) ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block space-y-1">
                    <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-2 w-10 bg-zinc-800 rounded animate-pulse ml-auto" />
                  </div>
                  <div className="h-9 w-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
                </div>
              ) : null
            )}
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 flex flex-col justify-center relative z-10 w-full min-h-0">
        <div className={`grid gap-3 sm:gap-4 lg:gap-6 ${visibleApps.length === 1 ? 'grid-cols-1 max-w-xl mx-auto w-full' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {visibleApps.map((app) => {
            const IconComponent = app.icon;
            const accentHover = {
              blue: 'group-hover:text-blue-300',
              orange: 'group-hover:text-orange-300',
              violet: 'group-hover:text-violet-300',
              emerald: 'group-hover:text-emerald-300',
              rose: 'group-hover:text-rose-300',
            }[app.accent] || 'group-hover:text-indigo-300';
            const accentDot = {
              blue: 'bg-blue-400',
              orange: 'bg-orange-400',
              violet: 'bg-violet-400',
              emerald: 'bg-emerald-400',
              rose: 'bg-rose-400',
            }[app.accent] || 'bg-indigo-400';
            return (
              <Link 
                key={app.title} 
                href={app.href}
                className={`group relative block overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-900 bg-zinc-900/40 p-5 sm:p-6 lg:p-8 transition-all duration-300 hover:scale-[1.01] hover:bg-zinc-900/60 shadow-xl ${app.borderHover || 'hover:border-zinc-800'}`}
              >
                {/* Glow effect on hover */}
                <div className={`absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-tr ${app.color} opacity-0 blur-[50px] transition-all duration-500 group-hover:opacity-25 group-hover:-translate-x-6 group-hover:translate-y-6`} />

                <div className="flex items-start justify-between">
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr ${app.color} p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/5`}>
                    <div className="h-full w-full rounded-[10px] sm:rounded-[14px] bg-zinc-950 flex items-center justify-center">
                      <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${app.accent === 'emerald' ? 'text-emerald-300 group-hover:text-white' : 'text-zinc-100 group-hover:text-white'} transition-colors duration-300`} />
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 border border-zinc-800 px-2.5 sm:px-3 py-1 text-xs font-semibold text-zinc-300">
                    <span className={`h-1.5 w-1.5 rounded-full ${accentDot} animate-pulse`} />
                    <span className="hidden sm:inline">{app.metrics.value}</span>
                    <span className="sm:hidden text-[10px]">{app.metrics.value}</span>
                  </span>
                </div>

                <div className="mt-4 sm:mt-6 space-y-1 sm:space-y-2">
                  <h2 className={`text-base sm:text-xl font-bold tracking-tight text-white ${accentHover} transition-colors duration-300 flex items-center gap-2`}>
                    {app.title}
                    <ArrowRight className={`h-4 w-4 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${accentHover}`} />
                  </h2>
                  <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed line-clamp-2 sm:line-clamp-3">
                    {app.description}
                  </p>
                </div>

                <div className="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono uppercase tracking-wider hidden sm:inline">Hệ thống con</span>
                  <span className="font-mono uppercase tracking-wider sm:hidden">Module</span>
                  <span className={`${accentHover} transition-colors`}>Truy cập ngay &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-5 sm:py-8 text-center text-xs text-zinc-600 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p>&copy; 2026 HiAI OS. Toàn bộ hệ thống đã được đồng bộ.</p>
        </div>
      </footer>
    </div>
  );
}
