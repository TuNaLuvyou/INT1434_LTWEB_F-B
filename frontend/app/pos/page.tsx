"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  Sparkles, 
  CheckCircle,
  X,
  Loader2,
  Table as TableIcon
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  bgColor: string;
  emoji: string;
  description: string;
  imageUrl?: string | null;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const categoryGradients: Record<string, string> = {
  "mon-chinh": "from-amber-500 to-orange-600",
  "do-uong": "from-blue-500 to-indigo-600",
  "trang-mieng": "from-pink-500 to-rose-600"
};

const categoryEmojis: Record<string, string> = {
  "mon-chinh": "🍲",
  "do-uong": "🍹",
  "trang-mieng": "🍰"
};

export default function POSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [checkoutOrderNo, setCheckoutOrderNo] = useState("");

  // Live POS States
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch Menu, Categories and Tables on mount
  const fetchData = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      
      // Fetch Menu & Categories
      const menuRes = await fetch(`${API_URL}/api/menu`);
      const menuData = await menuRes.json();
      if (menuRes.ok && menuData.success) {
        setMenuItems(menuData.data.items || []);
        setCategories(menuData.data.categories || []);
      }

      // Fetch Tables
      const tablesRes = await fetch(`${API_URL}/api/tables`, {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        }
      });
      const tablesData = await tablesRes.json();
      if (tablesRes.ok && tablesData.success) {
        setTables(tablesData.data || []);
      }
    } catch (err) {
      console.error("[POS] Lỗi tải dữ liệu khởi tạo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Session details for selected table
  const fetchSessionDetails = async (sessId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessId}`);
      const result = await response.json();
      if (response.ok && result.success) {
        syncCartWithSession(result.data);
      }
    } catch (err) {
      console.error("[POS] Lỗi tải chi tiết phiên:", err);
    }
  };

  // Sync session select
  const handleTableChange = async (tableId: string) => {
    setSelectedTableId(tableId);
    if (!tableId) {
      setSessionId("");
      setCart([]);
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tableId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSessionId(result.data.session.id);
        syncCartWithSession(result.data.session);
      } else {
        alert(result.message || "Không thể khởi tạo phiên cho bàn");
      }
    } catch (err) {
      console.error("[POS] Lỗi tham gia phiên bàn:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Map session items to the client cart state
  const syncCartWithSession = (sessionData: any) => {
    if (!sessionData) {
      setCart([]);
      return;
    }
    
    // Support formats:
    // Format 1: { session: { ... }, orderItems: [...] }
    // Format 2: { id, tableId, orderItems: [...] }
    // Format 3: Array of order items directly [...]
    const items = Array.isArray(sessionData) 
      ? sessionData 
      : (sessionData.orderItems || (sessionData.session && sessionData.session.orderItems) || []);
    
    const cartItems = items.map((oi: any) => {
      const categorySlug = oi.menuItem?.category?.slug || "mon-chinh";
      return {
        item: {
          id: oi.menuItem.id,
          name: oi.menuItem.name,
          price: Number(oi.menuItem.price),
          category: oi.menuItem.categoryId,
          bgColor: categoryGradients[categorySlug] || "from-amber-500 to-orange-600",
          emoji: categoryEmojis[categorySlug] || "🍲",
          description: oi.menuItem.description || "",
          isSoldOut: oi.menuItem.isSoldOut,
          imageUrl: oi.menuItem.imageUrl
        },
        quantity: oi.qty
      };
    });
    setCart(cartItems);
  };

  // Real-time synchronization using Socket.io
  const token = typeof window !== 'undefined' ? (getAccessTokenFromCookie() || undefined) : undefined;
  
  const { socket: cashierSocket, isConnected: isCashierConnected } = useSocket({
    room: 'cashier',
    token,
  });

  const { socket: menuSocket, isConnected: isMenuConnected } = useSocket({
    room: 'menu-updates',
  });

  // Listen to menu sold-out events
  useEffect(() => {
    if (!menuSocket || !isMenuConnected) return;

    menuSocket.on('menu:soldout', ({ menuItemId, isSoldOut }: { menuItemId: string; isSoldOut: boolean }) => {
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

  // Listen to order updates or session updates
  useEffect(() => {
    if (!cashierSocket || !isCashierConnected) return;

    const handleSessionUpdate = (payload: any) => {
      if (payload.sessionId === sessionId) {
        console.log('[POS Socket] Nhận được thay đổi phiên từ khách hàng, đồng bộ lại...');
        fetchSessionDetails(sessionId);
      }
    };

    cashierSocket.on('cashier:new-order', handleSessionUpdate);
    cashierSocket.on('table:session-updated', handleSessionUpdate);

    return () => {
      cashierSocket.off('cashier:new-order', handleSessionUpdate);
      cashierSocket.off('table:session-updated', handleSessionUpdate);
    };
  }, [cashierSocket, isCashierConnected, sessionId]);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch && item.isActive;
  });

  const addToCart = async (item: any) => {
    if (item.isSoldOut) {
      alert("Món ăn này đã hết hàng!");
      return;
    }
    if (!selectedTableId || !sessionId) {
      alert("Vui lòng chọn bàn trước khi gọi món!");
      return;
    }

    const existing = cart.find(i => i.item.id === item.id);
    const newQty = existing ? existing.quantity + 1 : 1;

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          menuItemId: item.id, 
          qty: newQty,
          clientTimestamp: Date.now()
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        syncCartWithSession(result.data);
      } else {
        alert(result.message || "Lỗi khi thêm món vào giỏ hàng");
      }
    } catch (err) {
      console.error("[POS] Lỗi thêm món:", err);
    }
  };

  const updateQuantity = async (itemId: string, delta: number) => {
    if (!sessionId) return;
    const existing = cart.find(i => i.item.id === itemId);
    if (!existing) return;
    const newQty = existing.quantity + delta;

    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          menuItemId: itemId, 
          qty: newQty,
          clientTimestamp: Date.now()
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        syncCartWithSession(result.data);
      }
    } catch (err) {
      console.error("[POS] Lỗi cập nhật số lượng:", err);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/cart/${itemId}?clientTimestamp=${Date.now()}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        syncCartWithSession(result.data);
      }
    } catch (err) {
      console.error("[POS] Lỗi xóa món:", err);
    }
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  const getTax = () => getSubtotal() * 0.1;
  const getTotal = () => getSubtotal() + getTax();

  const handleCheckout = async () => {
    if (cart.length === 0 || !sessionId) return;
    setActionLoading(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({ status: 'PAID' }),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setCheckoutOrderNo(`ORD-${sessionId.substring(0, 4).toUpperCase()}`);
        setShowCheckoutSuccess(true);
        // Clean session
        setSessionId("");
        setSelectedTableId("");
        setCart([]);
        fetchData(); // reload tables
      } else {
        alert(result.message || "Không thể thực hiện thanh toán");
      }
    } catch (err) {
      console.error("[POS] Lỗi thanh toán:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">POS Cashier</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider uppercase border ${
                isCashierConnected 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 animate-pulse'
              }`}>
                {isCashierConnected ? 'Live Counter' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Table Selector Dropdown */}
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-blue-400" />
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              ) : (
                <select
                  value={selectedTableId}
                  onChange={(e) => handleTableChange(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Chọn Bàn Phục Vụ --</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      {table.label} ({table.status === 'OCCUPIED' ? 'Đang hoạt động' : 'Còn trống'})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">COUNTER: THU NGÂN</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-7xl w-full mx-auto p-4 gap-6">
        
        {/* Left Section: Menu Catalog */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Search and Categories Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm món ăn hoặc thức uống..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Category Selectors */}
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                Tất cả
              </button>
              {categories.map(cat => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {loading ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center gap-3 text-zinc-500 font-light">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span>Đang tải thực đơn...</span>
              </div>
            ) : filteredItems.map(item => {
              const categorySlug = item.category?.slug || "mon-chinh";
              const bgColor = categoryGradients[categorySlug] || "from-amber-500 to-orange-600";
              const emoji = categoryEmojis[categorySlug] || "🍲";
              const priceNum = Number(item.price);
              
              return (
                <div 
                  key={item.id} 
                  role="button"
                  tabIndex={0}
                  onClick={() => addToCart(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      addToCart(item);
                    }
                  }}
                  className={`group relative flex flex-col justify-between bg-zinc-900/40 border rounded-2xl transition-all duration-300 hover:translate-y-[-2px] overflow-hidden cursor-pointer ${
                    item.isSoldOut ? "border-red-950/60 opacity-60 hover:translate-y-0" : "border-zinc-900 hover:border-zinc-800"
                  }`}
                >
                  {/* Sold Out Overlay */}
                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <span className="bg-red-500/90 border border-red-400/20 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl shadow-lg">
                        Hết Món
                      </span>
                    </div>
                  )}

                  {/* Top Image Banner */}
                  <div className="relative w-full h-32 bg-zinc-950 overflow-hidden shrink-0 border-b border-zinc-900/40">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-tr ${bgColor} flex items-center justify-center text-4xl`}>
                        {emoji}
                      </div>
                    )}
                    {/* Category badge absolute on image */}
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-md text-zinc-300 border border-zinc-800">
                      {item.category?.name || "Món ăn"}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors text-sm mb-1 line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-zinc-400 font-light leading-relaxed line-clamp-2">
                        {item.description || "Chưa có mô tả cho món ăn này."}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-900/60 mt-auto">
                      <span className="font-mono font-bold text-sm text-zinc-100">
                        {formatCurrency(priceNum)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filteredItems.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-500 font-light">
                Không tìm thấy món ăn nào khớp với từ khóa tìm kiếm hoặc không hoạt động.
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Cart Panel — LUÔN HIỂN THỊ */}
        <aside
          aria-label="Đơn hàng hiện tại"
          className="w-full lg:w-96 shrink-0 flex flex-col bg-zinc-900/50 border border-zinc-800/60 rounded-3xl overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)', position: 'sticky', top: '80px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800/60 bg-zinc-900/60 shrink-0">
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <ShoppingBag className="h-4 w-4 text-blue-400" />
            </div>
            <h2 className="font-bold text-white text-sm flex-1">Đơn hàng hiện tại</h2>
            <span className={`font-mono text-xs px-2.5 py-1 rounded-full font-bold border ${
              cart.length > 0
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}>
              {cart.reduce((sum, item) => sum + item.quantity, 0)} món
            </span>
          </div>

          {/* Cart Items — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-zinc-600 py-14 gap-3">
                <ShoppingBag className="h-10 w-10 stroke-[1]" />
                <p className="text-xs font-light max-w-[160px] leading-relaxed">
                  Chưa có món nào. Chọn món từ thực đơn bên trái.
                </p>
              </div>
            ) : (
              cart.map(cartItem => (
                <div
                  key={cartItem.item.id}
                  className="flex gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/50 group hover:border-zinc-700/60 transition-colors"
                >
                  {cartItem.item.imageUrl ? (
                    <img 
                      src={cartItem.item.imageUrl} 
                      alt={cartItem.item.name} 
                      className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm border border-zinc-800/80" 
                    />
                  ) : (
                    <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr ${cartItem.item.bgColor} flex items-center justify-center text-lg shadow-sm`}>
                      {cartItem.item.emoji}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-semibold text-xs text-zinc-100 truncate block">{cartItem.item.name}</span>
                      <button
                        onClick={() => removeFromCart(cartItem.item.id)}
                        aria-label={`Xóa ${cartItem.item.name}`}
                        className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-[11px] text-blue-400 font-bold">
                        {formatCurrency(cartItem.item.price * cartItem.quantity)}
                      </span>
                      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(cartItem.item.id, -1)}
                          aria-label="Giảm số lượng"
                          className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-mono text-xs text-white min-w-[18px] text-center tabular-nums">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(cartItem.item.id, 1)}
                          aria-label="Tăng số lượng"
                          className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer: total + CTA */}
          <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4 space-y-3 bg-zinc-900/40">
            {/* Summary rows */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tạm tính</span>
                <span className="font-mono text-zinc-300 tabular-nums">{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Thuế VAT (10%)</span>
                <span className="font-mono text-zinc-300 tabular-nums">{formatCurrency(getTax())}</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-800">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Tổng hóa đơn
              </span>
              <span className="font-mono font-extrabold text-lg text-blue-400 tabular-nums">
                {formatCurrency(getTotal())}
              </span>
            </div>

             {/* CTA */}
             <button
               onClick={handleCheckout}
               disabled={cart.length === 0 || actionLoading || !sessionId}
               className={`
                 w-full h-12 rounded-2xl font-bold text-sm
                 flex items-center justify-center gap-2
                 transition-all duration-150
                 ${cart.length > 0 && sessionId && !actionLoading
                   ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] cursor-pointer'
                   : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                 }
               `}
             >
               {actionLoading ? (
                 <Loader2 className="h-4.5 w-4.5 animate-spin" />
               ) : (
                 <CreditCard className="h-4.5 w-4.5" />
               )}
               {actionLoading 
                 ? 'Đang xử lý...' 
                 : !selectedTableId 
                   ? 'Vui lòng chọn bàn' 
                   : cart.length > 0 
                     ? 'Thanh toán & Đóng phiên' 
                     : 'Chưa có món nào'}
             </button>
          </div>
        </aside>
      </div>

      {/* Checkout Success Modal */}
      {showCheckoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-6 relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="absolute -top-12 -left-12 h-24 w-24 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
            
            <button 
              onClick={() => setShowCheckoutSuccess(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-white">Thanh Toán Thành Công!</h3>
              <p className="text-xs text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
                Hóa đơn đã được ghi nhận. Đơn hàng đã tự động đồng bộ sang màn hình hiển thị nhà bếp (KDS).
              </p>
            </div>

            <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800/80 font-mono text-center">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">Mã đơn hàng</span>
              <span className="text-white font-bold tracking-wider text-base">{checkoutOrderNo}</span>
            </div>

            <button 
              onClick={() => setShowCheckoutSuccess(false)}
              className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider transition-all"
            >
              Tiếp tục bán hàng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
