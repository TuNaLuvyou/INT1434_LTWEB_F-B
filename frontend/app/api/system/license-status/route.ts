import { NextResponse } from 'next/server';

export async function GET() {
  try {
    /*
    // Yêu cầu: Prisma query SystemConfig
    // Nếu cài Prisma Client ở Next.js:
    import prisma from '@/lib/prisma';
    const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
    const isExpired = new Date() > config.licenseExpiredAt;
    return NextResponse.json({ isExpired, expiredAt: config.licenseExpiredAt });
    */

    // Vì DB nằm bên Backend Express, ta proxy sang backend để tránh duplicate DB connection:
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const res = await fetch(`${API_URL}/api/system/license-status`, { cache: 'no-store' });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Fallback: Mặc định chưa hết hạn nếu backend chưa implement endpoint này
    return NextResponse.json({ 
      isExpired: false, 
      expiredAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() 
    });
  } catch (error) {
    // Fallback không chặn luồng nếu lỗi server
    return NextResponse.json({ isExpired: false });
  }
}
