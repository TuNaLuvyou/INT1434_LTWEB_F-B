import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS, SOCKET_ROOMS, AUTH_REQUIRED_ROOM_PATTERNS, ROOM_ALLOWED_ROLES } from './events';
import { cartHandler } from './handlers/cart.handler';
import { kitchenHandler } from './handlers/kitchen.handler';
import { floorHandler } from './handlers/floor.handler';

let io: SocketIOServer;

// ─── JWT validation helper ────────────────────────────────────────────────────

interface JwtPayload {
  id: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';
  tenantId?: string;
  branchId?: string;
}

function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      console.error('[Socket.io] JWT_SECRET chưa được cấu hình!');
      return null;
    }
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
  if (room.startsWith('table:')) return false;
  if (/^tenant:[a-zA-Z0-9_-]+:menu-updates$/.test(room)) return false;
  return AUTH_REQUIRED_ROOM_PATTERNS.some(p => p.test(room));
}

/**
 * Kiểm tra role có được phép vào room hay không.
 */
function canJoinRoom(room: string, role: string): boolean {
  // Trích xuất loại room (vd: kitchen, cashier)
  const parts = room.split(':');
  const roomType = parts[parts.length - 1];
  const allowed = ROOM_ALLOWED_ROLES[roomType];
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
 * │ cashier         │ Màn hình thu ngân           │ ADMIN/MANAGER/CASHIER│
 * │ floor-plan      │ Sơ đồ bàn admin             │ ADMIN/MANAGER        │
 * └─────────────────┴─────────────────────────────┴──────────────────────┘
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const isDev = process.env.NODE_ENV !== 'production';

  // QUAN TRỌNG: Không dùng '*' khi credentials: true — browser sẽ từ chối gửi cookie.
  // Dev dùng 'http://localhost:3000', Prod dùng FRONTEND_URL.
  const corsOrigin = isDev ? (process.env.FRONTEND_URL || 'http://localhost:3000') : allowedOrigin;
  console.log(`[Socket.io] Khởi tạo... CORS origin: ${corsOrigin}`);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
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
      const isValidRoom = room.startsWith('table:') || 
                          /^tenant:[a-zA-Z0-9_-]+:menu-updates$/.test(room) ||
                          AUTH_REQUIRED_ROOM_PATTERNS.some(p => p.test(room));
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

        // Xác thực tenantId và branchId nếu user thuộc tenant cụ thể (SaaS)
        const parts = room.split(':');
        const roomTenantId = parts[1];
        const roomBranchId = parts[3];

        if (payload.role !== 'PLATFORM_ADMIN') {
          if (payload.tenantId && payload.tenantId !== roomTenantId) {
            console.warn(`[Socket.io] ⛔ Socket ${socket.id} tenant mismatch`);
            socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
              room,
              message: `Token thuộc về tenant khác`,
            });
            return;
          }
          if (roomBranchId && payload.branchId && payload.branchId !== roomBranchId) {
            console.warn(`[Socket.io] ⛔ Socket ${socket.id} branch mismatch`);
            socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
              room,
              message: `Token thuộc về branch khác`,
            });
            return;
          }
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
