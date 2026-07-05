"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { logout } from "@/lib/auth/client";
import { RoleGate } from "@/components/auth";
import type { Role } from "@/hooks/useRole";
import {
  LayoutDashboard,
  Database,
  ClipboardCheck,
  CalendarDays,
  Smartphone,
  FolderSync,
  Ticket,
  FileText,
  ShieldAlert,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  ArrowLeft,
  Settings,
  Utensils,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, allowedRoles: ["ADMIN", "MANAGER"] as Role[] },
  { name: "Quản lý Món ăn", href: "/admin/menu", icon: Utensils, allowedRoles: ["ADMIN", "MANAGER"] as Role[] },
  { name: "Nguyên liệu", href: "/admin/inventory", icon: Database, allowedRoles: ["ADMIN", "MANAGER"] as Role[] },



  { name: "Khuyến mãi", href: "/admin/vouchers", icon: Ticket, allowedRoles: ["ADMIN", "MANAGER"] as Role[] },
  { name: "Z-Report", href: "/admin/z-report", icon: FileText, allowedRoles: ["ADMIN", "MANAGER"] as Role[] },
  { name: "Phân Quyền", href: "/admin/roles", icon: ShieldAlert, allowedRoles: ["ADMIN"] as Role[] },
  { name: "Cài đặt hệ thống", href: "/admin/settings", icon: Settings, allowedRoles: ["ADMIN"] as Role[] },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { clearUser } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* MOBILE HAMBURGER BUTTON (Chỉ hiện trên Mobile/Tablet) */}
      <div className="lg:hidden fixed top-3 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="h-10 w-10 rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-lg active:scale-95"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* MOBILE SIDEBAR BACKDROP */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm lg:hidden transition-all duration-300"
        />
      )}

      {/* MOBILE SIDEBAR PANEL */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between p-4 transition-transform duration-300 lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Mobile Logo / Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-white text-sm">HiAI-MenuGo Admin</span>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="h-8 w-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <RoleGate key={tab.name} allowedRoles={tab.allowedRoles}>
                  <Link
                    href={tab.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                      isActive
                        ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] font-bold"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    <span>{tab.name}</span>
                  </Link>
                </RoleGate>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="space-y-3 pt-4 border-t border-zinc-900">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-zinc-400 hover:text-white transition-all hover:bg-zinc-900/60"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại App</span>
          </Link>
          <button
            onClick={() => {
              clearUser();
              logout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-rose-400 hover:text-white hover:bg-rose-500/10 transition-all font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* DESKTOP SIDEBAR (Hiện trên Large Screen) */}
      <aside
        onClick={isCollapsed ? () => setIsCollapsed(false) : undefined}
        className={`hidden lg:flex flex-col justify-between bg-zinc-950 border-r border-zinc-900 h-screen sticky top-0 transition-all duration-300 z-40 shrink-0 ${
          isCollapsed ? "w-20 p-3 cursor-pointer hover:bg-zinc-900/20" : "w-64 p-5"
        }`}
      >
        <div className="space-y-6">
          {/* Logo Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 overflow-hidden whitespace-nowrap">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)] shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className={`flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap ${
                isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-2"
              }`}>
                <span className="font-bold tracking-tight text-white text-xs">HiAI-MenuGo Admin</span>
                <span className="text-[8px] text-violet-400 font-semibold uppercase tracking-wider">Management</span>
              </div>
            </div>

            {/* Collapse toggle button */}
            {!isCollapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse();
                }}
                className="h-7 w-7 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <RoleGate key={tab.name} allowedRoles={tab.allowedRoles}>
                  <Link
                    href={tab.href}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className={`flex items-center rounded-xl transition-all duration-300 overflow-hidden whitespace-nowrap ${
                      isCollapsed ? "justify-center p-3" : "gap-3.5 px-4 py-3"
                    } ${
                      isActive
                        ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] font-bold"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                    }`}
                    title={isCollapsed ? tab.name : ""}
                  >
                    <tab.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className={`text-xs uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap ${
                      isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-3.5"
                    }`}>
                      {tab.name}
                    </span>
                  </Link>
                </RoleGate>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="space-y-2 pt-4 border-t border-zinc-900 overflow-hidden whitespace-nowrap">
          <Link
            href="/"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className={`flex items-center rounded-xl text-zinc-400 hover:text-white transition-all duration-300 hover:bg-zinc-900/60 overflow-hidden whitespace-nowrap ${
              isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5 text-xs font-medium"
            }`}
            title="Quay lại App"
          >
            <ArrowLeft className="h-4.5 w-4.5 shrink-0" />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
              isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-3"
            }`}>
              Quay lại App
            </span>
          </Link>

          <button
            onClick={(e) => {
              e.stopPropagation();
              clearUser();
              logout();
            }}
            className={`w-full flex items-center rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/10 transition-all duration-300 font-semibold overflow-hidden whitespace-nowrap ${
              isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5 text-xs"
            }`}
            title="Đăng xuất"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
              isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-3"
            }`}>
              Đăng xuất
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
