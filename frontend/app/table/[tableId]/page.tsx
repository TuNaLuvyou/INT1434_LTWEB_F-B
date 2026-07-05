import { notFound } from 'next/navigation';
import MenuItemList, { MenuItemForDisplay } from './MenuItemList';

export const revalidate = 300; // ISR: Cache 5 phút

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── GIẢ LẬP SystemConfig CHO TRANG CLIENT ────────────────────────────
// Định nghĩa cấu hình hệ thống bao gồm tên nhà hàng theo yêu cầu.
const SystemConfig = {
  restaurantName: 'HiAI-MenuGo Demo',
};

// ─── TẠI SAO DÙNG SSG + ISR (revalidate = 300) THAY VÌ SSR? ─────────────────
// 1. Menu nhà hàng hiếm khi thay đổi liên tục từng giây (thường theo ngày/tuần).
//    Nếu dùng SSR, mỗi lần user quét QR code server phải query DB từ đầu → tăng tải, chậm.
// 2. SSG render sẵn thành HTML siêu nhẹ lúc build → load "nhanh như chớp" (Zero delay).
// 3. ISR (revalidate=300): cứ 5 phút Next.js âm thầm fetch data mới ở background.
//    → Data luôn được cập nhật mà không bắt user nào phải chờ.
//
// ─── TẠI SAO CẦN CẢ revalidatePath VÀ socket event? ────────────────────────
// • Socket.io event "menu:soldout":
//   → Cập nhật ngay lập tức cho user ĐANG XEM trang (tab đã mở).
//   → Patch state client-side mà không reload trang → UX mượt mà.
//
// • revalidatePath('/menu/[tableId]', 'page') (On-Demand ISR):
//   → Invalidate SSG cache ngay khi bếp báo hết món.
//   → User MỞ TAB MỚI sau đó sẽ nhận được HTML đã cập nhật (isSoldOut=true).
//   → Nếu không có bước này, user mới vào thấy trang cũ cho đến hết 300 giây.
//
// Kết luận: Hai cơ chế bổ trợ nhau — Socket cho user online, revalidate cho user mới vào.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Server Component (SSG) ───────────────────────────────────────────────────
// Đây là Server Component → KHÔNG có useState, useEffect, hay 'use client'.
// Chỉ phần MenuItemList (Client Component) mới có khả năng realtime.
export default async function MenuPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId;

  if (!tableId) return notFound();

  const res = await fetch(`${API_URL}/api/menu`, { next: { revalidate: 300 } });

  if (!res.ok) return notFound();

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
      <header
        className="
          relative h-16
          bg-white border-b border-gray-100/80 shadow-sm
        "
      >
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between gap-4">
          {/* Logo + tên nhà hàng */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo placeholder: gradient circle đẹp mắt */}
            <div
              className="
                h-9 w-9 rounded-xl shrink-0
                bg-gradient-to-br from-orange-500 to-amber-400
                flex items-center justify-center
                shadow-md shadow-orange-200/50
              "
              aria-hidden="true"
            >
              <span className="text-white text-lg font-black leading-none">R</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-gray-900 leading-tight truncate">
                {SystemConfig.restaurantName}
              </h1>
              <p className="text-[10px] text-gray-400 font-semibold leading-tight">
                Thực đơn điện tử
              </p>
            </div>
          </div>

          {/* Số bàn badge */}
          <div
            className="
              shrink-0 flex items-center gap-1.5
              bg-orange-50 border border-orange-200/60
              text-orange-700 text-[11px] font-extrabold
              px-3 py-1.5 rounded-full
            "
          >
            {/* Hạt tròn nhấp nháy báo trạng thái đang kết nối */}
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" aria-hidden="true" />
            Bàn&nbsp;
            <span className="font-mono tracking-wider">
              {tableId.length > 8 ? tableId.substring(0, 8).toUpperCase() : tableId}
            </span>
          </div>
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
