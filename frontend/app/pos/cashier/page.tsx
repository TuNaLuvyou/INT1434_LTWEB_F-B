import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import CashierClient from '@/app/cashier/CashierClient';

export const revalidate = 0;

export async function generateMetadata() {
  return { title: 'Thu ngân | RestoFlow (POS)' };
}

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export default async function PosCashierPage() {
  const user = await getCurrentUser();
  if (!user || !['ADMIN', 'MANAGER', 'CASHIER'].includes(user.role)) {
    redirect('/login?redirect=/pos/cashier&reason=forbidden');
  }

  const typedUser = { userId: user.userId, role: user.role as Role };

  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  let initialTables = [] as any[];
  let initialSessionItems = null as any;
  let initialSelectedSessionId: string | null = null;

  try {
    const res = await fetch(`${API_URL}/api/cashier/overview`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token || ''}` },
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && Array.isArray(result.data?.tables)) {
        initialTables = result.data.tables;
        const firstPending = initialTables.find((t: any) => (t.session?.pendingCount || 0) > 0);
        if (firstPending?.session?.sessionId) {
          initialSelectedSessionId = firstPending.session.sessionId;
          const itemsRes = await fetch(`${API_URL}/api/cashier/sessions/${initialSelectedSessionId}/items`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token || ''}` },
          });
          if (itemsRes.ok) {
            const itemsResult = await itemsRes.json();
            if (itemsResult.success) initialSessionItems = itemsResult.data;
          }
        }
      }
    }
  } catch (err) {
    console.error('[PosCashierPage] SSR fetch error', err);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative">
      {/* Glow Effects (same as POS) */}
      <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none" />

      {/* Header like POS with back button */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="/pos" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              ←
            </a>
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-lg text-white">Thu ngân</span>
              <span className={`text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wider uppercase border bg-blue-500/10 text-blue-400 border-blue-500/20 max-w-max`}>
                Live Counter
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-xs sm:text-sm text-gray-400 truncate max-w-[100px] sm:max-w-none">#{typedUser.userId}</div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <CashierClient
          user={typedUser}
          initialTables={initialTables}
          initialSessionItems={initialSessionItems}
          initialSelectedSessionId={initialSelectedSessionId}
          errorMsg={null}
        />
      </div>
    </div>
  );
}
