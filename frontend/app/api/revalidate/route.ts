import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/revalidate
 *
 * On-Demand Revalidation endpoint cho SSG pages.
 *
 * Được backend Express gọi sau khi bếp báo hết món để invalidate cache.
 * Sau khi revalidate, lần request tiếp theo tới /menu/[tableId] sẽ
 * trigger Next.js re-render với data mới nhất từ DB thay vì trả cache cũ.
 *
 * Bảo mật: Dùng secret token trong header để tránh bị gọi tùy tiện.
 */
export async function POST(request: NextRequest) {
  // Kiểm tra secret token
  const secret = request.headers.get('x-revalidation-secret');
  const expectedSecret = process.env.REVALIDATION_SECRET || 'restoflow_revalidation_secret';

  if (secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized: Secret không hợp lệ' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { path, type } = body as { path?: string; type?: 'page' | 'layout' };

    // Revalidate path cụ thể được yêu cầu, hoặc mặc định là trang menu
    const targetPath = path || '/menu/[tableId]';
    const targetType = type || 'page';

    revalidatePath(targetPath, targetType);

    console.log(`[Next.js Revalidate] Đã invalidate cache: ${targetPath} (type: ${targetType})`);

    return NextResponse.json({
      success: true,
      message: `Cache đã được invalidate cho path: ${targetPath}`,
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Next.js Revalidate] Lỗi:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi khi thực hiện revalidation' },
      { status: 500 }
    );
  }
}
