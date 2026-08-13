/**
 * SOCKET_EVENTS — Tất cả event names dùng trong HiAI-MenuGo POS
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
  /** Emit khi KDS (bếp) đổi trạng thái một order item (PENDING→PREPARING→DONE) */
  ORDER_STATUS_CHANGED:   'order:status-changed',

  // ─── Session ────────────────────────────────────────────────────────────────
  /** Emit khi cashier đóng bill hoặc huỷ session — khách thấy "Phiên kết thúc" */
  SESSION_CLOSED:         'session:closed',
  /** Emit khi tất cả order items trong session đã hoàn thành (DONE) */
  SESSION_ALL_DONE:       'session:all-done',

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

  // ─── Payment (thanh toán từ phía khách QR Menu) ──────────────────────────────
  /** Emit khi khách chọn VietQR tại bàn → POS cashier lock nút thanh toán bàn đó */
  PAYMENT_PENDING:        'payment:pending',
  /** Emit khi cashier confirm đã nhận tiền → khách thấy màn hình thành công */
  PAYMENT_COMPLETED:      'payment:completed',
  /** Emit khi khách huỷ yêu cầu VietQR → POS cashier reset nút về bình thường */
  PAYMENT_CANCELLED:      'payment:cancelled',

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
  KITCHEN:      (tenantId: string, branchId: string) => `tenant:${tenantId}:branch:${branchId}:kitchen`,
  CASHIER:      (tenantId: string, branchId: string) => `tenant:${tenantId}:branch:${branchId}:cashier`,
  TENANT_CASHIER: (tenantId: string) => `tenant:${tenantId}:cashier`,
  FLOOR_PLAN:   (tenantId: string, branchId: string) => `tenant:${tenantId}:branch:${branchId}:floor-plan`,
  MENU_UPDATES: (tenantId: string) => `tenant:${tenantId}:menu-updates`,
  /** Tạo room name cho bàn cụ thể */
  table:        (tableId: string) => `table:${tableId}`,
} as const;

/**
 * Regex patterns for auth rooms to validate on join.
 */
export const AUTH_REQUIRED_ROOM_PATTERNS = [
  /^tenant:[a-zA-Z0-9_-]+:branch:[a-zA-Z0-9_-]+:kitchen$/,
  /^tenant:[a-zA-Z0-9_-]+:branch:[a-zA-Z0-9_-]+:cashier$/,
  /^tenant:[a-zA-Z0-9_-]+:cashier$/,
  /^tenant:[a-zA-Z0-9_-]+:branch:[a-zA-Z0-9_-]+:floor-plan$/,
];

/** Roles được phép join từng room type (phần cuối của room name) */
export const ROOM_ALLOWED_ROLES: Record<string, string[]> = {
  'kitchen':    ['ADMIN', 'MANAGER', 'KITCHEN'],
  'cashier':    ['ADMIN', 'MANAGER', 'CASHIER'],
  'floor-plan': ['ADMIN', 'MANAGER', 'CASHIER'],
};
