import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS, AUTH_REQUIRED_ROOM_PATTERNS, ROOM_ALLOWED_ROLES } from './events';
import { kitchenHandler } from './handlers/kitchen.handler';
import { floorHandler } from './handlers/floor.handler';
import { logger } from '../utils/logger';

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
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      logger.error('Socket.io', 'JWT_ACCESS_SECRET is not configured');
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
  // In dev mode, allow true (reflects request origin). In prod, use FRONTEND_URL.
  const corsOrigin: any = isDev ? true : allowedOrigin;
  console.log(`[Socket.io] Khởi tạo... CORS origin: ${corsOrigin}`);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    // Dùng polling trước rồi upgrade WebSocket để ổn định hơn
    transports: ['polling', 'websocket'],
  });

  io.on('connection', (socket: Socket) => {
    const clientIp = socket.handshake.address;
    logger.info('Socket.io', `Client connected: ${socket.id} | IP: ${clientIp}`);

    // ── Đăng ký domain handlers ───────────────────────────────────────────────
    kitchenHandler(socket, io);
    floorHandler(socket, io);

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { room: string; token?: string }) => {
      if (!data?.room || typeof data.room !== 'string') {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'room name không hợp lệ' });
        return;
      }

      const room = data.room.trim();

      const isValidRoom = room.startsWith('table:') || 
                          /^tenant:[a-zA-Z0-9_-]+:menu-updates$/.test(room) ||
                          AUTH_REQUIRED_ROOM_PATTERNS.some(p => p.test(room));
      if (!isValidRoom) {
        logger.warn('Socket.io', `Socket ${socket.id} tried to join invalid room: "${room}"`);
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          room,
          message: `Room "${room}" không được hỗ trợ`,
        });
        return;
      }

      if (isAuthRequired(room)) {
        if (!data.token) {
          logger.warn('Socket.io', `Socket ${socket.id} tried to join "${room}" without token`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: `Room "${room}" yêu cầu authentication token`,
          });
          return;
        }

        const payload = verifyToken(data.token);
        if (!payload) {
          logger.warn('Socket.io', `Socket ${socket.id} invalid token when joining "${room}"`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: 'Token không hợp lệ hoặc đã hết hạn',
          });
          return;
        }

        if (!canJoinRoom(room, payload.role)) {
          logger.warn('Socket.io', `Socket ${socket.id} role "${payload.role}" is not allowed to join "${room}"`);
          socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
            room,
            message: `Role "${payload.role}" không có quyền vào room "${room}"`,
          });
          return;
        }

        const parts = room.split(':');
        const roomTenantId = parts[1];
        const roomBranchId = parts[3];

        if (payload.role !== 'PLATFORM_ADMIN') {
          if (payload.tenantId && payload.tenantId !== roomTenantId) {
            logger.warn('Socket.io', `Socket ${socket.id} tenant mismatch`);
            socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
              room,
              message: `Token thuộc về tenant khác`,
            });
            return;
          }
          if (roomBranchId && payload.branchId && payload.branchId !== roomBranchId) {
            logger.warn('Socket.io', `Socket ${socket.id} branch mismatch`);
            socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
              room,
              message: `Token thuộc về branch khác`,
            });
            return;
          }
        }

        (socket.data as any).user = payload;
        logger.info('Socket.io', `Socket ${socket.id} (${payload.role}: ${payload.email}) joined "${room}"`);
      } else {
        logger.info('Socket.io', `Socket ${socket.id} joined public room "${room}"`);
      }

      socket.join(room);
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, { room });
      logger.info('Socket.io', `Socket ${socket.id} entered room "${room}" | Rooms: [${[...socket.rooms].join(', ')}]`);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data: { room: string }) => {
      if (!data?.room) return;
      socket.leave(data.room);
      logger.info('Socket.io', `Socket ${socket.id} left room "${data.room}"`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: disconnect
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const user = (socket.data as any).user;
      const userInfo = user ? `(${user.role}: ${user.email})` : '(public)';
      logger.info('Socket.io', `Client disconnected: ${socket.id} ${userInfo} | Reason: ${reason}`);
    });
  });

  logger.info('Socket.io', 'Server initialized successfully');
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
