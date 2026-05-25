'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function setSoldOutAction(
  menuItemId: string,
  isSoldOut: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;

    const apiBaseUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:5000';

    // 1. Gọi PATCH /api/admin/menu-items/:id/sold-out
    const res = await fetch(`${apiBaseUrl}/api/admin/menu-items/${menuItemId}/sold-out`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ isSoldOut }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        message: data.message || 'Cập nhật trạng thái món ăn thất bại',
      };
    }

    // 2. revalidatePath cho các trang chứa menu của bàn và cashier
    console.log('[Menu] Revalidating /table/[tableId]');
    revalidatePath('/table/[tableId]', 'page');

    console.log('[Menu] Revalidating /menu/[tableId]');
    revalidatePath('/menu/[tableId]', 'page');

    revalidatePath('/pos', 'page');
    revalidatePath('/cashier', 'page');

    return { success: true };
  } catch (error: any) {
    console.error('[Menu Action] setSoldOutAction error:', error);
    return {
      success: false,
      message: error.message || 'Lỗi kết nối mạng, vui lòng thử lại',
    };
  }
}
