import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';
import { getIO } from '../socket';

// ─── TẠI SAO CẦN CẢ HAI CƠ CHẾ? ─────────────────────────────────────────────
//
// 1. Socket.io event "menu:soldout":
//    → Dành cho user ĐANG XEM trang menu (tab đang mở).
//    → Cập nhật UI ngay lập tức (< 100ms) mà không cần reload trang.
//    → Nếu user mất mạng rồi reconnect, Socket.io client sẽ tự retry.
//
// 2. revalidatePath / on-demand ISR revalidation (Next.js):
//    → Dành cho user MỞ TRANG MỚI sau khi bếp báo hết món.
//    → SSG cache đã được invalidate → Next.js sẽ re-render trang với data mới từ DB.
//    → Nếu KHÔNG có bước này, user mở tab mới vẫn thấy trang cũ (từ SSG build)
//      cho đến khi hết 300 giây revalidate tự nhiên.
//
// Kết luận: Socket → real-time patch cho user online.
//           revalidatePath → đảm bảo data đúng cho user mới vào sau.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/menu-items/:id/sold-out
 * Auth: ADMIN | MANAGER | KITCHEN
 * Body: { isSoldOut: boolean }
 */
export const updateSoldOut = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params['id'] as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSoldOut = (req.body as any).isSoldOut;

  // Validate body — chỉ chấp nhận boolean thuần (không nhận string 'true'/'false')
  if (typeof rawSoldOut !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Trường isSoldOut phải là kiểu boolean (true/false)',
    });
  }

  const isSoldOut = rawSoldOut as boolean;

  try {
    // 1. Kiểm tra món ăn tồn tại
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Món ăn không tồn tại' });
    }

    // 2. Cập nhật isSoldOut trong DB
    const updated = await prisma.menuItem.update({
      where: { id },
      data: { isSoldOut },
      include: {
        category: { select: { name: true } },
      },
    });

    // 3. Emit Socket.io events → patch real-time cho tất cả các bên
    const io = getIO();
    // a. Room "menu-updates" event "menu:soldout"
    io.to('menu-updates').emit('menu:soldout', {
      menuItemId: id,
      menuItemName: updated.name,
      isSoldOut,
    });
    
    // b. Room "cashier" event "menu:soldout-notify"
    io.to('cashier').emit('menu:soldout-notify', {
      menuItemId: id,
      menuItemName: updated.name,
      isSoldOut,
    });

    // c. Room "kitchen" event "kitchen:item-updated" (loại soldout)
    io.to('kitchen').emit('kitchen:item-updated', {
      type: 'soldout',
      menuItemId: id,
      isSoldOut,
    });
    console.log(`[Socket.io] Đã emit soldout events → menuItemId=${id}, name=${updated.name}, isSoldOut=${isSoldOut}`);

    // 4. Gọi Next.js On-Demand Revalidation API để invalidate SSG cache
    //    → Lần load trang tiếp theo (user mới mở tab) sẽ lấy data mới từ DB
    await triggerNextRevalidation().catch((err) => {
      // Không crash nếu revalidation lỗi, chỉ log cảnh báo
      console.warn('[Revalidate] Không thể invalidate Next.js cache:', err.message);
    });

    return res.json({
      success: true,
      message: `Cập nhật trạng thái món ăn thành công: ${isSoldOut ? 'Hết món' : 'Còn hàng'}`,
      data: updated,
    });
  } catch (error) {
    console.error('[SoldOut] Lỗi khi cập nhật isSoldOut:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái món ăn' });
  }
};

/**
 * Gọi Next.js On-Demand Revalidation endpoint để invalidate SSG cache.
 *
 * Cơ chế: Next.js có API route (app/api/revalidate/route.ts) nhận POST request
 * với secret token → gọi revalidatePath('/menu/[tableId]') để xóa cache cũ.
 * Lần request tiếp theo vào trang đó sẽ trigger re-render với data mới từ DB.
 *
 * Xem: https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration#on-demand-revalidation-with-revalidatepath
 */
async function triggerNextRevalidation(): Promise<void> {
  const nextUrl = process.env.NEXTJS_URL || 'http://localhost:3000';
  const secret = process.env.REVALIDATION_SECRET || 'restoflow_revalidation_secret';

  const response = await fetch(`${nextUrl}/api/revalidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-revalidation-secret': secret,
    },
    body: JSON.stringify({ path: '/table/[tableId]', type: 'page' }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Next.js revalidation thất bại (${response.status}): ${body}`);
  }

  console.log('[Revalidate] Đã invalidate SSG cache /table/[tableId] thành công');
}
