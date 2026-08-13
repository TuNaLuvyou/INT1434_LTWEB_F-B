import { notFound } from 'next/navigation';
import MenuItemList, { MenuItemForDisplay } from './MenuItemList';
import { MenuCacheManager } from '@/components/offline/MenuCacheManager';
import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#f9fafb',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const SystemConfig = {
  restaurantName: process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'HiAI-MenuGo',
};

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface MenuData {
  categories: CategoryInfo[];
  items: MenuItemForDisplay[];
  branchName?: string | null;
  branding?: {
    displayName?: string | null;
    foodType?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
  } | null;
  tableInfo?: {
    id: string;
    tableNumber: number;
    label: string;
  } | null;
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

  let menuData: MenuData | null = null;
  let fetchError = false;

  try {
    const res = await fetch(`${API_URL}/api/menu?tenantId=${tenantId}&branchId=${branchId}&tableId=${encodeURIComponent(tableId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        menuData = result.data;
      }
    } else {
      console.error('[Menu Error] API returned status:', res.status);
    }
  } catch (err) {
    console.error('[Menu Error] Fetch failed:', err);
    fetchError = true;
  }

  if (!menuData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-2xl">📡</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            {fetchError ? 'Mất kết nối' : 'Không thể tải thực đơn'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {fetchError
              ? 'Vui lòng kiểm tra kết nối mạng và thử lại.'
              : 'Thực đơn tạm thời không khả dụng. Vui lòng thử lại sau.'}
          </p>
          <a
            href={`/table/${tableId}?tenantId=${tenantId}&branchId=${branchId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 transition-colors"
          >
            Thử lại
          </a>
        </div>
      </div>
    );
  }

  const { categories, items, branding, branchName, tableInfo }: MenuData = menuData;

  // CSS variables dựa theo branding
  const primaryColor = branding?.primaryColor || '#f59e0b';
  const secondaryColor = branding?.secondaryColor || '#d97706';
  const displayName = branding?.displayName || SystemConfig.restaurantName;

  // Hiển thị đúng số bàn (id do chủ quán cài đặt) thay vì label hay prefix UUID
  const tableDisplay = tableInfo
    ? String(tableInfo.tableNumber)
    : tableId.length > 8
      ? tableId.substring(0, 6).toUpperCase()
      : tableId;

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      style={{
        '--color-primary': primaryColor,
        '--color-secondary': secondaryColor,
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        body { 
          background-color: #f9fafb !important;
          overscroll-behavior-y: none;
        }
      `}} />
      <header
        className="sticky top-0 z-40 border-b border-gray-100/80 bg-white/95 backdrop-blur-md shadow-2xs"
        style={{ background: `linear-gradient(135deg, ${primaryColor}0D 0%, ${secondaryColor}05 100%)`, backgroundColor: 'white' }}
      >
        <div className="max-w-2xl mx-auto px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 min-w-0">
            {branding?.logoUrl && (
              <div className="h-9 sm:h-12 shrink-0 flex items-center justify-center">
                <img
                  src={branding.logoUrl}
                  alt={`${displayName} logo`}
                  className="h-full w-auto max-w-[35vw] sm:max-w-[200px] object-contain"
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black whitespace-normal break-words leading-tight tracking-tight" style={{ color: primaryColor, fontFamily: 'var(--font-display), sans-serif' }}>
                {displayName}
              </h1>
              {branchName && (
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate leading-tight mt-0.5">
                  {branchName}
                </p>
              )}
            </div>
          </div>
          <span
            className="shrink-0 text-[11px] sm:text-xs font-extrabold px-2.5 py-1 rounded-full border shadow-2xs tracking-wide"
            style={{
              color: secondaryColor,
              backgroundColor: `${secondaryColor}10`,
              borderColor: `${secondaryColor}25`,
            }}
          >
            Bàn {tableDisplay}
          </span>
        </div>
      </header>

      <MenuCacheManager tenantId={tenantId} categories={categories} items={items} />
      <MenuItemList
        initialItems={items}
        categories={categories}
        branding={branding || null}
        tableDisplay={tableDisplay}
      />
    </div>
  );
}
