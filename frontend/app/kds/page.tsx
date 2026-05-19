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
  Layers,
  Archive,
  RotateCcw
} from "lucide-react";

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

const INITIAL_ORDERS: KDSOther[] = [
  {
    id: "o1",
    orderNo: "ORD-3829",
    tableNo: "Bàn số 05",
    items: [
      { name: "Classic Beef Burger", quantity: 2 },
      { name: "Fresh Strawberry Soda", quantity: 2 },
      { name: "Molten Lava Chocolate Cake", quantity: 1 }
    ],
    status: "pending",
    createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 mins ago
    elapsedSeconds: 180
  },
  {
    id: "o2",
    orderNo: "ORD-8472",
    tableNo: "Bàn số 12",
    items: [
      { name: "Smoked Bacon Pizza", quantity: 1 },
      { name: "Matcha Latte Ice Blended", quantity: 1 }
    ],
    status: "preparing",
    createdAt: new Date(Date.now() - 9 * 60 * 1000), // 9 mins ago
    elapsedSeconds: 540
  },
  {
    id: "o3",
    orderNo: "ORD-1193",
    tableNo: "Mang về #01",
    items: [
      { name: "Premium Crispy Chicken", quantity: 1 },
      { name: "Iced Caramel Macchiato", quantity: 1 }
    ],
    status: "ready",
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    elapsedSeconds: 900
  },
  {
    id: "o4",
    orderNo: "ORD-5742",
    tableNo: "Bàn số 08",
    items: [
      { name: "Fresh Caesar Salad", quantity: 1 },
      { name: "Matcha Tiramisu Cup", quantity: 2 }
    ],
    status: "pending",
    createdAt: new Date(Date.now() - 11 * 60 * 1000), // 11 mins ago (Urgent!)
    elapsedSeconds: 660
  }
];

export default function KDSPage() {
  const [orders, setOrders] = useState<KDSOther[]>(INITIAL_ORDERS);

  // Simulate active timers updating every second
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

  const advanceStatus = (id: string, currentStatus: "pending" | "preparing" | "ready") => {
    setOrders(prev => {
      return prev.map(order => {
        if (order.id === id) {
          if (currentStatus === "pending") return { ...order, status: "preparing" };
          if (currentStatus === "preparing") return { ...order, status: "ready" };
        }
        return order;
      });
    });
  };

  const completeOrder = (id: string) => {
    setOrders(prev => prev.filter(order => order.id !== id));
  };

  const resetDemo = () => {
    setOrders(INITIAL_ORDERS.map(o => ({
      ...o,
      createdAt: new Date(Date.now() - (o.id === "o1" ? 3 : o.id === "o2" ? 9 : o.id === "o3" ? 15 : 11) * 60 * 1000),
      elapsedSeconds: (o.id === "o1" ? 180 : o.id === "o2" ? 540 : o.id === "o3" ? 900 : 660)
    })));
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
              onClick={resetDemo}
              className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-zinc-300 font-medium transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo
            </button>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
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

      </div>
    </div>
  );
}
