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
    <div className="h-screen max-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-6 pl-16 lg:pl-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Sơ Đồ Bàn Ăn</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold tracking-wider uppercase">Floor Plan</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col p-6 space-y-4 max-w-7xl w-full mx-auto relative z-10">
        <FloorPlanClient initialTables={initialTables} errorMsg={errorMsg} />
      </main>
    </div>
  );
}
