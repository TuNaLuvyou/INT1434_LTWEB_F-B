import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Lấy token từ cookie
  const token = request.cookies.get('access_token')?.value;

  // Lấy đường dẫn hiện tại
  const path = request.nextUrl.pathname;

  // Nếu người dùng đang ở trang chủ (/) hoặc các trang nội bộ mà KHÔNG có token
  if (!token && (path === '/' || path.startsWith('/admin') || path.startsWith('/pos') || path.startsWith('/kds'))) {
    // Chuyển hướng ngay lập tức về trang đăng nhập
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Cho phép đi tiếp nếu hợp lệ
  return NextResponse.next();
}

// Cấu hình các đường dẫn mà middleware này sẽ chạy
export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/pos/:path*',
    '/kds/:path*',
  ],
};
