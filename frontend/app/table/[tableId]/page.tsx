import { notFound } from 'next/navigation';
import MenuItemList, { MenuItemForDisplay } from './MenuItemList';

export const revalidate = 300; // ISR: Cache 5 phút

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── GIẢ LẬP SystemConfig CHO TRANG CLIENT ────────────────────────────
// Định nghĩa cấu hình hệ thống bao gồm tên nhà hàng theo yêu cầu.
const SystemConfig = {
  restaurantName: 'HiAI-MenuGo Demo',
};

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface MenuData {
  categories: CategoryInfo[];
  items: MenuItemForDisplay[];
}

interface PageProps {
  params: Promise<{
    tableId: string;
  }>;
  searchParams: Promise<{
    tenantId?: string;
    branchId?: string;
  }>;
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/tables`);
    if (!res.ok) return [];

    const result = await res.json();
    if (!result.success || !result.data) return [];

    return result.data.map((table: Table) => ({
      tableId: String(table.tableNumber),
    }));
  } catch (error) {
    console.error('[Menu SSG] Lỗi khi fetch tables trong generateStaticParams:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId || '';

  return {
    title: `Thực đơn ${SystemConfig.restaurantName} | Bàn ${tableId}`,
    description: `Thực đơn món ăn tại ${SystemConfig.restaurantName} — Gọi món trực tiếp tại bàn.`,
  };
}

// ─── Server Component (SSR / ISR) ───────────────────────────────────────────────────
// Đây là Server Component → KHÔNG có useState, useEffect, hay 'use client'.
// Chỉ phần MenuItemList (Client Component) mới có khả năng realtime.
export default async function MenuPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId;

  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams?.tenantId;
  const branchId = resolvedSearchParams?.branchId;

  if (!tableId || !tenantId || !branchId) return notFound();

  // Gọi API menu với tenantId và branchId
  const res = await fetch(`${API_URL}/api/menu?tenantId=${tenantId}&branchId=${branchId}`, { next: { revalidate: 300 } });

  if (!res.ok) {
    console.error('[Menu Error] API returned status:', res.status);
    return notFound();
  }

  const result = await res.json();
  if (!result.success || !result.data) return notFound();

  const { categories, items }: MenuData = result.data;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/*
       * ── HEADER TRỰC QUAN (Relative) ──
       * Chuyển từ sticky thành relative (tĩnh) để khi khách cuộn trang xuống,
       * CategoryFilter sẽ sticky bám đỉnh (top-0) gọn gàng, tăng không gian đọc menu.
       */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <h1 className="text-sm font-bold text-gray-800 truncate">
            {SystemConfig.restaurantName}
          </h1>
          <span className="shrink-0 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
            Bàn {tableId.length > 8 ? tableId.substring(0, 8).toUpperCase() : tableId}
          </span>
        </div>
      </header>

      {/*
       * MenuItemList là Client Component duy nhất trên trang này.
       * - Nhận initialItems từ SSG props (đã có data lúc build/ISR)
       * - Tự kết nối Socket.io để lắng nghe "menu:soldout" realtime
       * - Khi nhận event → patch state cục bộ → re-render item bị thay đổi
       * - Quản lý CategoryFilter (sticky tabs), Cart state, Floating Cart và Drawer
       */}
      <MenuItemList initialItems={items} categories={categories} />
    </div>
  );
}
