import { Socket } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../events';

/**
 * cartHandler — xử lý events liên quan giỏ hàng của khách
 *
 * Events lắng nghe từ client:
 * - (hiện tại) không có event nào từ client cho cart
 *   Cart được quản lý qua REST API, Socket chỉ dùng để BROADCAST.
 *
 * Events broadcast từ đây:
 * - cart:updated       → room table:[tableId]
 * - cart:item-soldout  → room table:[tableId]
 * - order:status-changed → room table:[tableId]
 *
 * Lưu ý: Các emit thực tế được gọi từ controllers qua emit.helpers.ts.
 * Handler này chủ yếu log debug và setup listeners phía client nếu cần.
 */
export function cartHandler(socket: Socket): void {
  // Lắng nghe nếu client request force-refresh giỏ hàng (ví dụ sau reconnect)
  socket.on('cart:request-refresh', (data: { tableId: string }) => {
    const room = SOCKET_ROOMS.table(data.tableId);
    if (!socket.rooms.has(room)) {
      console.warn(`[cartHandler] Socket ${socket.id} request refresh nhưng chưa join room ${room}`);
      return;
    }
    console.log(`[cartHandler] Client ${socket.id} yêu cầu refresh cart của bàn ${data.tableId}`);
    // Controller sẽ emit cart:updated sau khi fetch lại data
    // Ở đây chỉ log — action thực sự qua REST /api/sessions/:id
    socket.emit(SOCKET_EVENTS.CART_UPDATED, {
      message: 'Vui lòng gọi GET /api/sessions/:id để lấy cart mới nhất',
      tableId: data.tableId,
    });
  });

  // Log khi nhận order status change từ KDS (để debug)
  socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGED, (data: unknown) => {
    console.log(`[cartHandler] order:status-changed nhận từ ${socket.id}:`, data);
  });
}
