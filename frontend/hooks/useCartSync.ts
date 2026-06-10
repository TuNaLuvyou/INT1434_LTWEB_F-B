'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useCartStore } from '@/stores/cart.store';

export function useCartSync(
  sessionId: string | null,
  tableId: string | null,
  onToast?: (message: string) => void,
  onSessionClosed?: (event: { sessionId: string; status?: string }) => void,
  onOrderStatusChanged?: (event: { orderItemId: string; status: any; menuItemName?: string; updatedAt: string }) => void
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
    const handleCartUpdated = (event: { sessionId: string; orderItems: any[]; total: number; isLocked?: boolean; message?: string }) => {
      if (event.sessionId === sessionId) {
        if (event.isLocked) {
          useCartStore.setState({ isLocked: true });
          onToast?.(event.message || 'Order đang được chuẩn bị bởi nhà hàng — không thể thay đổi món.');
          return;
        }

        syncCartFromServer(event.orderItems);

        // Chỉ hiển thị toast nếu sự thay đổi đến từ thiết bị khác
        // (Thời gian activity lệch quá 2 giây)
        const now = Date.now();
        if (now - lastActivityRef.current > 2000) {
          onToast?.('🛒 Giỏ hàng chung của bàn vừa được thiết bị khác cập nhật!');
        }
      }
    };

    const handleSessionClosed = (event: { sessionId: string; status?: string }) => {
      if (event.sessionId === sessionId) {
        onSessionClosed?.(event);
      }
    };

    const handleOrderStatusChanged = (event: { orderItemId: string; sessionId: string; status: any; menuItemName?: string; updatedAt: string }) => {
      if (event.sessionId === sessionId) {
        // Thông báo toast cho khách khi món bị void bởi nhà hàng
        if (event.status === 'VOID' && event.menuItemName) {
          onToast?.(`❌ Món "${event.menuItemName}" đã bị huỷ do hết món.`);
        }
        onOrderStatusChanged?.(event);
      }
    };

    socket.on('cart:updated', handleCartUpdated);
    socket.on('session:closed', handleSessionClosed);
    socket.on('order:status-changed', handleOrderStatusChanged);

    return () => {
      socket.off('cart:updated', handleCartUpdated);
      socket.off('session:closed', handleSessionClosed);
      socket.off('order:status-changed', handleOrderStatusChanged);
    };
  }, [socket, isConnected, sessionId, tableId, syncCartFromServer, onToast, onSessionClosed, onOrderStatusChanged]);

  return {
    registerActivity: () => {
      lastActivityRef.current = Date.now();
    },
  };
}
