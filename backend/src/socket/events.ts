/**
 * SOCKET_EVENTS — Tất cả event names dùng trong RestoFlow POS
 *
 * ─── Quy tắc đặt tên ────────────────────────────────────────────────────────
 * - Format:  "<domain>:<action>"
 * - Domain:  cart | session | order | kitchen | table | cashier | menu
 * - Tất cả lowercase, dùng dấu gạch ngang (-) thay khoảng trắng
 * - Export as const để TypeScript infer literal types → bắt lỗi typo compile-time
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SOCKET_EVENTS = {
  // ─── Cart & Order (trang /menu/[tableId] của khách) ────────────────────────
  /** Emit khi khách thêm/xoá/sửa item trong giỏ hàng */
  CART_UPDATED:           'cart:updated',
  /** Emit khi một item trong giỏ bị đánh dấu hết hàng (sold-out) */
  CART_ITEM_SOLD_OUT:     'cart:item-soldout',
  /** Emit khi KDS (bếp) đổi trạng thái một order item (PENDING→PREPARING→DONE) */
  ORDER_STATUS_CHANGED:   'order:status-changed',

  // ─── Session ────────────────────────────────────────────────────────────────
  /** Emit khi cashier đóng bill hoặc huỷ session — khách thấy "Phiên kết thúc" */
  SESSION_CLOSED:         'session:closed',

  // ─── Kitchen / KDS ──────────────────────────────────────────────────────────
  /** Emit khi khách submit order → KDS hiển thị ticket mới */
  KITCHEN_NEW_TICKET:     'kitchen:new-ticket',
  /** Emit khi KDS cập nhật trạng thái một item (PREPARING/DONE/VOID) */
  KITCHEN_ITEM_UPDATED:   'kitchen:item-updated',

  // ─── Floor Plan (sơ đồ bàn) ─────────────────────────────────────────────────
  /** Emit khi trạng thái bàn thay đổi (AVAILABLE/OCCUPIED/RESERVED) */
  TABLE_STATUS_CHANGED:   'table:status-changed',
  /** Emit khi session của bàn được cập nhật (thêm item, thay đổi tổng tiền...) */
  TABLE_SESSION_UPDATED:  'table:session-updated',

  // ─── Cashier (màn hình thu ngân) ─────────────────────────────────────────────
  /** Emit khi khách gửi order từ QR → cashier nhận notification */
  CASHIER_NEW_ORDER:      'cashier:new-order',
  /** Emit khi cashier request void một item, cần confirm */
  CASHIER_VOID_CONFIRM:   'cashier:void-confirm',

  // ─── Menu ────────────────────────────────────────────────────────────────────
  /** Emit khi admin/bếp toggle sold-out một menu item */
  MENU_SOLD_OUT:          'menu:soldout',

  // ─── Room join/leave (client → server) ──────────────────────────────────────
  /** Client emit để join/leave room */
  JOIN_ROOM:              'join-room',
  LEAVE_ROOM:             'leave-room',
  /** Server confirm sau khi join thành công */
  ROOM_JOINED:            'room-joined',
  ROOM_ERROR:             'room-error',
} as const;

/**
 * SOCKET_ROOMS — Tên tất cả rooms dùng trong hệ thống
 *
 * ─── Kiến trúc rooms ────────────────────────────────────────────────────────
 * table:[tableId]  → mỗi bàn có 1 room riêng. Khách join khi mở trang menu.
 * kitchen          → duy nhất 1. KDS bếp join để nhận ticket mới.
 * cashier          → duy nhất 1. Thu ngân join để nhận order từ khách.
 * floor-plan       → duy nhất 1. Admin/Manager xem sơ đồ bàn realtime.
 * menu-updates     → public. Tất cả trang /menu join để nhận sold-out.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const SOCKET_ROOMS = {
  KITCHEN:        'kitchen',
  CASHIER:        'cashier',
  FLOOR_PLAN:     'floor-plan',
  MENU_UPDATES:   'menu-updates',
  /** Tạo room name cho bàn cụ thể */
  table:          (tableId: string) => `table:${tableId}`,
} as const;

/**
 * Các rooms yêu cầu authentication để join.
 * Public rooms (menu-updates, table:[id]) không cần auth.
 */
export const AUTH_REQUIRED_ROOMS = [
  SOCKET_ROOMS.KITCHEN,
  SOCKET_ROOMS.CASHIER,
  SOCKET_ROOMS.FLOOR_PLAN,
] as const;

/** Roles được phép join từng room */
export const ROOM_ALLOWED_ROLES: Record<string, string[]> = {
  [SOCKET_ROOMS.KITCHEN]:    ['ADMIN', 'MANAGER', 'KITCHEN'],
  [SOCKET_ROOMS.CASHIER]:    ['ADMIN', 'MANAGER', 'STAFF'],
  [SOCKET_ROOMS.FLOOR_PLAN]: ['ADMIN', 'MANAGER'],
};
