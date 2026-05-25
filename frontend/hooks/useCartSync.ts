'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useCartStore } from '@/stores/cart.store';

export function useCartSync(
  sessionId: string | null,
  tableId: string | null,
  onToast?: (message: string) => void,
  onSessionClosed?: () => void
) {
  const syncCartFromServer = useCartStore((s) => s.syncCartFromServer);
  
  // Dùng ref để theo dõi thời điểm thiết bị này gửi request
  // Tránh hiển thị toast thông báo cho chính người click.
  const lastActivityRef = useRef<number>(0);

  // Kết nối và tự động join room bàn "table:[tableId]"
  const { socket, isConnected } = useSocket({
    room: `table:${tableId || ''}`,
    autoConnect: !!tableId && !!sessionId,
  });

  useEffect(() => {
    if (!socket || !isConnected || !sessionId || !tableId) return;

    // Lắng nghe sự kiện giỏ hàng được cập nhật realtime
    const handleCartUpdated = (event: { sessionId: string; orderItems: any[]; total: number }) => {
      if (event.sessionId === sessionId) {
        syncCartFromServer(event.orderItems);

        // Chỉ hiển thị toast nếu sự thay đổi đến từ thiết bị khác
        // (Thời gian activity lệch quá 2 giây)
        const now = Date.now();
        if (now - lastActivityRef.current > 2000) {
          onToast?.('🛒 Giỏ hàng chung của bàn vừa được thiết bị khác cập nhật!');
        }
      }
    };

    const handleSessionClosed = (event: { sessionId: string }) => {
      if (event.sessionId === sessionId) {
        onSessionClosed?.();
      }
    };

    socket.on('cart:updated', handleCartUpdated);
    socket.on('session:closed', handleSessionClosed);

    return () => {
      socket.off('cart:updated', handleCartUpdated);
      socket.off('session:closed', handleSessionClosed);
    };
  }, [socket, isConnected, sessionId, tableId, syncCartFromServer, onToast, onSessionClosed]);

  return {
    registerActivity: () => {
      lastActivityRef.current = Date.now();
    },
  };
}
