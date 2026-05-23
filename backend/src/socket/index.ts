import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

/**
 * Khởi tạo Socket.io server từ HTTP server đã tồn tại.
 * Gọi hàm này SAU KHI tạo httpServer trong app.ts.
 *
 * Thiết kế:
 * - Dùng module singleton: io được tạo một lần và export để các controller dùng.
 * - Cho phép room "menu-updates": bất kỳ client nào (trang /menu) đều có thể join room này
 *   để nhận broadcast khi bếp báo hết món.
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  console.log(`[Socket.io] Cấu hình CORS origin: ${allowedOrigin} (Hoặc cho phép tự do trong Dev)`);

  io = new SocketIOServer(httpServer, {
    cors: {
      // Trong môi trường development, cho phép tất cả các origin để tránh lỗi CORS handshake lặt vặt
      origin: process.env.NODE_ENV === 'production' ? allowedOrigin : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Tăng timeout để tránh disconnect ngắt giữa chừng
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client kết nối: ${socket.id}`);

    // Client tự join room "menu-updates" khi mount trang menu
    socket.on('join:menu-updates', () => {
      socket.join('menu-updates');
      console.log(`[Socket.io] Socket ${socket.id} đã join room "menu-updates"`);
    });

    // Client tự leave room khi unmount
    socket.on('leave:menu-updates', () => {
      socket.leave('menu-updates');
      console.log(`[Socket.io] Socket ${socket.id} đã leave room "menu-updates"`);
    });

    // ─── Floor-plan room (F4 — sơ đồ bàn) ───────────────────────────────────
    // Staff/cashier screen join room này để nhận real-time table status updates
    socket.on('join:floor-plan', () => {
      socket.join('floor-plan');
      console.log(`[Socket.io] Socket ${socket.id} đã join room "floor-plan"`);
    });

    socket.on('leave:floor-plan', () => {
      socket.leave('floor-plan');
      console.log(`[Socket.io] Socket ${socket.id} đã leave room "floor-plan"`);
    });

    // ─── Table room (khách hàng tại bàn cụ thể) ──────────────────────────────
    // Trang /menu/[tableId] join room "table:[tableId]" để nhận "session:closed"
    socket.on('join:table', (tableId: string) => {
      const room = `table:${tableId}`;
      socket.join(room);
      console.log(`[Socket.io] Socket ${socket.id} đã join room "${room}"`);
    });

    socket.on('leave:table', (tableId: string) => {
      const room = `table:${tableId}`;
      socket.leave(room);
      console.log(`[Socket.io] Socket ${socket.id} đã leave room "${room}"`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client ngắt kết nối: ${socket.id} | Lý do: ${reason}`);
    });
  });

  console.log('[Socket.io] Server đã khởi tạo thành công');
  return io;
}

/**
 * Lấy instance io đã được khởi tạo.
 * Sử dụng trong các controller để emit event sau khi update DB.
 * Throws nếu gọi trước khi initSocket().
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('[Socket.io] IO chưa được khởi tạo. Hãy gọi initSocket() trước.');
  }
  return io;
}
