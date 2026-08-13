import { RoleGate } from '../../components/auth/RoleGate';
import Link from 'next/link';
import { ShieldAlert, Server } from 'lucide-react';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const fallbackUI = (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 flex-col p-4 text-center selection:bg-rose-500/30">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-rose-900/10 blur-[120px] pointer-events-none" />
      <div className="bg-zinc-900/50 border border-rose-500/30 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-sm z-10">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-rose-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">403 - Truy cập bị từ chối</h1>
        <p className="text-zinc-400 mb-8 text-sm">Bạn không có quyền truy cập trang quản trị hệ thống root, hoặc phiên đăng nhập đã hết hạn.</p>
        <Link href="/" className="px-6 py-3 bg-zinc-100 text-zinc-900 font-bold rounded-xl hover:bg-white transition-colors block w-full">
          Về trang chủ
        </Link>
      </div>
    </div>
  );

  const loadingUI = (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
      <Server className="w-12 h-12 text-violet-500 animate-pulse" />
      <div className="text-zinc-400 font-medium">Đang tải dữ liệu Platform...</div>
    </div>
  );

  return (
    <RoleGate allowedRoles={['PLATFORM_ADMIN']} fallback={fallbackUI} loadingFallback={loadingUI}>
      {children}
    </RoleGate>
  );
}
