import DashboardClient from './DashboardClient';
import { Calendar } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import { subDays } from 'date-fns';
import { cookies } from 'next/headers';

export const revalidate = 60; // Chiến lược ISR: revalidate mỗi 60 giây

export const metadata = {
  title: 'Dashboard Analytics | RestoFlow',
};

async function getInitialAnalyticsData() {
  const now = new Date();
  const from = subDays(now, 30).toISOString();
  const to = now.toISOString();

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  // Khi ISR build thì không có cookie, fetch sẽ trả 401. Ta bắt lỗi và trả mảng rỗng để client fetch sau.
  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const [revRes, peakRes, topRes] = await Promise.all([
      fetch(`${API}/api/analytics/revenue?from=${from}&to=${to}&groupBy=day`, { headers: { cookie: cookieHeader }, next: { revalidate: 60 } }),
      fetch(`${API}/api/analytics/peak-hours?from=${from}&to=${to}`, { headers: { cookie: cookieHeader }, next: { revalidate: 60 } }),
      fetch(`${API}/api/analytics/top-selling?from=${from}&to=${to}&limit=5`, { headers: { cookie: cookieHeader }, next: { revalidate: 60 } })
    ]);

    return {
      revenueData: revRes.ok ? (await revRes.json()).data : null,
      peakHoursData: peakRes.ok ? (await peakRes.json()).data : null,
      topSellingData: topRes.ok ? (await topRes.json()).data : null
    };
  } catch (err) {
    return { revenueData: null, peakHoursData: null, topSellingData: null };
  }
}

export default async function DashboardPage() {
  // RBAC: double-check server-side (middleware đã protect nhưng thêm lớp này cho chắc)
  const user = getCurrentUser();
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    redirect('/login?reason=forbidden');
  }

  const initialData = await getInitialAnalyticsData();

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
              <span className="font-bold tracking-tight text-lg text-white">Dashboard Analytics</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Analytics</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col p-6 space-y-4 max-w-7xl w-full mx-auto relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Hiệu Suất Nhà Hàng
            </h1>
            <p className="text-xs text-zinc-400 font-semibold mt-1">
              Theo dõi doanh thu, lưu lượng đơn hàng và giờ cao điểm.
            </p>
          </div>
        </div>

        <DashboardClient initialData={initialData} initialRole={user.role as any} />
      </main>
    </div>
  );
}
