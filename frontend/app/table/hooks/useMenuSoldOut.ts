import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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
  socketUrl?: string;
  onItemSoldOut?: (payload: SoldOutEvent) => void;
}

interface UseMenuSoldOutReturn<T extends MenuItemSoldOutState> {
  items: T[];
  isConnected: boolean;
}

export function useMenuSoldOut<T extends MenuItemSoldOutState>(
  initialItems: T[],
  options: UseMenuSoldOutOptions = {}
): UseMenuSoldOutReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const socketUrl =
    options.socketUrl ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:5000';

  const callbackRef = useRef(options.onItemSoldOut);
  useEffect(() => {
    callbackRef.current = options.onItemSoldOut;
  }, [options.onItemSoldOut]);

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[useMenuSoldOut] Đã kết nối Socket.io:', socket.id);
      
      // Determine tenantId from first item
      const tenantId = initialItems.length > 0 ? (initialItems[0] as any).tenantId : null;
      if (tenantId) {
        socket.emit('join-room', { room: `tenant:${tenantId}:menu-updates` });
      } else {
        console.warn('[useMenuSoldOut] Không tìm thấy tenantId, không thể join room');
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.warn('[useMenuSoldOut] Mất kết nối Socket.io:', reason);
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      console.warn('[useMenuSoldOut] Lỗi kết nối Socket.io (sẽ tự retry):', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[useMenuSoldOut] Reconnect thành công sau ${attemptNumber} lần thử`);
    });

    socket.on('reconnect_failed', () => {
      console.error('[useMenuSoldOut] Reconnect thất bại sau tối đa số lần thử.');
    });

    socket.on('menu:soldout', ({ menuItemId, isSoldOut }: SoldOutEvent) => {
      console.log(`[useMenuSoldOut] Nhận event "menu:soldout": item ${menuItemId} → isSoldOut=${isSoldOut}`);
      setItems((prev) => prev.map((item) => item.id === menuItemId ? { ...item, isSoldOut } : item));
      if (callbackRef.current) {
        callbackRef.current({ menuItemId, isSoldOut });
      }
    });

    socket.connect();

    return () => {
      if (socket.connected) {
        const tenantId = initialItems.length > 0 ? (initialItems[0] as any).tenantId : null;
        if (tenantId) {
          socket.emit('leave-room', { room: `tenant:${tenantId}:menu-updates` });
        }
      }
      socket.disconnect();
      socketRef.current = null;
      console.log('[useMenuSoldOut] Đã cleanup Socket.io connection');
    };
  }, [socketUrl]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return { items, isConnected };
}
