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

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherData, setVoucherData] = useState<{
    id: string;
    code: string;
    discountType: "PERCENT" | "FIXED";
    discountValue: number;
    discountAmount: number;
  } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [showVoucherDropdown, setShowVoucherDropdown] = useState(false);

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
    const selectedTable = tables.find((table) => table.id === tableId);
    if (selectedTable?.status === 'OCCUPIED') {
      alert('Bàn đang có khách, không thể chọn để gọi món mới.');
      return;
    }

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
        body: JSON.stringify({ tableId, source: 'POS' }),
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
    room: 'floor-plan',
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
        console.log('[POS Socket] Nhận được thay đổi phiên từ hệ thống, đồng bộ lại...');
        fetchSessionDetails(sessionId);
      }
    };

    const handleTableStatusChanged = (payload: any) => {
      console.log('[POS Socket] Trạng thái bàn thay đổi:', payload);
      setTables(prev =>
        prev.map(t =>
          t.id === payload.tableId ? { ...t, status: payload.status } : t
        )
      );
      if (payload.tableId === selectedTableId && payload.status !== 'RESERVED') {
        setSelectedTableId("");
        setSessionId("");
        setCart([]);
        if (payload.status === 'OCCUPIED') {
          alert('Bàn vừa có khách, vui lòng chọn bàn khác để gọi món.');
        }
      }
    };

    cashierSocket.on('table:session-updated', handleSessionUpdate);
    cashierSocket.on('table:status-changed', handleTableStatusChanged);

    return () => {
      cashierSocket.off('table:session-updated', handleSessionUpdate);
      cashierSocket.off('table:status-changed', handleTableStatusChanged);
    };
  }, [cashierSocket, isCashierConnected, sessionId, selectedTableId]);

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

  const fetchAvailableVouchers = async () => {
    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/vouchers`, {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        const now = new Date();
        const activeVouchers = (result.data || []).filter((v: any) => {
          const isExpired = v.expiredAt ? now > new Date(v.expiredAt) : false;
          const isExhausted = v.maxUsage !== null && v.usedCount >= v.maxUsage;
          return v.isActive && !isExpired && !isExhausted;
        });
        setAvailableVouchers(activeVouchers);
      }
    } catch (err) {
      console.error("[POS] Lỗi tải danh sách voucher:", err);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0 || !sessionId) return;
    setVoucherCode("");
    setVoucherData(null);
    setVoucherError(null);
    setPaymentMethod(null);
    setIsPaymentModalOpen(true);
    fetchAvailableVouchers();
  };

  const handleValidateVoucher = async (codeOverride?: string) => {
    const codeToValidate = codeOverride || voucherCode;
    if (!codeToValidate.trim()) return;
    setIsValidatingVoucher(true);
    setVoucherError(null);
    setVoucherData(null);

    const baseAmount = getTotal();

    try {
      const accessToken = getAccessTokenFromCookie();
      const params = new URLSearchParams({
        code: codeToValidate.trim().toUpperCase(),
        subtotal: String(baseAmount),
      });
      const res = await fetch(`${API_URL}/api/payment/validate-voucher?${params}`, {
        headers: { Authorization: `Bearer ${accessToken || ""}` },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setVoucherData(result.data);
      } else {
        setVoucherError(result.message || "Mã voucher không hợp lệ.");
      }
    } catch {
      setVoucherError("Lỗi kết nối server khi kiểm tra voucher.");
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (cart.length === 0 || !sessionId || !paymentMethod) return;
    setActionLoading(true);

    const baseAmount = getTotal();
    const discountAmount = voucherData?.discountAmount ?? 0;
    const finalTotal = Math.max(0, baseAmount - discountAmount);

    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/payment/sessions/${sessionId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || ""}`,
        },
        body: JSON.stringify({
          method: paymentMethod,
          voucherId: voucherData?.id,
          subtotal: baseAmount,
          discountAmount,
          total: finalTotal,
          keepOccupied: true, // POS ALWAYS keeps the table occupied!
        }),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        setCheckoutOrderNo(`ORD-${sessionId.substring(0, 4).toUpperCase()}`);
        setShowCheckoutSuccess(true);
        // Clean session
        setSessionId("");
        setSelectedTableId("");
        setCart([]);
        setIsPaymentModalOpen(false);
        fetchData(); // reload tables
      } else {
        alert(result.message || "Không thể thực hiện thanh toán");
      }
    } catch (err) {
      console.error("[POS] Lỗi thanh toán:", err);
      alert("Lỗi kết nối server.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans relative">
      {/* Background Glow */}
      <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-lg text-white">POS Cashier</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold tracking-wider uppercase border ${
                isCashierConnected 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 animate-pulse'
              }`}>
                {isCashierConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-4">
            {/* Table Selector Dropdown */}
            <div className="flex items-center gap-1 sm:gap-2">
              <TableIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 shrink-0" />
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              ) : (
                <select
                  value={selectedTableId}
                  onChange={(e) => handleTableChange(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-[10px] sm:text-xs font-bold text-zinc-200 rounded-xl px-2 sm:px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[110px] sm:max-w-none"
                >
                  <option value="">-- Chọn Bàn --</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id} disabled={table.status === 'OCCUPIED'}>
                      {table.label} ({table.status === 'OCCUPIED' ? 'Đang HĐ' : 'Trống'})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Link href="/cashier" className="inline-flex items-center gap-1 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg">
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Thu ngân</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-x-hidden max-w-7xl w-full mx-auto p-3 sm:p-4 gap-4 sm:gap-6">
        
        {/* Left Section: Menu Catalog */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Search and Categories Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
            <div className="relative w-full sm:max-w-xs shrink-0">
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
            <div className="flex gap-2 overflow-x-auto w-full flex-1 min-w-0 pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
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
          <div className="flex-1 lg:overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 auto-rows-max pb-10 lg:max-h-[calc(100vh-200px)]">
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
                  className={`group relative flex flex-col justify-between h-full bg-zinc-900/40 border rounded-2xl transition-all duration-300 hover:translate-y-[-2px] overflow-hidden cursor-pointer ${
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
          style={{ maxHeight: 'calc(100vh - 80px)', position: 'sticky', top: '60px' }}
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

      {/* Payment Modal */}
      {isPaymentModalOpen && sessionId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900">
              <div>
                <div className="text-sm font-bold text-white tracking-tight">💳 Thanh Toán Hóa Đơn (POS)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Bàn: {tables.find(t => t.id === selectedTableId)?.label || "Bàn Phục Vụ"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all text-lg"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              {/* Danh sach mon an */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Chi tiết hóa đơn</div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {cart.map((cartItem) => (
                    <div key={cartItem.item.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-medium truncate flex-1 pr-3">{cartItem.item.name}</span>
                      <span className="text-zinc-500 shrink-0">x{cartItem.quantity}</span>
                      <span className="text-zinc-200 font-mono ml-4 shrink-0">
                        {formatCurrency(cartItem.item.price * cartItem.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-900 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span>Tạm tính</span>
                    <span className="font-mono text-zinc-300">{formatCurrency(getSubtotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thuế VAT (10%)</span>
                    <span className="font-mono text-zinc-300">{formatCurrency(getTax())}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-200 mt-1">
                    <span>Tổng cộng</span>
                    <span className="font-mono text-white text-sm">{formatCurrency(getTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Voucher */}
              <div className="space-y-2 relative">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mã giảm giá</div>
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => {
                        setVoucherCode(e.target.value.toUpperCase());
                        setVoucherData(null);
                        setVoucherError(null);
                        setShowVoucherDropdown(true);
                      }}
                      onFocus={() => setShowVoucherDropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleValidateVoucher();
                          setShowVoucherDropdown(false);
                        }
                      }}
                      placeholder="Nhập hoặc chọn voucher..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 transition-all font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                      className="absolute right-2.5 top-2.5 text-[9px] text-zinc-500 hover:text-white transition-colors"
                    >
                      ▼
                    </button>

                    {/* Filtered Dropdown */}
                    {showVoucherDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowVoucherDropdown(false)} />
                        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 divide-y divide-zinc-800">
                          {availableVouchers.filter(v => v.code.toLowerCase().includes(voucherCode.toLowerCase())).length === 0 ? (
                            <div className="p-3 text-xs text-zinc-550 text-center">Không tìm thấy voucher</div>
                          ) : (
                            availableVouchers
                              .filter(v => v.code.toLowerCase().includes(voucherCode.toLowerCase()))
                              .map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    setVoucherCode(v.code);
                                    handleValidateVoucher(v.code);
                                    setShowVoucherDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-zinc-850 transition-colors flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-white font-mono">{v.code}</span>
                                    <span className="text-[10px] text-zinc-400 block">
                                      {v.discountType === "PERCENT" ? `Giảm ${v.discountValue}%` : `Giảm ${formatCurrency(Number(v.discountValue))}`}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-500">
                                    Hạn: {v.expiredAt ? new Date(v.expiredAt).toLocaleDateString("vi-VN") : "∞"}
                                  </span>
                                </button>
                              ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleValidateVoucher()}
                    disabled={!voucherCode.trim() || isValidatingVoucher}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold uppercase tracking-wider transition-all shrink-0"
                  >
                    {isValidatingVoucher ? "..." : "Áp dụng"}
                  </button>
                </div>

                {voucherData && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✓ {voucherData.code}</span>
                      <div className="text-[11px] text-emerald-300 mt-0.5">
                        Giảm {voucherData.discountType === "PERCENT" ? `${voucherData.discountValue}%` : formatCurrency(voucherData.discountValue)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      -{formatCurrency(voucherData.discountAmount)}
                    </div>
                  </div>
                )}

                {voucherError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-[11px] text-rose-400">
                    ✗ {voucherError}
                  </div>
                )}
              </div>

              {/* Tong sau giam gia */}
              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-3.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Tổng thanh toán</span>
                <span className="text-lg font-black text-blue-400 font-mono">
                  {formatCurrency(Math.max(0, getTotal() - (voucherData?.discountAmount ?? 0)))}
                </span>
              </div>

              {/* Phuong thuc thanh toan */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Phương thức thanh toán</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 transition-all duration-200 ${paymentMethod === "CASH"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    <span className="text-2xl">💵</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider">Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("TRANSFER")}
                    className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 transition-all duration-200 ${paymentMethod === "TRANSFER"
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                        : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    <span className="text-2xl">📲</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider">Chuyển khoản</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-zinc-900 flex gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={actionLoading}
                className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 py-3 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!paymentMethod || actionLoading}
                className="flex-[2] rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(99,102,241,0.25)] disabled:from-zinc-850 disabled:to-zinc-850 disabled:text-zinc-500 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : !paymentMethod ? (
                  "Chọn phương thức"
                ) : (
                  `✓ Xác nhận thanh toán`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
