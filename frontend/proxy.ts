import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { AccessTokenPayload } from '@/types/jwt.types';

// Giải thích:
// jsonwebtoken dùng Node.js crypto module — không tương thích Edge Runtime
// jose được viết thuần Web Crypto API (SubtleCrypto) — tương thích mọi runtime
// Đây là lý do Next.js proxy LUÔN phải dùng jose hoặc thư viện tương tự.

// 1. ROLE-BASED PERMISSIONS cho từng nhóm route (sau khi đã xác thực token)
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/pos':            ['ADMIN', 'MANAGER', 'CASHIER'],
  '/kds':            ['ADMIN', 'MANAGER', 'KITCHEN'],
  '/admin/settings': ['ADMIN'],             // phải đặt trước /admin để ưu tiên match dài hơn
  '/admin':          ['ADMIN', 'MANAGER'],
  '/table':          ['ADMIN', 'MANAGER', 'CASHIER'],
};

// 2. PUBLIC ROUTES — các route này KHÔNG yêu cầu đăng nhập
// ⚠️ Mọi route khác đều BẮT BUỘC có token hợp lệ mới được vào.
function isPublicRoute(pathname: string): boolean {
  // Trang đăng nhập
  if (pathname.startsWith('/login')) return true;

  // /table/[id] — trang menu QR cho thực khách, không cần tài khoản
  // Phân biệt với /table (danh sách bàn nội bộ, cần đăng nhập):
  //   /table/          → false (trailing slash, không hợp lệ)
  //   /table/abc-123   → true  (có UUID / slug sau /table/)
  if (pathname.startsWith('/table/') && pathname.slice(7).trim().length > 0) return true;

  return false;
}

// 3. PROXY LOGIC
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bước A: Cho qua ngay nếu là route public
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Bước B: Mọi route còn lại đều cần token — đọc cookie access_token
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  // Bước C: Verify JWT bằng jose (tương thích Edge Runtime)
  const secretKey = process.env.JWT_ACCESS_SECRET;
  if (!secretKey) {
    console.error('[Proxy] JWT_ACCESS_SECRET chưa được cấu hình!');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let payload: AccessTokenPayload;
  try {
    const secret = new TextEncoder().encode(secretKey);
    const result = await jwtVerify(token, secret);
    payload = result.payload as AccessTokenPayload;
  } catch (error: any) {
    console.error('[Proxy] Lỗi xác minh JWT:', error.name);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    if (error.name === 'JWTExpired' || error?.code === 'ERR_JWT_EXPIRED') {
      loginUrl.searchParams.set('reason', 'expired');
    }
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('access_token');
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  // Bước D: Kiểm tra role nếu route có yêu cầu role cụ thể
  // Tìm route khớp dài nhất (longest match) để ưu tiên rule chi tiết hơn
  let matchedRoute = '';
  for (const route of Object.keys(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && route.length > matchedRoute.length) {
      matchedRoute = route;
    }
  }

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute];
    if (!allowedRoles.includes(payload.role)) {
      console.warn(`[Proxy] Forbidden: role "${payload.role}" cố truy cập "${pathname}"`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'forbidden');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Bước E: Cho qua — đính kèm user info vào header để Server Components có thể đọc
  const response = NextResponse.next();
  response.headers.set('X-User-Id', payload.userId);
  response.headers.set('X-User-Role', payload.role);
  // Ngăn trình duyệt cache trang protected → bấm Back sau logout không hiện lại nội dung cũ
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');

  return response;
}

// 4. MATCHER — áp dụng proxy cho mọi route, bỏ qua static files của Next.js
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
