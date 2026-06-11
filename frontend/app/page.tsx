"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Store, 
  ChefHat, 
  BarChart3, 
  BookOpen, 
  ArrowRight, 
  Activity, 
  Clock, 
  TrendingUp, 
  Layers,
  Utensils,
  Table,
  UserCheck,
  LogOut
} from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { logout, getAccessTokenFromCookie } from "../lib/auth/client";

export default function Home() {
  const { user, isLoading, fetchCurrentUser } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [stats, setStats] = useState({
    pendingOrdersCount: 0,
    occupiedTablesCount: 0,
    todayRevenue: 0
  });

  useEffect(() => {
    setIsMounted(true);
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    const fetchStats = async () => {
      const token = getAccessTokenFromCookie();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/system/overview`, {
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
  }, [isMounted]);

  const hasToken = isMounted ? !!getAccessTokenFromCookie() : false;

  const apps = [
    {
      title: "Point of Sale (POS)",
      description: "Hệ thống bán hàng tại quầy nhanh chóng, trực quan. Quản lý giỏ hàng, tính hóa đơn và thanh toán mô phỏng.",
      href: "/pos",
      icon: Store,
      color: "from-blue-600 to-cyan-500",
      accent: "blue",
      metrics: { label: "Hệ thống", value: "Online" },
      visible: !user || user.role === "ADMIN" || user.role === "MANAGER" || user.role === "CASHIER"
    },
    {
      title: "Kitchen Display (KDS)",
      description: "Màn hình hiển thị nhà bếp thời gian thực. Theo dõi thời gian chuẩn bị món ăn, điều phối đơn hàng và trạng thái nấu nướng.",
      href: "/kds",
      icon: ChefHat,
      color: "from-amber-500 to-orange-600",
      accent: "orange",
      metrics: { label: "Đang xử lý", value: `${stats.pendingOrdersCount} Đơn hàng` },
      visible: !user || user.role === "ADMIN" || user.role === "MANAGER" || user.role === "KITCHEN"
    },
    {
      title: "Admin Analytics",
      description: "Trình quản trị và phân tích dữ liệu kinh doanh. Theo dõi doanh thu, số lượng đơn hàng, lịch sử giao dịch và biểu đồ tăng trưởng.",
      href: "/admin/dashboard",
      icon: BarChart3,
      color: "from-violet-600 to-purple-500",
      accent: "violet",
      metrics: { label: "Doanh thu hôm nay", value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.todayRevenue) },
      visible: !user || user.role === "ADMIN" || user.role === "MANAGER"
    },

    {
      title: "Table",
      description: "Danh sách các bàn trong nhà hàng — giao diện nội bộ (quản lý, POS, KDS).",
      href: "/table",
      icon: Table,
      color: "from-emerald-700 to-emerald-500",
      accent: "emerald",
      metrics: { label: "Đang phục vụ", value: `${stats.occupiedTablesCount} Bàn` },
      visible: !user || user.role === "ADMIN" || user.role === "MANAGER" || user.role === "CASHIER"
    }
  ].filter(app => app.visible);

  const visibleApps = apps.filter((app) => app.visible !== false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      {/* Background Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                LTWEB OS
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
                    <p className="text-[9px] text-indigo-400 font-semibold tracking-wider uppercase mt-1">{user.role}</p>
                  </div>
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

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-20 flex flex-col justify-center relative z-10 w-full">
        <div className="max-w-3xl mb-10 sm:mb-16 space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Activity className="h-3 w-3" />
            <span>Thế hệ phần mềm quản trị nhà hàng thông minh</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Quản trị & Phân phối <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Vận hành Nhà hàng Thông minh
            </span>
          </h1>
          
          <p className="text-zinc-400 text-sm sm:text-lg md:text-xl font-light leading-relaxed max-w-2xl">
            Một hệ sinh thái đồng bộ hoàn chỉnh được thiết kế để kết nối quầy thu ngân (POS), màn hình bếp (KDS), bảng quản lý (Admin), và thực đơn khách hàng (Menu).
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className={`grid gap-4 sm:gap-6 lg:gap-8 ${visibleApps.length === 1 ? 'grid-cols-1 max-w-xl mx-auto w-full' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {visibleApps.map((app) => {
            const IconComponent = app.icon;
            return (
              <Link 
                key={app.title} 
                href={app.href}
                className="group relative block overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-900 bg-zinc-900/40 p-5 sm:p-8 transition-all duration-300 hover:scale-[1.01] hover:border-zinc-800 hover:bg-zinc-900/60 shadow-xl"
              >
                {/* Glow effect on hover */}
                <div className={`absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-tr ${app.color} opacity-0 blur-[50px] transition-all duration-500 group-hover:opacity-20 group-hover:-translate-x-6 group-hover:translate-y-6`} />

                <div className="flex items-start justify-between">
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr ${app.color} p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/5`}>
                    <div className="h-full w-full rounded-[10px] sm:rounded-[14px] bg-zinc-950 flex items-center justify-center">
                      <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${app.accent === 'emerald' ? 'text-emerald-300 group-hover:text-white' : 'text-zinc-100 group-hover:text-white'} transition-colors duration-300`} />
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 border border-zinc-800 px-2.5 sm:px-3 py-1 text-xs font-semibold text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="hidden sm:inline">{app.metrics.value}</span>
                    <span className="sm:hidden text-[10px]">{app.metrics.value}</span>
                  </span>
                </div>

                <div className="mt-4 sm:mt-8 space-y-1 sm:space-y-2">
                  <h2 className="text-base sm:text-xl font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors duration-300 flex items-center gap-2">
                    {app.title}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 text-indigo-300" />
                  </h2>
                  <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed max-w-md line-clamp-3 sm:line-clamp-none">
                    {app.description}
                  </p>
                </div>

                <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono uppercase tracking-wider hidden sm:inline">Hệ thống con</span>
                  <span className="font-mono uppercase tracking-wider sm:hidden">Module</span>
                  <span className="group-hover:text-indigo-400 transition-colors">Truy cập ngay &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-5 sm:py-8 text-center text-xs text-zinc-600 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p>&copy; 2026 LTWEB OS. Toàn bộ hệ thống đã được đồng bộ.</p>
          <div className="flex gap-6 font-mono">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> LATENCY: 12ms
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> LOAD: 0.12%
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
