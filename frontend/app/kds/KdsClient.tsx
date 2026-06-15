'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import TicketCard, { KdsTicket, KdsItem } from '@/components/kds/TicketCard';
import { ChefHat, RefreshCw } from 'lucide-react';

interface KdsClientProps {
  initialTickets: KdsTicket[];
}

export default function KdsClient({ initialTickets }: KdsClientProps) {
  const [tickets, setTickets] = useState<KdsTicket[]>(initialTickets);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Update current time every 30s to recalculate wait times
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setTickets(prev => [...prev]); // force re-render to update wait times
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Format current time for header
  const timeString = currentTime
    ? currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  // Socket
  const token = typeof window !== 'undefined' ? (getAccessTokenFromCookie() || undefined) : undefined;
  const { socket, isConnected } = useSocket({
    room: 'kitchen',
    token,
  });

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error('Audio api error', e);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/kds/tickets`, {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.tickets) {
          setTickets(result.data.tickets);
        }
      }
    } catch (err) {
      console.error('Lỗi khi fetch lại tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewTicket = (payload: any) => {
      playBeep();
      
      const now = new Date().getTime();
      const newItems: KdsItem[] = payload.items.map((item: any) => {
        const itemCreatedAt = new Date(payload.createdAt).getTime();
        return {
          orderItemId: item.orderItemId,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          menuItemImage: null, // Socket payload doesn't send image
          qty: item.qty,
          note: item.note || '',
          status: item.status,
          isSoldOut: item.isSoldOut || false,
          waitMinutes: Math.floor((now - itemCreatedAt) / 60000),
          createdAt: payload.createdAt
        };
      });

      const newTicket: KdsTicket = {
        sessionId: payload.sessionId,
        tableNumber: payload.tableNumber || 0,
        tableLabel: 'Bàn ' + (payload.tableNumber || ''),
        items: newItems
      };

      setTickets(prev => {
        const existingIndex = prev.findIndex(t => t.sessionId === payload.sessionId);
        if (existingIndex >= 0) {
          // Merge items
          const updatedTickets = [...prev];
          updatedTickets[existingIndex] = {
            ...updatedTickets[existingIndex],
            items: [...updatedTickets[existingIndex].items, ...newItems]
          };
          return updatedTickets;
        } else {
          return [newTicket, ...prev];
        }
      });
    };

    const handleItemUpdated = (payload: any) => {
      // Nếu là sự kiện hết món realtime sync giữa các màn KDS
      if (payload.type === 'soldout') {
        setTickets(prev => {
          return prev.map(ticket => {
            const updatedItems = ticket.items.map(item => {
              if (item.menuItemId === payload.menuItemId) {
                return { ...item, isSoldOut: payload.isSoldOut };
              }
              return item;
            });
            return { ...ticket, items: updatedItems };
          });
        });
        return;
      }

      setTickets(prev => {
        return prev.map(ticket => {
          const itemIndex = ticket.items.findIndex(i => i.orderItemId === payload.orderItemId);
          if (itemIndex >= 0) {
            const newItems = [...ticket.items];
            newItems[itemIndex] = { ...newItems[itemIndex], status: payload.status };
            return { ...ticket, items: newItems };
          }
          return ticket;
        });
      });
    };

    // Fallback: Reload if socket disconnects for > 10s
    const handleDisconnect = () => {
      setTimeout(() => {
        if (!socket.connected) {
          fetchTickets();
        }
      }, 10000);
    };

    socket.on('kitchen:new-ticket', handleNewTicket);
    socket.on('kitchen:item-updated', handleItemUpdated);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('kitchen:new-ticket', handleNewTicket);
      socket.off('kitchen:item-updated', handleItemUpdated);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Clean up completely DONE tickets periodically
  useEffect(() => {
    const allDoneTickets = tickets.filter(t => t.items.length > 0 && t.items.every(i => i.status === 'DONE'));
    if (allDoneTickets.length > 0) {
      const timer = setTimeout(() => {
        setTickets(prev => prev.filter(t => !t.items.every(i => i.status === 'DONE')));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tickets]);

  // API Call to update status
  const handleStatusChange = async (orderItemId: string, status: 'PREPARING' | 'DONE') => {
    const accessToken = getAccessTokenFromCookie();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    const res = await fetch(`${API_URL}/api/kds/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`,
      },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      throw new Error('Lỗi khi cập nhật trạng thái');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-900/30">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">KDS Bếp</h1>
          <div className="ml-4 bg-gray-800 px-3 py-1 rounded-full text-sm font-semibold border border-gray-700 shadow-inner">
            Đang chờ: <span className="text-emerald-400">{tickets.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Socket Status */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-500 bg-red-950/30 px-2 py-1 rounded-full border border-red-900">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Mất kết nối
              </span>
            )}
          </div>

          <div className="text-xl font-mono font-bold tracking-wider text-gray-300">
            {timeString}
          </div>

          <button 
            onClick={fetchTickets}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 to-gray-950">
        {tickets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-60">
            <ChefHat className="h-24 w-24 text-gray-700 mb-6 drop-shadow-lg" />
            <h2 className="text-3xl font-bold text-gray-300">Bếp rảnh rỗi 🎉</h2>
            <p className="text-gray-500 mt-3 font-medium text-lg">Không có order nào cần xử lý lúc này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 auto-rows-max overflow-y-auto pr-2 pb-10 custom-scrollbar">
            {tickets.map(ticket => (
              <TicketCard 
                key={ticket.sessionId} 
                ticket={ticket} 
                onStatusChange={handleStatusChange} 
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
