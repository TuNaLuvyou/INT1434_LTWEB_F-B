import { Socket, Server } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../events';

/**
 * kitchenHandler — xử lý events liên quan màn hình KDS bếp
 *
 * Events lắng nghe từ KDS client (bếp):
 * - kitchen:item-updated  → KDS cập nhật trạng thái một order item
 *
 * Events broadcast từ đây:
 * - order:status-changed  → room table:[tableId] (notify khách)
 * - kitchen:item-updated  → room cashier (notify thu ngân)
 */
export function kitchenHandler(socket: Socket, io: Server): void {
  /**
   * KDS bếp cập nhật trạng thái order item
   * Payload: { orderItemId, sessionId, tableId, status: 'PREPARING'|'DONE'|'VOID', menuItemName }
   */
  socket.on(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, (data: {
    orderItemId: string;
    sessionId: string;
    tableId: string;
    menuItemId?: string;
    qty?: number;
    deltaQty?: number;
    note?: string | null;
    removedOrderItemId?: string;
    status: 'PREPARING' | 'DONE' | 'VOID';
    menuItemName?: string;
  }) => {
    console.log(`[kitchenHandler] Item ${data.orderItemId} → ${data.status} (bởi socket ${socket.id})`);

    // 1. Notify khách hàng đang ngồi tại bàn
    io.to(SOCKET_ROOMS.table(data.tableId)).emit(SOCKET_EVENTS.ORDER_STATUS_CHANGED, {
      orderItemId:  data.orderItemId,
      sessionId:    data.sessionId,
      tableId:      data.tableId,
      status:       data.status,
      menuItemName: data.menuItemName,
      updatedAt:    new Date().toISOString(),
    });

    // 2. Notify cashier (để thu ngân theo dõi tiến độ)
    io.to(SOCKET_ROOMS.CASHIER).emit(SOCKET_EVENTS.KITCHEN_ITEM_UPDATED, {
      orderItemId:  data.orderItemId,
      tableId:      data.tableId,
      menuItemId:   data.menuItemId,
      qty:          data.qty,
      deltaQty:     data.deltaQty,
      note:         data.note,
      removedOrderItemId: data.removedOrderItemId,
      status:       data.status,
      menuItemName: data.menuItemName,
      updatedAt:    new Date().toISOString(),
    });
  });
}
