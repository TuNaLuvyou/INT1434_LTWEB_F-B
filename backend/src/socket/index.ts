import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS, SOCKET_ROOMS, AUTH_REQUIRED_ROOMS, ROOM_ALLOWED_ROLES } from './events';
import { cartHandler } from './handlers/cart.handler';
import { kitchenHandler } from './handlers/kitchen.handler';
import { floorHandler } from './handlers/floor.handler';

let io: SocketIOServer;

// ─── JWT validation helper ────────────────────────────────────────────────────

interface JwtPayload {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN';
}

function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'restoflow_jwt_secret_key';
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Xác định xem room có yêu cầu auth hay không.
 * Public rooms: "menu-updates" và "table:[id]" — khách không cần login.
 */
function isAuthRequired(room: string): boolean {
  // Nếu room là "table:[bất kỳ]" → public
  if (room.startsWith('table:')) return false;
  if (room === SOCKET_ROOMS.MENU_UPDATES) return false;
  // Còn lại: kitchen, cashier, floor-plan đều cần auth
  return (AUTH_REQUIRED_ROOMS as readonly string[]).includes(room);
}

/**
 * Kiểm tra role có được phép vào room hay không.
 */
function canJoinRoom(room: string, role: string): boolean {
  const allowed = ROOM_ALLOWED_ROLES[room];
  if (!allowed) return false;
  return allowed.includes(role);
}

// ─── initSocket ───────────────────────────────────────────────────────────────
/**
 * Khởi tạo Socket.io server từ HTTP server đã tồn tại.
 * Gọi hàm này SAU KHI tạo httpServer trong app.ts.
 *
 * Thiết kế singleton:
 * - io được tạo một lần, export qua getIO() để controllers dùng.
 * - Mỗi loại event được phân loại vào handler riêng để dễ maintain.
 *
 * Rooms trong hệ thống:
 * ┌─────────────────┬─────────────────────────────┬──────────────────────┐
 * │ Room            │ Dành cho                    │ Auth yêu cầu         │
 * ├─────────────────┼─────────────────────────────┼──────────────────────┤
 * │ table:[tableId] │ Khách tại bàn (QR)          │ Không                │
 * │ menu-updates    │ Mọi trang /menu             │ Không                │
 * │ kitchen         │ Màn hình KDS bếp            │ ADMIN/MANAGER/KITCHEN│
 * │ cashier         │ Màn hình thu ngân           │ ADMIN/MANAGER/STAFF  │
 * │ floor-plan      │ Sơ đồ bàn admin             │ ADMIN/MANAGER        │
 * └─────────────────┴─────────────────────────────┴──────────────────────┘
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const isDev = process.env.NODE_ENV !== 'production';

  console.log(`[Socket.io] Khởi tạo... CORS origin: ${isDev ? '*' : allowedOrigin}`);

  io = new SocketIOServer(httpServer, {
    cors: {
      // Dev: allow all origins để tránh lỗi CORS handshake
      // Prod: chỉ cho phép FRONTEND_URL
      origin: isDev ? '*' : allowedOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    // Cho phép cả websocket và polling để tương thích tốt hơn
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    const clientIp = socket.handshake.address;
    console.log(`[Socket.io] ✅ Client kết nối: ${socket.id} | IP: ${clientIp}`);

    // ── Đăng ký domain handlers ───────────────────────────────────────────────
    cartHandler(socket);
    kitchenHandler(socket, io);
    floorHandler(socket, io);

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: join-room
    // Client gửi để vào room. Server validate auth nếu room yêu cầu.
    //
    // Payload: { room: string, token?: string }
    // Response thành công:  socket.emit('room-joined', { room })
    // Response thất bại:    socket.emit('room-error',  { room, message })
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { room: string; token?: string }) => {
      if (!data?.room || typeof data.room !== 'string') {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'room name không hợp lệ' });
        return;
      }

      const room = data.room.trim();

      // Validate room format: chỉ cho phép các room đã định nghĩa
      const validRoomPatterns = [
        /^table:[a-zA-Z0-9_-]+$/,   // table:[uuid/cuid]
        /^kitchen$/,
        /^cashier$/,
        /^floor-plan$/,
        /^menu-updates$/,
      ];
      const isValidRoom = validRoomPatterns.some((pattern) => pattern.test(room));
      if (!isValidRoom) {
        console.warn(`[Socket.io] ⛔ Socket ${socket.id} cố join room không hợp lệ: "${room}"`);
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          room,
          message: `Room "${room}" không được hỗ trợ`,
        });
        return;
      }

      // Kiểm tra auth nếu room yêu cầu
      if (isAuthRequired(room)) {
        if (!data.token) {
          console.warn(`[Socket.io] ⛔ Socket ${socket.id} cố join "${room}" không có token`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: `Room "${room}" yêu cầu authentication token`,
          });
          return;
        }

        const payload = verifyToken(data.token);
        if (!payload) {
          console.warn(`[Socket.io] ⛔ Socket ${socket.id} token không hợp lệ khi join "${room}"`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: 'Token không hợp lệ hoặc đã hết hạn',
          });
          return;
        }

        if (!canJoinRoom(room, payload.role)) {
          console.warn(`[Socket.io] ⛔ Socket ${socket.id} role "${payload.role}" không được phép vào "${room}"`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: `Role "${payload.role}" không có quyền vào room "${room}"`,
          });
          return;
        }

        // Lưu user info vào socket data để dùng sau
        (socket.data as any).user = payload;
        console.log(`[Socket.io] 🔐 Socket ${socket.id} (${payload.role}: ${payload.email}) → join "${room}"`);
      } else {
        console.log(`[Socket.io] 🔓 Socket ${socket.id} → join public room "${room}"`);
      }

      socket.join(room);
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, { room });
      console.log(`[Socket.io] ✅ Socket ${socket.id} đã vào room "${room}" | Rooms: [${[...socket.rooms].join(', ')}]`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: leave-room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data: { room: string }) => {
      if (!data?.room) return;
      socket.leave(data.room);
      console.log(`[Socket.io] 👋 Socket ${socket.id} đã rời room "${data.room}"`);
    });

    // ── Legacy handlers — giữ backward compat với code cũ ─────────────────────
    // Các event này đã tồn tại từ trước, giữ lại để không break code đang chạy

    socket.on('join:menu-updates', () => {
      socket.join(SOCKET_ROOMS.MENU_UPDATES);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} join "menu-updates"`);
    });

    socket.on('leave:menu-updates', () => {
      socket.leave(SOCKET_ROOMS.MENU_UPDATES);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} leave "menu-updates"`);
    });

    socket.on('join:floor-plan', () => {
      socket.join(SOCKET_ROOMS.FLOOR_PLAN);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} join "floor-plan"`);
    });

    socket.on('leave:floor-plan', () => {
      socket.leave(SOCKET_ROOMS.FLOOR_PLAN);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} leave "floor-plan"`);
    });

    socket.on('join:table', (tableId: string) => {
      const room = SOCKET_ROOMS.table(tableId);
      socket.join(room);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} join "${room}"`);
    });

    socket.on('leave:table', (tableId: string) => {
      const room = SOCKET_ROOMS.table(tableId);
      socket.leave(room);
      console.log(`[Socket.io] (legacy) Socket ${socket.id} leave "${room}"`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: disconnect
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const user = (socket.data as any).user;
      const userInfo = user ? `(${user.role}: ${user.email})` : '(public)';
      console.log(`[Socket.io] ❌ Client ngắt kết nối: ${socket.id} ${userInfo} | Lý do: ${reason}`);
    });
  });

  console.log('[Socket.io] ✅ Server đã khởi tạo thành công');
  return io;
}

/**
 * Lấy instance io đã được khởi tạo (singleton).
 * Dùng trong controllers và emit helpers.
 * Throws nếu gọi trước initSocket().
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('[Socket.io] IO chưa được khởi tạo. Hãy gọi initSocket() trước.');
  }
  return io;
}
