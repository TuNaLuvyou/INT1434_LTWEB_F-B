import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Type nhỏ gọn, chỉ cần các trường mà hook quan tâm.
// Index signature [key: string]: unknown cho phép subtype (MenuItemForDisplay)
// với các property cụ thể vẫn satisfy generic constraint T extends MenuItemSoldOutState.
export interface MenuItemSoldOutState {
  id: string;
  isSoldOut: boolean;
  [key: string]: unknown;
}

interface SoldOutEvent {
  menuItemId: string;
  isSoldOut: boolean;
}

interface UseMenuSoldOutOptions {
  /** URL của backend Socket.io server. Mặc định lấy từ env NEXT_PUBLIC_API_URL */
  socketUrl?: string;
}

interface UseMenuSoldOutReturn<T extends MenuItemSoldOutState> {
  items: T[];
  /** true khi đang kết nối, false khi mất kết nối hoặc đang retry */
  isConnected: boolean;
}

/**
 * Hook `useMenuSoldOut` — Sync trạng thái hết món realtime qua Socket.io
 *
 * ─── Luồng hoạt động ────────────────────────────────────────────────────────
 *
 * 1. Page /menu/[tableId] là Server Component (SSG/ISR), render HTML tĩnh.
 *    → SSG đảm bảo load siêu nhanh, SEO tốt, không bắt user chờ.
 *
 * 2. MenuItemList là Client Component, nhận initialItems từ SSG props.
 *    → Hook này dùng initialItems làm state ban đầu.
 *
 * 3. Khi mount: kết nối Socket.io và join room "menu-updates".
 *    → Lắng nghe event "menu:soldout" từ backend.
 *    → Khi nhận event: tìm item theo menuItemId, update isSoldOut trong state.
 *    → React re-render chỉ item bị thay đổi → UI phản ánh ngay lập tức.
 *
 * 4. Khi unmount: leave room và disconnect → tránh memory leak.
 *
 * ─── Xử lý mất kết nối ─────────────────────────────────────────────────────
 *
 * Socket.io client tự động retry (exponential backoff) khi mất kết nối.
 * reconnectionAttempts: 10 → thử tối đa 10 lần (khoảng 1-60 giây mỗi lần).
 * reconnectionDelay / reconnectionDelayMax: cấu hình thời gian chờ giữa các lần.
 * → Không crash page, chỉ isConnected = false cho đến khi reconnect thành công.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
export function useMenuSoldOut<T extends MenuItemSoldOutState>(
  initialItems: T[],
  options: UseMenuSoldOutOptions = {}
): UseMenuSoldOutReturn<T> {
  // State items được khởi tạo từ SSG props — realtime updates patch vào đây
  const [items, setItems] = useState<T[]>(initialItems);
  const [isConnected, setIsConnected] = useState(false);

  // Ref để tránh re-create socket khi re-render
  const socketRef = useRef<Socket | null>(null);

  const socketUrl =
    options.socketUrl ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:5000';

  useEffect(() => {
    // Khởi tạo Socket.io client với cấu hình retry tự động
    const socket = io(socketUrl, {
      // Ép sử dụng WebSocket trực tiếp để bypass hoàn toàn HTTP polling
      // Tránh triệt để lỗi "xhr poll error" do CORS hoặc proxy chặn HTTP polling
      transports: ['websocket'],
      // Không kết nối ngay lập tức, gọi socket.connect() sau khi setup listeners
      autoConnect: false,
      // Cấu hình reconnection (tự retry khi mất kết nối)
      reconnection: true,
      reconnectionAttempts: 10, // Thử tối đa 10 lần trước khi bỏ cuộc
      reconnectionDelay: 1000,  // Lần đầu chờ 1 giây
      reconnectionDelayMax: 30000, // Tối đa chờ 30 giây giữa các lần retry
      // Randomize delay để tránh nhiều client reconnect cùng lúc (thundering herd)
      randomizationFactor: 0.5,
      // Timeout khi chờ kết nối ban đầu
      timeout: 20000,
    });

    socketRef.current = socket;

    // ── Event listeners ──────────────────────────────────────────────────────

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[useMenuSoldOut] Đã kết nối Socket.io:', socket.id);
      // Join room "menu-updates" ngay sau khi kết nối (hoặc reconnect)
      socket.emit('join:menu-updates');
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.warn('[useMenuSoldOut] Mất kết nối Socket.io:', reason);
      // Nếu server chủ động ngắt (không phải client), Socket.io sẽ tự retry
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      console.warn('[useMenuSoldOut] Lỗi kết nối Socket.io (sẽ tự retry):', error.message);
      // KHÔNG throw error → không crash page, hook vẫn hoạt động với data SSG ban đầu
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[useMenuSoldOut] Reconnect thành công sau ${attemptNumber} lần thử`);
      // 'connect' event sẽ được gọi lại → tự động join room lại
    });

    socket.on('reconnect_failed', () => {
      console.error('[useMenuSoldOut] Reconnect thất bại sau tối đa số lần thử. Page vẫn hiển thị data SSG ban đầu.');
      // Vẫn không crash page — user thấy data SSG, chỉ không có realtime updates
    });

    // ── Lắng nghe event hết món từ server ────────────────────────────────────
    socket.on('menu:soldout', ({ menuItemId, isSoldOut }: SoldOutEvent) => {
      console.log(`[useMenuSoldOut] Nhận event "menu:soldout": item ${menuItemId} → isSoldOut=${isSoldOut}`);
      
      // Immutable update: chỉ thay đổi item cần update, giữ nguyên reference các item khác
      setItems((prev) =>
        prev.map((item) =>
          item.id === menuItemId
            ? { ...item, isSoldOut }
            : item
        )
      );
    });

    // Bắt đầu kết nối
    socket.connect();

    // ── Cleanup khi unmount ───────────────────────────────────────────────────
    return () => {
      if (socket.connected) {
        // Leave room trước khi disconnect để server biết client đã rời
        socket.emit('leave:menu-updates');
      }
      socket.disconnect();
      socketRef.current = null;
      console.log('[useMenuSoldOut] Đã cleanup Socket.io connection');
    };
  }, [socketUrl]); // Chỉ re-run nếu socketUrl thay đổi

  // Sync initialItems nếu SSG props thay đổi (ví dụ navigation)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return { items, isConnected };
}
