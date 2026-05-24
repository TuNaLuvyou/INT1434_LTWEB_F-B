import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import FloorPlanClient from './FloorPlanClient';

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  sessionId?: string | null;
  activeSession?: {
    openedAt: Date | string;
    orderItemsCount: number;
  } | null;
}

export const revalidate = 0; // Đảm bảo Server-Side Rendering (SSR) liên tục lấy dữ liệu mới nhất khi load trang

export default async function AdminFloorPlanPage() {
  // 1. Kiểm tra vai trò của User ở Server Component
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/login?redirect=/admin/floor&reason=forbidden');
  }

  // 2. Lấy cookie để xác thực gọi API Backend
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  let initialTables: Table[] = [];
  let errorMsg: string | null = null;

  try {
    const res = await fetch(`${API_URL}/api/tables`, {
      cache: 'no-store', // Vô hiệu hóa HTTP cache để luôn tải dữ liệu nóng từ DB
      headers: {
        'Authorization': `Bearer ${token || ''}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Server trả về mã lỗi: ${res.status}`);
    }

    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      initialTables = result.data;
    } else {
      throw new Error(result.message || 'Dữ liệu không đúng cấu trúc.');
    }
  } catch (err: any) {
    console.error('[AdminFloorPlanPage] Lỗi SSR fetch tables:', err);
    errorMsg = err.message || 'Không thể lấy dữ liệu sơ đồ bàn ăn từ máy chủ.';
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans pb-12">
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <FloorPlanClient initialTables={initialTables} errorMsg={errorMsg} />
      </div>
    </div>
  );
}
