"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

const tabs = [
  { name: 'Dashboard', href: '/admin' },
  { name: 'Quản lý nguyên liệu', href: '/admin/inventory' },
  { name: 'Chấm công', href: '/admin/attendance' },
  { name: 'Lịch làm việc', href: '/admin/schedule' },
  { name: 'Thiết bị tin cậy', href: '/admin/devices' },
  { name: 'Duyệt Hồ Sơ', href: '/admin/profile-requests' },
  { name: 'Khuyến mãi (Voucher)', href: '/admin/vouchers' },
  // managerOnly: hiển thị cho cả ADMIN và MANAGER
  { name: 'Z-Report', href: '/admin/z-report', managerOnly: true },
  // adminOnly: chỉ hiển thị cho ADMIN
  { name: 'Phân Quyền', href: '/admin/roles', adminOnly: true },
];

export default function AdminTabs() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const visibleTabs = tabs.filter(tab => {
    if (tab.adminOnly && user?.role !== 'ADMIN') return false;
    // managerOnly: yêu cầu ADMIN hoặc MANAGER
    if (tab.managerOnly && user?.role !== 'ADMIN' && user?.role !== 'MANAGER') return false;
    return true;
  });

  return (
    <div className="flex items-center gap-1.5 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 w-fit overflow-x-auto select-none">
      {visibleTabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
              isActive
                ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
