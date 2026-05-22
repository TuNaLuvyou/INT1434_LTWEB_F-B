"use client";

import { useState } from "react";
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
  X
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "main" | "drink" | "dessert";
  bgColor: string;
  emoji: string;
  description: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "1", name: "Classic Beef Burger", price: 125000, category: "main", bgColor: "from-amber-500 to-orange-600", emoji: "🍔", description: "Bò nhập khẩu nướng lửa hồng, phô mai Cheddar tan chảy, xốt đặc biệt." },
  { id: "2", name: "Premium Crispy Chicken", price: 110000, category: "main", bgColor: "from-orange-400 to-amber-500", emoji: "🍗", description: "Ức gà giòn rụm xốt cay ngọt, xà lách giòn, sốt mayonnaise tỏi." },
  { id: "3", name: "Smoked Bacon Pizza", price: 185000, category: "main", bgColor: "from-red-500 to-orange-500", emoji: "🍕", description: "Thịt hun khói thơm lừng, xốt cà chua Ý, phô mai mozzarella kéo sợi." },
  { id: "4", name: "Fresh Caesar Salad", price: 85000, category: "main", bgColor: "from-emerald-400 to-teal-500", emoji: "🥗", description: "Xà lách romaine tươi ngon, xốt Caesar đậm đà, bánh mì nướng bơ tỏi." },
  { id: "5", name: "Iced Caramel Macchiato", price: 55000, category: "drink", bgColor: "from-amber-600 to-yellow-600", emoji: "☕", description: "Cà phê espresso đậm vị, sữa tươi thanh trùng, xốt caramel ngọt dịu." },
  { id: "6", name: "Matcha Latte Ice Blended", price: 65000, category: "drink", bgColor: "from-emerald-500 to-green-600", emoji: "🍵", description: "Bột trà xanh Uji Nhật Bản nguyên chất, sữa tươi đá xay mát lạnh." },
  { id: "7", name: "Fresh Strawberry Soda", price: 48000, category: "drink", bgColor: "from-rose-500 to-pink-500", emoji: "🥤", description: "Dâu tây tươi ngâm đường phèn kết hợp soda mát lạnh, hương bạc hà." },
  { id: "8", name: "Molten Lava Chocolate Cake", price: 75000, category: "dessert", bgColor: "from-amber-900 to-stone-900", emoji: "🍰", description: "Bánh chocolate mềm ẩm với nhân chocolate lỏng nóng chảy cao cấp." },
  { id: "9", name: "Matcha Tiramisu Cup", price: 80000, category: "dessert", bgColor: "from-green-500 to-emerald-700", emoji: "🧁", description: "Từng lớp kem phô mai mascarpone béo ngậy xen kẽ cốt bánh matcha." },
];

export default function POSPage() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "main" | "drink" | "dessert">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [checkoutOrderNo, setCheckoutOrderNo] = useState("");

  const filteredItems = MENU_ITEMS.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.item.id === itemId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  const getTax = () => getSubtotal() * 0.1;
  const getTotal = () => getSubtotal() + getTax();

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const orderNum = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    setCheckoutOrderNo(orderNum);
    setShowCheckoutSuccess(true);
    setCart([]);
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
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold tracking-wider uppercase">Active Counter</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400 font-mono">STAFF: Nguyễn Văn A</span>
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
              {(["all", "main", "drink", "dessert"] as const).map(cat => {
                const labels = { all: "Tất cả", main: "Món chính", drink: "Đồ uống", dessert: "Món tráng miệng" };
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                      isActive 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {labels[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {filteredItems.map(item => (
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
                className="group relative flex flex-col justify-between bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 hover:border-zinc-800 transition-all duration-300 hover:translate-y-[-2px] overflow-hidden cursor-pointer"
              >
                {/* Accent Background Glow */}
                <div className={`absolute -right-12 -top-12 h-24 w-24 rounded-full bg-gradient-to-tr ${item.bgColor} opacity-[0.02] blur-xl transition-all duration-300 group-hover:opacity-[0.08]`} />
                
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-tr ${item.bgColor} flex items-center justify-center text-2xl shadow-md`}>
                      {item.emoji}
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-800">
                      {item.category === "main" ? "Món chính" : item.category === "drink" ? "Nước uống" : "Tráng miệng"}
                    </span>
                  </div>

                  <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors text-base mb-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed mb-4 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-auto pt-2 border-t border-zinc-900/60">
                  <span className="font-mono font-bold text-sm text-zinc-100">
                    {formatCurrency(item.price)}
                  </span>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-500 font-light">
                Không tìm thấy món ăn nào khớp với từ khóa tìm kiếm.
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
                  <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr ${cartItem.item.bgColor} flex items-center justify-center text-lg shadow-sm`}>
                    {cartItem.item.emoji}
                  </div>
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
              disabled={cart.length === 0}
              className={`
                w-full h-12 rounded-2xl font-bold text-sm
                flex items-center justify-center gap-2
                transition-all duration-150
                ${cart.length > 0
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] cursor-pointer'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }
              `}
            >
              <CreditCard className="h-4.5 w-4.5" />
              {cart.length > 0 ? 'Thanh toán & Gửi bếp' : 'Chưa có món nào'}
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
