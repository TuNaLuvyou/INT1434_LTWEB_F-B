import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the JWT Payload type
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  [key: string]: any;
}

// 1. ROUTE PERMISSION MAP
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/pos': ['ADMIN', 'MANAGER', 'STAFF'],
  '/kds': ['ADMIN', 'MANAGER', 'KITCHEN'],
  '/admin/settings': ['ADMIN'], // Must be evaluated before /admin
  '/admin': ['ADMIN', 'MANAGER'],
};

// 2. PUBLIC ROUTES
const PUBLIC_ROUTES = ['/login', '/menu', '/expired'];

// 3. MIDDLEWARE LOGIC
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Step A: Check license
  try {
    const origin = request.nextUrl.origin;
    const licenseRes = await fetch(`${origin}/api/system/license-status`, {
      cache: 'force-cache',
      next: { revalidate: 60 } // Revalidate every 60s
    });
    
    if (licenseRes.ok) {
      const { isExpired } = await licenseRes.json();
      if (isExpired && pathname !== '/expired') {
        return NextResponse.redirect(new URL('/expired', request.url));
      }
    }
  } catch (error) {
    console.error('[Middleware] License check failed:', error);
  }

  // Step B: Skip middleware cho public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
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
  const secretKey = process.env.JWT_ACCESS_SECRET;
  if (!secretKey) {
    throw new Error('[FATAL] JWT_ACCESS_SECRET is missing in environment variables. Startup failed.');
  }

  let payload: JWTPayload;
  try {
    const secret = new TextEncoder().encode(secretKey);
    const result = await jwtVerify(token, secret);
    payload = result.payload as JWTPayload;
  } catch (error: any) {
    console.error('[Middleware] JWT Verification error:', error.code || error.message);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    if (error?.code === 'ERR_JWT_EXPIRED') {
      loginUrl.searchParams.set('reason', 'expired'); // Để client tự động refresh
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
