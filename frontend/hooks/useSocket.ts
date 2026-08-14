/**
 * useSocket.ts — Generic React hook để kết nối Socket.io và join room
 *
 * ─── Cách dùng ─────────────────────────────────────────────────────────────
 *
 * // Public room (không cần token):
 * const { socket, isConnected } = useSocket({ room: `table:${tableId}` });
 *
 * // Auth room (cần token):
 * const { socket, isConnected } = useSocket({
 *   room: 'kitchen',
 *   token: accessToken,
 * });
 *
 * // Lắng nghe event trong component:
 * useEffect(() => {
 *   if (!socket || !isConnected) return;
 *   socket.on('cart:updated', handleCartUpdate);
 *   return () => { socket.off('cart:updated', handleCartUpdate); };
 * }, [socket, isConnected]);
 *
 * ─── Luồng lifecycle ────────────────────────────────────────────────────────
 * mount        → getSocket() → socket.connect() → 'connect' event
 * connected    → emit 'join-room' → server confirm 'room-joined'
 * reconnect    → 'connect' event lại → re-join room tự động
 * unmount      → emit 'leave-room' → socket.disconnect()
 * ────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket/socket-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSocketOptions {
  /** Room cần join sau khi kết nối. Ví dụ: "table:abc123", "kitchen" */
  room: string;
  /** JWT token — bắt buộc với các protected rooms (kitchen, cashier, floor-plan) */
  token?: string;
  /** Callback khi join room thành công */
  onRoomJoined?: (room: string) => void;
  /** Callback khi join room thất bại (sai token, sai role...) */
  onRoomError?: (room: string, message: string) => void;
  /** Có tự động kết nối khi mount không? Mặc định true */
  autoConnect?: boolean;
}

export interface UseSocketReturn {
  /** Socket instance — dùng để listen/emit events */
  socket: Socket | null;
  /** true khi socket đang kết nối VÀ đã join room thành công */
  isConnected: boolean;
  /** true khi socket đã join room thành công */
  isInRoom: boolean;
  /** Trạng thái kết nối chi tiết hơn */
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Hàm connect thủ công (dùng khi autoConnect: false) */
  connect: () => void;
  /** Hàm disconnect thủ công */
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket({
  room,
  token,
  onRoomJoined,
  onRoomError,
  autoConnect = true,
}: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [connectionState, setConnectionState] = useState<UseSocketReturn['connectionState']>('disconnected');

  // Ref để giữ socket instance không trigger re-render
  const socketRef = useRef<Socket | null>(null);
  // Ref để tránh stale closure trong event handlers
  const roomRef = useRef(room);
  const tokenRef = useRef(token);

  // Cập nhật refs khi props thay đổi
  useEffect(() => { 
    const oldRoom = roomRef.current;
    
    if (oldRoom !== room) {
      roomRef.current = room;
      const socket = socketRef.current;
      
      if (socket && socket.connected) {
        if (oldRoom && oldRoom !== 'table:' && oldRoom !== 'table:null' && oldRoom !== 'table:undefined') {
          socket.emit('leave-room', { room: oldRoom });
        }
        setIsInRoom(false);
        if (room && room !== 'table:' && room !== 'table:null' && room !== 'table:undefined') {
          socket.emit('join-room', { room, token: tokenRef.current });
        }
      }
    }
  }, [room]);
  
  useEffect(() => { 
    const oldToken = tokenRef.current;
    if (oldToken !== token) {
      tokenRef.current = token; 
      const socket = socketRef.current;
      const currentRoom = roomRef.current;
      if (socket && socket.connected && currentRoom && currentRoom !== 'table:' && currentRoom !== 'table:null' && currentRoom !== 'table:undefined') {
        socket.emit('join-room', { room: currentRoom, token: tokenRef.current });
      }
    }
  }, [token]);

  /**
   * Join room sau khi kết nối — gọi lại sau mỗi lần reconnect
   */
  const joinRoom = useCallback((socket: Socket) => {
    const r = roomRef.current;
    if (!r || r === 'table:' || r === 'table:null' || r === 'table:undefined') {
      return;
    }
    socket.emit('join-room', {
      room: r,
      token: tokenRef.current,
    });
  }, []);

  const connect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) {
      setConnectionState('connecting');
      socket.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (socket.connected) {
      socket.emit('leave-room', { room: roomRef.current });
    }
    socket.disconnect();
    setIsInRoom(false);
    setIsConnected(false);
    setConnectionState('disconnected');
  }, []);

  // Ref lưu handlers để dùng trong socket listener mà không cần đưa vào dependency
  const handlersRef = useRef({ onRoomJoined, onRoomError });
  useEffect(() => {
    handlersRef.current = { onRoomJoined, onRoomError };
  }, [onRoomJoined, onRoomError]);

  useEffect(() => {
    // Lấy singleton socket (chưa kết nối)
    const socket = getSocket();
    socketRef.current = socket;

    // ── Event listeners ───────────────────────────────────────────────────────

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionState('connected');
      // Re-join room mỗi lần connect/reconnect
      joinRoom(socket);
    };

    const handleDisconnect = (reason: string) => {
      setIsConnected(false);
      setIsInRoom(false);
      setConnectionState('disconnected');
    };

    const handleConnectError = (err: Error) => {
      setConnectionState('error');
    };

    const handleReconnect = (attempt: number) => {
      // 'connect' event sẽ fire sau → tự join room lại
    };

    const handleRoomJoined = ({ room: joinedRoom }: { room: string }) => {
      if (joinedRoom === roomRef.current) {
        setIsInRoom(true);
        handlersRef.current.onRoomJoined?.(joinedRoom);
      }
    };

    const handleRoomError = ({ room: errorRoom, message }: { room: string; message: string }) => {
      if (errorRoom === roomRef.current) {
        setIsInRoom(false);
        setConnectionState('error');
        handlersRef.current.onRoomError?.(errorRoom, message);
      }
    };

    // Đăng ký listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('room-joined', handleRoomJoined);
    socket.on('room-error', handleRoomError);

    // Nếu socket đang connected rồi (singleton dùng chung), join room ngay
    if (socket.connected) {
      setIsConnected(true);
      setConnectionState('connected');
      joinRoom(socket);
    } else if (autoConnect) {
      setConnectionState('connecting');
      socket.connect();
    }

    // ── Cleanup khi unmount ───────────────────────────────────────────────────
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('room-joined', handleRoomJoined);
      socket.off('room-error', handleRoomError);

      // Leave room khi unmount (sử dụng snapshot của room hiện tại để rời đúng phòng)
      const currentRoomToLeave = roomRef.current;
      if (socket.connected && currentRoomToLeave && currentRoomToLeave !== 'table:' && currentRoomToLeave !== 'table:null') {
        socket.emit('leave-room', { room: currentRoomToLeave });
      }

      setIsInRoom(false);
      // Không disconnect socket singleton — các component khác đang dùng chung
    };
  }, []); // <-- BỎ dependency array để không bị tear down / setup lại mỗi khi đổi room!

  return {
    socket: socketRef.current,
    isConnected,
    isInRoom,
    connectionState,
    connect,
    disconnect,
  };
}
