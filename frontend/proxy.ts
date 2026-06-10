import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { AccessTokenPayload } from '@/types/jwt.types';

// Giải thích:
// jsonwebtoken dùng Node.js crypto module — không tương thích Edge Runtime
// jose được viết thuần Web Crypto API (SubtleCrypto) — tương thích mọi runtime
// Đây là lý do Next.js middleware LUÔN phải dùng jose hoặc thư viện tương tự.

// 1. ROUTE PERMISSION MAP
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/pos': ['ADMIN', 'MANAGER', 'CASHIER'],
  '/kds': ['ADMIN', 'MANAGER', 'KITCHEN'],
  '/attendance': ['ADMIN', 'MANAGER', 'STAFF', 'CASHIER', 'KITCHEN'],
  '/admin/settings': ['ADMIN'], // Must be evaluated before /admin
  '/admin': ['ADMIN', 'MANAGER'],
  '/table': ['ADMIN', 'MANAGER', 'CASHIER'],
};

// 2. PUBLIC ROUTES
const PUBLIC_ROUTES = ['/login', '/expired'];

// 3. MIDDLEWARE LOGIC
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;


  // Step B: Skip middleware cho public routes
  // Chỉ các trang /table/[id] (ví dụ: /table/1) là public cho thực khách.
  // Bản thân trang /table hoặc /table/ (danh sách bàn nội bộ) bắt buộc phải đăng nhập.
  const isPublicTableRoute = pathname.startsWith('/table/') && pathname.slice(7).trim().length > 0;

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route)) || isPublicTableRoute) {
    return NextResponse.next();
  }

  // Step C: Đọc access token từ cookie "access_token"
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Step D: Verify JWT bằng jose
  // Tại sao dùng jose? Vì jsonwebtoken phụ thuộc vào Node.js crypto module.
  // Next.js Middleware chạy trên Edge Runtime (giống V8 isolates) nên không có core modules của Node.js.
  // jose là thư viện độc lập tương thích hoàn toàn với Edge Runtime.
  // Giải thích: Edge Runtime không hỗ trợ crypto, bắt buộc dùng jose.jwtVerify
  const secretKey = process.env.JWT_ACCESS_SECRET;
  if (!secretKey) {
    console.error('[Middleware] JWT_ACCESS_SECRET is not set!');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let payload: AccessTokenPayload;
  try {
    const secret = new TextEncoder().encode(secretKey);
    const result = await jwtVerify(token, secret);
    payload = result.payload as AccessTokenPayload;
  } catch (error: any) {
    console.error('[Middleware] JWT Verification error:', error);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    
    // jose throw JWTExpired khi token hết hạn
    // jose throw JWTInvalid khi signature sai
    if (error instanceof Error) {
      if (error.name === 'JWTExpired' || (error as any).code === 'ERR_JWT_EXPIRED') {
        loginUrl.searchParams.set('reason', 'expired');
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.redirect(loginUrl);
  }

  // Step E: Check role permission
  // Tìm route khớp dài nhất (ưu tiên độ chi tiết)
  let matchedRoute = '';
  for (const route of Object.keys(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && route.length > matchedRoute.length) {
      matchedRoute = route;
    }
  }

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute];
    if (!allowedRoles.includes(payload.role)) {
      console.warn(`[Middleware] Forbidden: User role ${payload.role} attempted to access ${pathname}`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'forbidden');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Step F: Forward request với user info trong header
  const response = NextResponse.next();
  response.headers.set('X-User-Id', payload.userId);
  response.headers.set('X-User-Role', payload.role);
  
  return response;
}

// 4. MATCHER CONFIG
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ]
};
