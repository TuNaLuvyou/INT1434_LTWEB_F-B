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
      
      const tenantId = initialItems.length > 0 ? (initialItems[0] as any).tenantId : null;
      if (tenantId) {
        socket.emit('join-room', { room: `tenant:${tenantId}:menu-updates` });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    socket.on('menu:soldout', ({ menuItemId, isSoldOut }: SoldOutEvent) => {
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
    };
  }, [socketUrl]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return { items, isConnected };
}
