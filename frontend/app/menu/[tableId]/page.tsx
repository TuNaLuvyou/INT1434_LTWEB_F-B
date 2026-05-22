import { notFound } from 'next/navigation';
import MenuItemList, { MenuItemForDisplay } from './MenuItemList';

export const revalidate = 300; // ISR: Cache 5 phút

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
      tableId: table.id,
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
    title: `Menu - Bàn ${tableId.substring(0, 4)} | RestoFlow`,
    description: 'Thực đơn món ăn tại RestoFlow',
  };
}

// ─── Server Component (SSG) ───────────────────────────────────────────────────
// Đây là Server Component → KHÔNG có useState, useEffect, hay 'use client'.
// Chỉ phần MenuItemList (Client Component) mới có khả năng realtime.
export default async function MenuPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId;

  if (!tableId) {
    return notFound();
  }

  const res = await fetch(`${API_URL}/api/menu`);

  if (!res.ok) {
    return notFound();
  }

  const result = await res.json();
  if (!result.success || !result.data) {
    return notFound();
  }

  const { categories, items }: MenuData = result.data;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Sticky — Pure static HTML, không cần JS */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center">
          <h1 className="text-2xl font-extrabold text-gray-850 bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
            Thực đơn RestoFlow
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full">
            Mã Bàn: {tableId}
          </p>
        </div>

        {/* Tab Danh mục (Horizontal Scroll) */}
        <div className="border-t bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex overflow-x-auto gap-3 scrollbar-hide md:justify-center scroll-smooth">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`#category-${cat.id}`}
                className="flex-shrink-0 px-5 py-2 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-orange-500 hover:text-white transition-all shadow-sm border border-gray-100"
              >
                {cat.name}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-12">
        {/*
         * MenuItemList là Client Component duy nhất trên trang này.
         * - Nhận initialItems từ SSG props (đã có data lúc build/ISR)
         * - Tự kết nối Socket.io để lắng nghe "menu:soldout" realtime
         * - Khi nhận event → patch state cục bộ → re-render item bị thay đổi
         *
         * Server Component (page này) vẫn giữ quyền kiểm soát toàn bộ layout,
         * header, SEO metadata → không bị ảnh hưởng bởi Socket.io.
         */}
        <MenuItemList initialItems={items} categories={categories} />
      </main>
    </div>
  );
}
