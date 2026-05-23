import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { jwtVerify } from 'jose';

export const metadata = {
  title: 'Đăng nhập | RestoFlow',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; reason?: string };
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (token) {
    try {
      const secretKey = process.env.JWT_ACCESS_SECRET || 'fallback';
      const secret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, secret);
      
      const role = payload.role as string;
      const redirectUrl = searchParams.redirect;
      
      if (redirectUrl) {
        redirect(redirectUrl);
      } else if (role === 'ADMIN' || role === 'MANAGER') {
        redirect('/admin/dashboard');
      } else if (role === 'STAFF') {
        redirect('/pos');
      } else if (role === 'KITCHEN') {
        redirect('/kds');
      }
    } catch (e) {
      // Invalid or expired token, just let them login
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1934&auto=format&fit=crop')" }}>
      {/* Lớp phủ mờ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center text-5xl mb-4 drop-shadow-md">🍽️</div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">
          RestoFlow
        </h2>
        <p className="mt-2 text-center text-sm text-gray-300 font-medium tracking-wide uppercase">
          Hệ thống quản lý nhà hàng
        </p>

        {searchParams.reason === 'expired' && (
          <div className="mt-6 mx-4 sm:mx-0 bg-yellow-500/20 border border-yellow-500/50 backdrop-blur-md rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-100">Phiên làm việc hết hạn, vui lòng đăng nhập lại</p>
              </div>
            </div>
          </div>
        )}
        {searchParams.reason === 'forbidden' && (
          <div className="mt-6 mx-4 sm:mx-0 bg-red-500/20 border border-red-500/50 backdrop-blur-md rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-100">Bạn không có quyền truy cập trang đó</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl py-10 px-6 shadow-2xl rounded-3xl sm:px-10 border border-white/20 mx-4 sm:mx-0">
          <LoginForm redirectUrl={searchParams.redirect} />
        </div>
      </div>
    </div>
  );
}
