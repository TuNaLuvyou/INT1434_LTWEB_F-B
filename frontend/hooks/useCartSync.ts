'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useCartStore } from '@/stores/cart.store';

export function useCartSync(
  sessionId: string | null,
  tableId: string | null,
  onToast?: (message: string) => void,
  onSessionClosed?: (event: { sessionId: string; status?: string }) => void,
  onOrderStatusChanged?: (event: { orderItemId: string; status: any; menuItemName?: string; updatedAt: string }) => void,
  onCartUpdated?: (event: { sessionId: string; orderItems: any[]; total: number; isLocked?: boolean; message?: string }) => void,
  onPaymentPending?: (event: { sessionId: string; paymentId: string; qrUrl: string; total: number; paymentCode: string; bankName?: string; accountNumber?: string; accountName?: string }) => void,
  onPaymentCompleted?: (event: { sessionId: string; paymentId: string; total: number; paidAt: string }) => void
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
        onCartUpdated?.(event);
        if (event.isLocked) {
          useCartStore.setState({ isLocked: true });
          onToast?.(event.message || 'Order đang được chuẩn bị bởi nhà hàng — không thể thay đổi món.');
          // Cập nhật lastOrder với trạng thái PREPARING từ event
          if (event.orderItems) {
            const currentLastOrder = useCartStore.getState().lastOrder;
            if (currentLastOrder) {
              const updatedLastOrder = currentLastOrder.map(item => {
                const serverItem = event.orderItems.find((si: any) => si.menuItemId === item.menuItemId);
                return serverItem ? { ...item, status: serverItem.status } : item;
              });
              useCartStore.setState({ lastOrder: updatedLastOrder });
            }
          }
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

    const handlePaymentPending = (event: { sessionId: string; paymentId: string; qrUrl: string; total: number; paymentCode: string; bankName?: string; accountNumber?: string; accountName?: string }) => {
      if (event.sessionId === sessionId) {
        onPaymentPending?.(event);
      }
    };

    const handlePaymentCompleted = (event: { sessionId: string; paymentId: string; total: number; paidAt: string }) => {
      if (event.sessionId === sessionId) {
        onPaymentCompleted?.(event);
      }
    };

    socket.on('cart:updated', handleCartUpdated);
    socket.on('session:closed', handleSessionClosed);
    socket.on('order:status-changed', handleOrderStatusChanged);
    socket.on('payment:pending', handlePaymentPending);
    socket.on('payment:completed', handlePaymentCompleted);

    return () => {
      socket.off('cart:updated', handleCartUpdated);
      socket.off('session:closed', handleSessionClosed);
      socket.off('order:status-changed', handleOrderStatusChanged);
      socket.off('payment:pending', handlePaymentPending);
      socket.off('payment:completed', handlePaymentCompleted);
    };
  }, [socket, isConnected, sessionId, tableId, syncCartFromServer, onToast, onSessionClosed, onOrderStatusChanged, onCartUpdated, onPaymentPending, onPaymentCompleted]);

  return {
    registerActivity: () => {
      lastActivityRef.current = Date.now();
    },
  };
}
