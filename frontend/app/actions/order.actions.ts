'use server';

/**
 * order.actions.ts — Server Action để submit giỏ hàng thành order
 *
 * ─── Tại sao Server Action (không phải API route)? ───────────────────────────
 * - Chạy trên server: không bao giờ expose logic DB/Socket ra client
 * - Type-safe end-to-end với TypeScript
 * - Tự động CSRF protection (Next.js 14 built-in)
 * - Gọi Prisma trực tiếp, không cần thêm HTTP round-trip
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';
import prisma from '@/lib/prisma';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const submitOrderSchema = z.object({
  sessionId: z.string().min(1, 'Session ID không hợp lệ'),
  tableId: z.string().min(1, 'Table ID không hợp lệ'),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, 'Menu item ID không hợp lệ'),
        qty: z
          .number()
          .int('Số lượng phải là số nguyên')
          .min(1, 'Số lượng phải ít nhất 1')
          .max(20, 'Tối đa 20 món mỗi loại'),
        note: z
          .string()
          .max(200, 'Ghi chú tối đa 200 ký tự')
          .optional(),
      })
    )
    .min(1, 'Giỏ hàng trống'),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: z.ZodFormattedError<SubmitOrderInput> | Record<string, unknown>;
};

// ─── Server Action ────────────────────────────────────────────────────────────

export async function submitOrder(
  input: SubmitOrderInput
): Promise<ActionResult<{ orderItemIds: string[] }>> {
  // ── Step 1: Validate input với Zod ────────────────────────────────────────
  const parsed = submitOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Dữ liệu gửi lên không hợp lệ',
      errors: parsed.error.format(),
    };
  }

  const { sessionId, tableId, items, lat, lng } = parsed.data;

  try {
    // ── Check Geofencing ──────────────────────────────────────────────────
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { id: 'singleton' }
    });

    if (systemConfig?.isGeofenceEnabled) {
      if (lat === undefined || lng === undefined) {
        return {
          success: false,
          message: 'Vui lòng cấp quyền vị trí (GPS) để đặt món.',
        };
      }

      const restLat = systemConfig.restaurantLat;
      const restLng = systemConfig.restaurantLng;
      const maxDistance = systemConfig.maxOrderDistance ?? 100;

      if (restLat !== null && restLng !== null) {
        // Tính khoảng cách Haversine (mét)
        const R = 6371000; // Bán kính Trái Đất (mét)
        const dLat = (restLat - lat) * Math.PI / 180;
        const dLng = (restLng - lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(restLat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > maxDistance) {
          return {
            success: false,
            message: `Bạn đang ở quá xa nhà hàng (${Math.round(distance)}m). Vui lòng quét mã QR tại bàn để đặt món.`,
          };
        }
      }
    }

    // ── Step 2: Verify session tồn tại và OPEN ─────────────────────────────
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: {
          select: { id: true, tableNumber: true, label: true },
        },
      },
    });

    if (!session) {
      return {
        success: false,
        message: 'Phiên không tồn tại. Vui lòng quét QR code lại.',
      };
    }

    if (session.status !== 'OPEN') {
      return {
        success: false,
        message: 'Phiên đã kết thúc. Vui lòng liên hệ nhân viên hoặc quét QR code mới.',
      };
    }

    // Removed lockedAt check to allow continuous custom ordering.

    // ── Step 3: Verify tableId khớp với session.tableId ────────────────────
    if (session.tableId !== tableId) {
      return {
        success: false,
        message: 'Phiên không hợp lệ cho bàn này. Vui lòng quét lại QR code.',
      };
    }

    // ── Step 4: Verify tất cả menuItemId tồn tại và isActive = true ────────
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, price: true, isActive: true, isSoldOut: true },
    });

    // Build map để lookup nhanh O(1)
    type MenuItemRecord = {
      id: string;
      name: string;
      price: { toString(): string } | string | number;
      isActive: boolean;
      isSoldOut: boolean;
    };
    const menuItemMap = new Map<string, MenuItemRecord>(menuItems.map((m: MenuItemRecord) => [m.id, m]));

    // Kiểm tra các item không tồn tại hoặc không active
    const itemErrors: Array<{ menuItemId: string; message: string }> = [];

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        itemErrors.push({
          menuItemId: item.menuItemId,
          message: 'Món ăn không tồn tại trong thực đơn',
        });
      } else if (!menuItem.isActive) {
        itemErrors.push({
          menuItemId: item.menuItemId,
          message: `"${menuItem.name}" không còn phục vụ`,
        });
      } else if (menuItem.isSoldOut) {
        itemErrors.push({
          menuItemId: item.menuItemId,
          message: `"${menuItem.name}" đã hết hàng`,
        });
      }
    }

    if (itemErrors.length > 0) {
      const errorDetails = itemErrors.map((e) => e.message).join(', ');
      return {
        success: false,
        message: `Không thể đặt hàng do: ${errorDetails}`,
        errors: { itemErrors },
      };
    }

    // ── Step 5: Lấy giá từ DB (KHÔNG tin price từ client) ─────────────────
    // Lý do bảo mật: client có thể gửi price=0 hoặc price âm để gian lận.
    // Server Action luôn lấy unitPrice từ DB — đây là source of truth.

    // ── Step 6: Prisma createMany OrderItem ────────────────────────────────
    const createdIds: string[] = [];

    // Dùng transaction để đảm bảo tất cả items được tạo atomically
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const menuItem = menuItemMap.get(item.menuItemId)!;
        const unitPrice = Number(menuItem.price);

        // 1. Tìm item CART tương ứng trong DB
        const cartItem = await tx.orderItem.findUnique({
          where: {
            sessionId_menuItemId_status: {
              sessionId,
              menuItemId: item.menuItemId,
              status: 'CART',
            },
          },
        });

        // 2. Tìm xem đã có item PENDING tương ứng trong DB chưa
        const existingPending = await tx.orderItem.findUnique({
          where: {
            sessionId_menuItemId_status: {
              sessionId,
              menuItemId: item.menuItemId,
              status: 'PENDING',
            },
          },
        });

        const qtyToSubmit = cartItem ? cartItem.qty : item.qty;
        const noteToSubmit = cartItem ? cartItem.note : item.note;

        if (existingPending) {
          // Đã có PENDING: cộng dồn qty từ CART vào PENDING và xóa CART item
          const updated = await tx.orderItem.update({
            where: { id: existingPending.id },
            data: {
              qty: existingPending.qty + qtyToSubmit,
              note: noteToSubmit ? (existingPending.note ? `${existingPending.note}, ${noteToSubmit}` : noteToSubmit) : existingPending.note,
            },
          });
          
          if (cartItem) {
            await tx.orderItem.delete({
              where: { id: cartItem.id },
            });
          }
          createdIds.push(updated.id);
        } else {
          // Chưa có PENDING:
          if (cartItem) {
            // Chuyển status dòng CART thành PENDING
            const updated = await tx.orderItem.update({
              where: { id: cartItem.id },
              data: {
                status: 'PENDING',
                note: noteToSubmit ?? cartItem.note,
              },
            });
            createdIds.push(updated.id);
          } else {
            // Fallback: Tạo mới với status PENDING
            const created = await tx.orderItem.create({
              data: {
                sessionId,
                menuItemId: item.menuItemId,
                qty: qtyToSubmit,
                note: noteToSubmit ?? null,
                unitPrice,
                status: 'PENDING',
              },
            });
            createdIds.push(created.id);
          }
        }
      }
    });

    // ── Step 7: Emit Socket.io event tới Cashier room ──────────────────────
    // Import dynamic để tránh import server-side module vào client bundle.
    // emitCashierNewOrder sẽ gracefully fail (warn only) nếu socket chưa init.
    try {
      const { emitCashierNewOrder } = await import(
        // Đường dẫn relative từ vị trí build, dùng alias nếu config
        // Vì đây là frontend Next.js → gọi backend socket qua internal API
        // hoặc dùng approach khác tùy architecture.
        // Trong monorepo này, emit qua HTTP call tới backend endpoint:
        '@/lib/socket/socket-emit'
      );

      const newItemsPayload = items.map((item, index) => {
        const menuItem = menuItemMap.get(item.menuItemId)!;
        return {
          id: createdIds[index],
          menuItemId: item.menuItemId,
          menuItemName: menuItem.name,
          qty: item.qty,
          unitPrice: Number(menuItem.price),
          note: item.note,
        };
      });

      const total = newItemsPayload.reduce(
        (sum, i) => sum + i.unitPrice * i.qty,
        0
      );

      await emitCashierNewOrder({
        sessionId,
        tableId,
        tableNumber: session.table.tableNumber,
        newItems: newItemsPayload,
        total,
        createdAt: new Date().toISOString(),
      });
    } catch (socketErr) {
      // Socket emit thất bại KHÔNG rollback order đã tạo thành công.
      // Thu ngân sẽ thấy order khi refresh hoặc polling — degraded gracefully.
      console.warn('[submitOrder] Socket emit thất bại (non-critical):', socketErr);
    }

    // ── Step 8: Trả về kết quả thành công ─────────────────────────────────
    return {
      success: true,
      data: { orderItemIds: createdIds },
    };
  } catch (error) {
    // Catch-all: lỗi DB không expected (connection loss, constraint violation...)
    console.error('[submitOrder] Lỗi không mong muốn:', error);
    return {
      success: false,
      message: 'Có lỗi xảy ra phía server. Vui lòng thử lại sau vài giây.',
    };
  }
}
