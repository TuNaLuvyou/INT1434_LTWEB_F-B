import { Socket } from 'socket.io';

/**
 * floorHandler — xử lý events liên quan màn hình sơ đồ bàn (Floor Plan)
 *
 * Màn hình Floor Plan ở `/admin/floor` hiển thị real-time trạng thái tất cả bàn.
 * Events lắng nghe từ floor-plan client:
 * - (hiện tại) chỉ nhận broadcast, không gửi event lên server
 *
 * Events broadcast tới floor-plan được gọi qua emit.helpers.ts từ controllers:
 * - table:status-changed   → khi bàn đổi AVAILABLE/OCCUPIED/RESERVED
 * - table:session-updated  → khi session thêm order (cập nhật tổng tiền realtime)
 */
export function floorHandler(socket: Socket): void {
  // Cashier/Admin request cập nhật trạng thái bàn thủ công (ví dụ: đặt bàn)
  socket.on('floor:request-status-update', (data: {
    tableId: string;
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  }) => {
    // Chỉ log ở đây — action thực sự đi qua REST API PATCH /api/tables/:id
    // Socket không được phép mutate DB trực tiếp để đảm bảo audit trail
    console.log(
      `[floorHandler] Socket ${socket.id} yêu cầu đổi bàn ${data.tableId} → ${data.status}. ` +
      `Dùng REST API PATCH /api/tables/:id để thực hiện.`
    );

    socket.emit('floor:request-acknowledged', {
      message: 'Dùng PATCH /api/tables/:id để cập nhật. Socket chỉ nhận broadcast.',
      tableId: data.tableId,
    });
  });

  // Admin yêu cầu broadcast trạng thái tất cả bàn cho toàn room floor-plan
  // (dùng khi có client mới join và cần sync trạng thái hiện tại)
  socket.on('floor:request-full-sync', () => {
    console.log(`[floorHandler] Socket ${socket.id} yêu cầu full sync — dùng GET /api/tables`);
    socket.emit('floor:request-acknowledged', {
      message: 'Dùng GET /api/tables để lấy toàn bộ trạng thái bàn.',
    });
  });
}
