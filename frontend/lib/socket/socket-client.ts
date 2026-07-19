/**
 * socket-client.ts — Singleton Socket.io client cho Next.js
 *
 * ─── Tại sao singleton? ─────────────────────────────────────────────────────
 * Next.js với React Strict Mode mount component 2 lần trong dev.
 * Nếu mỗi component tự tạo socket riêng → nhiều kết nối song song, memory leak.
 * Singleton đảm bảo toàn bộ app chỉ dùng đúng 1 socket connection.
 *
 * ─── Tại sao autoConnect: false? ───────────────────────────────────────────
 * Next.js render trên cả Server và Client. Nếu autoConnect: true:
 * - Module được import trên Server (SSR) → gọi io() → crash vì không có DOM
 * - Component chưa mount nhưng socket đã kết nối → không có cleanup → leak
 * autoConnect: false cho phép kiểm soát chính xác KỊCH BẢN kết nối:
 * - Chỉ connect khi component mount (useEffect)
 * - Đảm bảo cleanup khi unmount
 * ────────────────────────────────────────────────────────────────────────────
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Lấy singleton Socket.io instance.
 * Instance được tạo lần đầu khi gọi hàm này, sau đó tái sử dụng.
 *
 * Lưu ý: Chỉ gọi trong client context (bên trong useEffect hoặc event handler).
 * KHÔNG gọi ở top-level của Server Component hoặc file module.
 */
export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

    socket = io(url, {
      // Ép dùng WebSocket → bypass HTTP polling, tránh lỗi CORS với proxy
      transports: ['websocket', 'polling'],
      withCredentials: true,
      // QUAN TRỌNG: Không connect tự động — để component kiểm soát lifecycle
      autoConnect: false,
      // Retry config — tự động reconnect khi mất kết nối
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    // Global debug listeners (chỉ trong dev)
    if (process.env.NODE_ENV !== 'production') {
      socket.on('connect', () => {
        console.log('[Socket] ✅ Kết nối thành công:', socket!.id);
      });
      socket.on('disconnect', (reason) => {
        console.warn('[Socket] ❌ Ngắt kết nối:', reason);
      });
      socket.on('connect_error', (err) => {
        console.warn('[Socket] ⚠️ Lỗi kết nối (sẽ tự retry):', err.message);
      });
    }
  }

  return socket;
}

/**
 * Reset singleton — dùng trong testing hoặc khi cần tạo lại connection.
 */
function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}
