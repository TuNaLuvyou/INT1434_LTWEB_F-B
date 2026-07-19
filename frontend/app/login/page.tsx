import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { jwtVerify } from 'jose';
import { Activity, Server, ChefHat, Smartphone, MonitorCheck } from 'lucide-react';

export const metadata = {
  title: 'Đăng nhập | HiAI-MenuGo',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; reason?: string }>;
}) {
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (token) {
    try {
      const secretKey = process.env.JWT_ACCESS_SECRET || 'fallback';
      const secret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, secret);

      const role = payload.role as string;
      const redirectUrl = resolvedParams.redirect;

      if (redirectUrl) {
        redirect(redirectUrl);
      } else {
        redirect('/');
      }
    } catch (e) {
      // Invalid or expired token, just let them login
    }
  }

  const features = [
    { icon: MonitorCheck, label: 'Quản trị' },
    { icon: ChefHat, label: 'KDS' },
    { icon: Smartphone, label: 'Menu' },
    { icon: Server, label: 'POS' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left: Branding/Slogan */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-950 via-gray-950 to-gray-950 items-center justify-center">
        <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-violet-600/5 blur-[80px]" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-purple-600/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[150px]" />

        {/* Decorative dots */}
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.08) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 text-center max-w-lg space-y-12 px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-sm font-medium mx-auto">
              <Activity className="h-4 w-4" />
              <span>Thế hệ phần mềm quản trị nhà hàng thông minh</span>
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight leading-tight text-white">
              Quản trị & Phân phối <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                Vận hành Nhà hàng Thông minh
              </span>
            </h1>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Icon className="h-5 w-5 text-violet-400" />
                  <span className="text-[11px] font-medium text-zinc-400 text-center leading-tight">{f.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-zinc-500">
            <div className="h-px flex-1 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium uppercase tracking-widest text-zinc-500 shrink-0">HiAI-MenuGo</span>
            </div>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-violet-500/5 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/5 blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px]" />

        {/* Mobile branding */}
        <div className="lg:hidden text-center mb-10 space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
            <Activity className="h-3 w-3" />
            <span>Phần mềm quản trị nhà hàng thông minh</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Vận hành Nhà hàng Thông minh
            </span>
          </h2>
        </div>

        {resolvedParams.reason === 'expired' && (
          <div className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 relative z-10">
            <p className="text-sm font-medium text-yellow-100">Phiên làm việc hết hạn, vui lòng đăng nhập lại</p>
          </div>
        )}
        {resolvedParams.reason === 'forbidden' && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 relative z-10">
            <p className="text-sm font-medium text-red-100">Bạn không có quyền truy cập trang đó</p>
          </div>
        )}

        <div className="w-full max-w-md mx-auto relative z-10">
          <div className="bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-zinc-800">
            <div className="mb-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
                <Server className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Đăng nhập</h2>
            </div>
            <LoginForm redirectUrl={resolvedParams.redirect} />
          </div>
        </div>
      </div>
    </div>
  );
}
