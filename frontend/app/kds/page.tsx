"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ChefHat, 
  Clock, 
  Play, 
  Check, 
  Flame, 
  AlertTriangle, 
  Activity,
  Archive,
  RotateCcw,
  X,
  Search,
  Loader2
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

interface KDSItem {
  name: string;
  quantity: number;
}

interface KDSOther {
  id: string;
  orderNo: string;
  tableNo: string;
  items: KDSItem[];
  status: "pending" | "preparing" | "ready";
  createdAt: Date;
  elapsedSeconds: number; // calculated simulated elapsed time
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isSoldOut: boolean;
  category?: {
    name: string;
  };
}

export default function KDSPage() {
  const [orders, setOrders] = useState<KDSOther[]>([]);
  const [rawSessions, setRawSessions] = useState<any[]>([]);

  // State quản lý Báo hết món
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMenuItems = async () => {
    setMenuLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`${API_URL}/api/menu`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setCategories(result.data.categories || []);
        setMenuItems(result.data.items || []);
      } else {
        throw new Error(result.message || "Không thể tải danh sách món ăn");
      }
    } catch (err: any) {
      console.error("[KDS Menu] Lỗi tải thực đơn:", err);
      setFetchError(err.message || "Không thể kết nối đến máy chủ.");
    } finally {
      setMenuLoading(false);
    }
  };

  const fetchKdsOrders = async () => {
    try {
      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(`${API_URL}/api/kds/orders`, {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setRawSessions(result.data || []);
      }
    } catch (err) {
      console.error("[KDS] Lỗi tải đơn hàng:", err);
    }
  };

  const handleToggleSoldOut = async (itemId: string, currentSoldOut: boolean) => {
    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));
    try {
      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(`${API_URL}/api/admin/menu-items/${itemId}/sold-out`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({ isSoldOut: !currentSoldOut }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Cập nhật trạng thái món thất bại");
      }
      
      setMenuItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, isSoldOut: !currentSoldOut } : item
        )
      );
    } catch (err: any) {
      alert(err.message || "Đã xảy ra lỗi");
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  // Socket setup for Kitchen and Menu updates
  const token = typeof window !== 'undefined' ? (getAccessTokenFromCookie() || undefined) : undefined;
  
  const { socket: kitchenSocket, isConnected: isKitchenConnected } = useSocket({
    room: 'kitchen',
    token,
  });

  const { socket: menuSocket, isConnected: isMenuConnected } = useSocket({
    room: 'menu-updates',
  });

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      
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

  // Listen to menu soldout
  useEffect(() => {
    if (!menuSocket || !isMenuConnected) return;

    menuSocket.on('menu:soldout', ({ menuItemId, isSoldOut }: { menuItemId: string; isSoldOut: boolean }) => {
      console.log(`[KDS Socket] Nhận event "menu:soldout": item ${menuItemId} -> isSoldOut=${isSoldOut}`);
      setMenuItems(prev =>
        prev.map(item =>
          item.id === menuItemId ? { ...item, isSoldOut } : item
        )
      );
    });

    return () => {
      menuSocket.off('menu:soldout');
    };
  }, [menuSocket, isMenuConnected]);

  // Listen to new kitchen orders or ticket status updates
  useEffect(() => {
    fetchKdsOrders();
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (!kitchenSocket || !isKitchenConnected) return;

    const handleUpdate = () => {
      console.log('[KDS Socket] Nhận được thay đổi đơn hàng từ socket, cập nhật...');
      playBeep();
      fetchKdsOrders();
    };

    kitchenSocket.on('kitchen:new-ticket', handleUpdate);
    kitchenSocket.on('kitchen:item-updated', handleUpdate);

    return () => {
      kitchenSocket.off('kitchen:new-ticket', handleUpdate);
      kitchenSocket.off('kitchen:item-updated', handleUpdate);
    };
  }, [kitchenSocket, isKitchenConnected]);

  // Filtered menu items
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "" || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Map rawSessions to orders (filtering out archived items)
  useEffect(() => {
    const archivedIdsStr = typeof window !== 'undefined' ? (localStorage.getItem("kds_archived_item_ids") || "[]") : "[]";
    const archivedItemIds: string[] = JSON.parse(archivedIdsStr);

    const mappedOrders: KDSOther[] = rawSessions.map(session => {
      // Lọc các items chưa được lưu trữ
      const activeItems = session.orderItems.filter((oi: any) => !archivedItemIds.includes(oi.id));
      if (activeItems.length === 0) return null;

      const items = activeItems.map((oi: any) => ({
        name: oi.menuItem.name,
        quantity: oi.qty
      }));

      // Xác định trạng thái chung của ticket dựa trên các items
      let status: "pending" | "preparing" | "ready" = "pending";
      const hasPending = activeItems.some((item: any) => item.status === "PENDING");
      const hasPreparing = activeItems.some((item: any) => item.status === "PREPARING");
      const allDone = activeItems.every((item: any) => item.status === "DONE" || item.status === "VOID");
      
      if (allDone) {
        status = "ready";
      } else if (hasPreparing) {
        status = "preparing";
      } else {
        status = "pending";
      }

      const openedTime = new Date(session.openedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - openedTime) / 1000));

      return {
        id: session.id,
        orderNo: `ORD-${session.id.substring(0, 4).toUpperCase()}`,
        tableNo: session.table?.label || `Bàn ${session.table?.tableNumber || ""}`,
        items,
        status,
        createdAt: new Date(session.openedAt),
        elapsedSeconds
      };
    }).filter(Boolean) as KDSOther[];

    setOrders(mappedOrders);
  }, [rawSessions]);

  // Timers updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setOrders(prev => 
        prev.map(order => ({
          ...order,
          elapsedSeconds: order.elapsedSeconds + 1
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const advanceStatus = async (sessionId: string, currentStatus: "pending" | "preparing" | "ready") => {
    if (currentStatus === "ready") return;
    
    const newStatus = currentStatus === "pending" ? "PREPARING" : "DONE";
    try {
      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(`${API_URL}/api/kds/orders/${sessionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({ currentStatus, newStatus }),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        fetchKdsOrders();
      } else {
        alert(result.message || "Không thể cập nhật trạng thái");
      }
    } catch (err: any) {
      console.error("[KDS] Lỗi cập nhật trạng thái:", err);
      alert("Đã xảy ra lỗi khi cập nhật trạng thái");
    }
  };

  const completeOrder = (sessionId: string) => {
    const session = rawSessions.find(s => s.id === sessionId);
    if (session) {
      const itemIdsToArchive = session.orderItems.map((oi: any) => oi.id);
      const existingStr = typeof window !== 'undefined' ? (localStorage.getItem("kds_archived_item_ids") || "[]") : "[]";
      const existingArchived = JSON.parse(existingStr);
      const updatedArchived = [...existingArchived, ...itemIdsToArchive];
      if (typeof window !== 'undefined') {
        localStorage.setItem("kds_archived_item_ids", JSON.stringify(updatedArchived));
      }
      
      // Update local state instantly
      setOrders(prev => prev.filter(order => order.id !== sessionId));
    }
  };

  const resetDemo = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("kds_archived_item_ids");
    }
    fetchKdsOrders();
  };

  const formatTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const getUrgencyColor = (seconds: number, status: string) => {
    if (status === "ready") return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    if (seconds > 600) return "text-rose-400 border-rose-500/20 bg-rose-500/5 animate-pulse"; // > 10m
    if (seconds > 300) return "text-amber-400 border-amber-500/20 bg-amber-500/5"; // > 5m
    return "text-indigo-400 border-indigo-500/20 bg-indigo-500/5";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Grid Accent */}
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Kitchen Display (KDS)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-semibold tracking-wider uppercase">Live Sync</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                fetchMenuItems();
                setIsMenuDrawerOpen(true);
              }}
              className="text-xs bg-orange-600/10 border border-orange-500/20 hover:bg-orange-600 hover:text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-orange-400 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ChefHat className="h-3.5 w-3.5 animate-pulse" />
              Báo Hết Món
            </button>
            <button 
              onClick={resetDemo}
              className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-zinc-300 font-medium transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo
            </button>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono">BẾP CHÍNH</span>
          </div>
        </div>
      </header>

      {/* Top Banner Stats */}
      <div className="max-w-7xl mx-auto w-full px-6 py-4 flex flex-wrap gap-4 items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-zinc-400">Đơn hàng chờ/nấu:</span>
            <span className="font-bold font-mono text-sm">{orders.filter(o => o.status !== "ready").length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-zinc-400">Thời gian nấu TB:</span>
            <span className="font-bold font-mono text-sm text-amber-400">11:24</span>
          </div>
        </div>
        <div className="text-xs text-zinc-500 font-light italic">
          * Đơn hàng hiển thị cảnh báo đỏ khi chờ vượt quá 10 phút.
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Column 1: PENDING */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-5 max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Hàng Chờ (Pending)</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 font-bold border border-zinc-800">
              {orders.filter(o => o.status === "pending").length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {orders.filter(o => o.status === "pending").map(order => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-all duration-300 relative group overflow-hidden"
              >
                {/* Hot Alert glow for urgent orders */}
                {order.elapsedSeconds > 600 && (
                  <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-rose-500 to-amber-500" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold ${getUrgencyColor(order.elapsedSeconds, order.status)}`}>
                      {order.elapsedSeconds > 600 ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      <span>{formatTimer(order.elapsedSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-zinc-300 font-medium">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400 font-light">{item.name}</span>
                        <span className="font-mono font-bold text-white bg-zinc-800 border border-zinc-800 px-1.5 py-0.5 rounded">
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => advanceStatus(order.id, "pending")}
                  className="w-full h-9 rounded-xl bg-orange-600/10 hover:bg-orange-600 border border-orange-500/20 text-orange-400 hover:text-white flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Bắt đầu chế biến
                </button>
              </div>
            ))}
            {orders.filter(o => o.status === "pending").length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <ChefHat className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có đơn hàng nào đang chờ nấu.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: PREPARING */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-5 max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Đang nấu (Preparing)</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-orange-400 font-bold border border-zinc-800">
              {orders.filter(o => o.status === "preparing").length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {orders.filter(o => o.status === "preparing").map(order => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold ${getUrgencyColor(order.elapsedSeconds, order.status)}`}>
                      <Flame className="h-3 w-3 text-orange-500 animate-bounce" />
                      <span>{formatTimer(order.elapsedSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-zinc-300 font-medium">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-300 font-medium">{item.name}</span>
                        <span className="font-mono font-bold text-white bg-orange-950/20 border border-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => advanceStatus(order.id, "preparing")}
                  className="w-full h-9 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Hoàn tất món ăn
                </button>
              </div>
            ))}
            {orders.filter(o => o.status === "preparing").length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <Flame className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có món ăn nào đang chế biến.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: READY */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-5 max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Sẵn Sàng (Ready)</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-emerald-400 font-bold border border-zinc-800">
              {orders.filter(o => o.status === "ready").length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {orders.filter(o => o.status === "ready").map(order => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-emerald-950/60 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-800 transition-all duration-300 relative overflow-hidden"
              >
                {/* Visual glow on edges for ready orders */}
                <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>{formatTimer(order.elapsedSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-emerald-400 font-semibold">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4 opacity-75">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400 line-through decoration-zinc-600">{item.name}</span>
                        <span className="font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => completeOrder(order.id)}
                  className="w-full h-9 rounded-xl bg-zinc-850 hover:bg-emerald-600 border border-zinc-800 hover:border-emerald-500 text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Lưu trữ & Giao món
                </button>
              </div>
            ))}
            {orders.filter(o => o.status === "ready").length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <Check className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có đơn hàng nào sẵn sàng trả khách.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sliding Drawer Báo Hết Món */}
        <div 
          className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${
            isMenuDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Backdrop */}
          <div 
            onClick={() => setIsMenuDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div 
              className={`w-screen max-w-md transform transition-transform duration-300 ease-out bg-zinc-950 border-l border-zinc-900 flex flex-col shadow-2xl relative ${
                isMenuDrawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Glow effects inside Drawer */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-orange-600/5 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-amber-600/5 blur-[80px] pointer-events-none" />

              {/* Header Drawer */}
              <div className="px-6 py-5 border-b border-zinc-900 bg-zinc-900/20 flex items-center justify-between shrink-0 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Quản lý Hết món</h3>
                    <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Bếp trưởng báo hết / còn món realtime</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuDrawerOpen(false)}
                  className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Bộ lọc & Tìm kiếm nhanh */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-950 space-y-3 shrink-0 relative z-10">
                {/* Tìm kiếm */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                  <input 
                    type="text"
                    placeholder="Tìm tên món ăn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold rounded-xl focus:outline-none focus:border-orange-500/40 transition-all text-zinc-100 placeholder-zinc-500 shadow-inner"
                  />
                </div>

                {/* Tabs Danh mục */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap border transition-all cursor-pointer ${
                      selectedCategory === ""
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Tất cả
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap border transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* List Món ăn */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 scrollbar-thin">
                {menuLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <Loader2 className="animate-spin text-orange-500 h-8 w-8 mb-3" />
                    <p className="text-xs font-semibold">Đang tải danh sách thực đơn...</p>
                  </div>
                ) : fetchError ? (
                  <div className="text-center py-10 px-4 border border-red-900/20 bg-red-950/5 rounded-2xl">
                    <p className="text-xs font-black text-red-400">Lỗi: {fetchError}</p>
                    <button 
                      onClick={fetchMenuItems}
                      className="mt-3 px-4 py-1.5 bg-red-650 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500">
                    <p className="text-xs font-light">Không tìm thấy món ăn nào.</p>
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isUpdating = !!updatingItems[item.id];
                    return (
                      <div 
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${
                          item.isSoldOut 
                            ? "bg-zinc-900/30 border-red-950/20 opacity-70"
                            : "bg-zinc-900/60 border-zinc-900/80 hover:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Image */}
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shrink-0">
                            <img 
                              src={item.imageUrl || "/placeholder-food.svg"} 
                              alt={item.name}
                              className="object-cover w-full h-full"
                            />
                            {item.isSoldOut && (
                              <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                <span className="text-[7px] font-black text-white bg-red-600 px-1 py-0.5 rounded leading-none uppercase">Hết</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div>
                            <h4 className={`text-xs font-bold text-zinc-100 line-clamp-1 ${item.isSoldOut ? "line-through text-zinc-500" : ""}`}>
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-orange-400">
                                {new Intl.NumberFormat("vi-VN", {
                                  style: "currency",
                                  currency: "VND"
                                }).format(Number(item.price))}
                              </span>
                              {item.category?.name && (
                                <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold">
                                  {item.category.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div className="flex items-center">
                          <button
                            disabled={isUpdating}
                            onClick={() => handleToggleSoldOut(item.id, item.isSoldOut)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              item.isSoldOut ? "bg-red-600" : "bg-zinc-700"
                            }`}
                          >
                            <span 
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                item.isSoldOut ? "translate-x-5" : "translate-x-0"
                              }`}
                            >
                              {isUpdating && (
                                <Loader2 className="animate-spin text-orange-500 h-3 w-3" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Drawer */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-900/10 shrink-0 text-center relative z-10">
                <span className="text-[9px] text-zinc-500 font-medium">
                  * Trạng thái hết món sẽ tự động gửi đi realtime qua WebSocket.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
