"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  Flame, 
  Leaf, 
  Sparkles,
  Heart,
  ChevronUp,
  ChevronDown,
  X,
  Smile
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "all" | "main" | "drink" | "dessert";
  bgColor: string;
  emoji: string;
  description: string;
  tags: ("spicy" | "vegan" | "popular" | "healthy")[];
  calories: number;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "1", name: "Classic Beef Burger", price: 125000, category: "main", bgColor: "from-amber-500 to-orange-600", emoji: "🍔", description: "Bò nhập khẩu nướng lửa hồng, phô mai Cheddar tan chảy, xốt đặc biệt.", tags: ["popular"], calories: 580 },
  { id: "2", name: "Premium Crispy Chicken", price: 110000, category: "main", bgColor: "from-orange-400 to-amber-500", emoji: "🍗", description: "Ức gà giòn rụm xốt cay ngọt, xà lách giòn, sốt mayonnaise tỏi.", tags: ["spicy", "popular"], calories: 620 },
  { id: "3", name: "Smoked Bacon Pizza", price: 185000, category: "main", bgColor: "from-red-500 to-orange-500", emoji: "🍕", description: "Thịt hun khói thơm lừng, xốt cà chua Ý, phô mai mozzarella kéo sợi.", tags: ["popular"], calories: 720 },
  { id: "4", name: "Fresh Caesar Salad", price: 85000, category: "main", bgColor: "from-emerald-400 to-teal-500", emoji: "🥗", description: "Xà lách romaine tươi ngon, xốt Caesar đậm đà, bánh mì nướng bơ tỏi.", tags: ["vegan", "healthy"], calories: 240 },
  { id: "5", name: "Iced Caramel Macchiato", price: 55000, category: "drink", bgColor: "from-amber-600 to-yellow-600", emoji: "☕", description: "Cà phê espresso đậm vị, sữa tươi thanh trùng, xốt caramel ngọt dịu.", tags: ["popular"], calories: 180 },
  { id: "6", name: "Matcha Latte Ice Blended", price: 65000, category: "drink", bgColor: "from-emerald-500 to-green-600", emoji: "🍵", description: "Bột trà xanh Uji Nhật Bản nguyên chất, sữa tươi đá xay mát lạnh.", tags: ["healthy"], calories: 210 },
  { id: "7", name: "Fresh Strawberry Soda", price: 48000, category: "drink", bgColor: "from-rose-500 to-pink-500", emoji: "🥤", description: "Dâu tây tươi ngâm đường phèn kết hợp soda mát lạnh, hương bạc hà.", tags: ["healthy"], calories: 110 },
  { id: "8", name: "Molten Lava Chocolate Cake", price: 75000, category: "dessert", bgColor: "from-amber-900 to-stone-900", emoji: "🍰", description: "Bánh chocolate mềm ẩm với nhân chocolate lỏng nóng chảy cao cấp.", tags: ["popular"], calories: 420 },
  { id: "9", name: "Matcha Tiramisu Cup", price: 80000, category: "dessert", bgColor: "from-green-500 to-emerald-700", emoji: "🧁", description: "Từng lớp kem phô mai mascarpone béo ngậy xen kẽ cốt bánh matcha.", tags: [], calories: 350 },
];

export default function DigitalMenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "main" | "drink" | "dessert">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tableNumber, setTableNumber] = useState("Bàn số 05");

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

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
      }).filter(Boolean) as { item: MenuItem; quantity: number }[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  const getTax = () => getSubtotal() * 0.1;
  const getTotal = () => getSubtotal() + getTax();

  const handleOrder = () => {
    if (cart.length === 0) return;
    setShowCartDrawer(false);
    setShowSuccessModal(true);
    setCart([]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden pb-20 sm:pb-0">
      {/* Background Glow */}
      <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-white">E-Menu Smart Call</span>
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {tableNumber}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => cart.length > 0 && setShowCartDrawer(true)}
              className="relative h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <ShoppingBag className="h-5 w-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center border border-zinc-950">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Banner Welcome */}
        <div className="bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border border-emerald-900/30 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute right-6 bottom-[-30px] opacity-10 text-9xl select-none font-bold">🍔</div>
          <div className="space-y-2 relative z-10 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
              <Sparkles className="h-3 w-3" /> Chào mừng quý khách
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Gọi món trực tiếp tại bàn</h1>
            <p className="text-xs text-zinc-400 font-light leading-relaxed">
              Vui lòng duyệt qua các món ăn đặc sắc dưới đây, thêm vào giỏ hàng và ấn nút đặt món. Đơn hàng sẽ được tự động đồng bộ xuống bếp chế biến ngay lập tức!
            </p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {(["all", "main", "drink", "dessert"] as const).map(cat => {
              const labels = { all: "Tất cả", main: "Món ngon", drink: "Đồ uống", dessert: "Tráng miệng" };
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                    isActive 
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {labels[cat]}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Tìm món ngon hôm nay..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => {
            const isFav = favorites.includes(item.id);
            return (
              <div 
                key={item.id} 
                className="group relative flex flex-col justify-between bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 rounded-3xl p-5 hover:translate-y-[-2px] transition-all duration-300 overflow-hidden"
              >
                {/* Glow card backdrop */}
                <div className={`absolute -right-12 -top-12 h-24 w-24 rounded-full bg-gradient-to-tr ${item.bgColor} opacity-[0.02] blur-xl transition-all duration-300 group-hover:opacity-[0.08]`} />

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-tr ${item.bgColor} flex items-center justify-center text-2xl shadow-md`}>
                      {item.emoji}
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className="h-8 w-8 rounded-full bg-zinc-950/60 border border-zinc-900 hover:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-500 transition-all"
                      >
                        <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Badges / Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {item.tags.map(tag => (
                      <span 
                        key={tag} 
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          tag === "spicy" 
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                            : tag === "vegan" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : tag === "popular"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                        }`}
                      >
                        {tag === "spicy" ? "🔥 Cay" : tag === "vegan" ? "🍃 Chay" : tag === "popular" ? "⭐️ Bán chạy" : "❤️ Healthy"}
                      </span>
                    ))}
                    <span className="text-[9px] font-semibold text-zinc-500 py-0.5 px-1 font-mono">
                      {item.calories} kcal
                    </span>
                  </div>

                  <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors text-base mb-1.5">
                    {item.name}
                  </h3>
                  
                  <p className="text-xs text-zinc-400 font-light leading-relaxed mb-4 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-auto pt-3 border-t border-zinc-900/60">
                  <span className="font-mono font-bold text-base text-zinc-100">
                    {formatCurrency(item.price)}
                  </span>
                  
                  <button 
                    onClick={() => addToCart(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white text-xs font-bold transition-all duration-300 hover:scale-[1.03] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm món
                  </button>
                </div>

              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-zinc-500 font-light">
              Món ăn đang được cập nhật hoặc không tìm thấy khớp.
            </div>
          )}
        </div>

      </main>

      {/* Floating Bottom Bar (Only visible if cart contains items) */}
      {cart.length > 0 && !showCartDrawer && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-8 duration-300">
          <button 
            onClick={() => setShowCartDrawer(true)}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-emerald-400/20 group cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-950/20 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 animate-pulse" />
              </div>
              <div className="text-left">
                <span className="text-[10px] block uppercase font-bold tracking-wider text-emerald-100">Giỏ hàng của bạn</span>
                <span className="text-xs font-semibold text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)} món đã chọn</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm">{formatCurrency(getTotal())}</span>
              <ChevronUp className="h-4 w-4 text-emerald-100 group-hover:translate-y-[-2px] transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 space-y-6 relative overflow-hidden animate-in slide-in-from-bottom-20 sm:zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-base text-white">Giỏ hàng đặt món</h3>
              </div>
              <button 
                onClick={() => setShowCartDrawer(false)}
                className="h-8 w-8 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cart List */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {cart.map(cartItem => (
                <div key={cartItem.item.id} className="flex gap-3 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900/60 group">
                  <div className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-tr ${cartItem.item.bgColor} flex items-center justify-center text-lg`}>
                    {cartItem.item.emoji}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-semibold text-xs text-white truncate block">{cartItem.item.name}</span>
                      <button 
                        onClick={() => removeFromCart(cartItem.item.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-[11px] text-zinc-400">
                        {formatCurrency(cartItem.item.price * cartItem.quantity)}
                      </span>
                      <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button 
                          onClick={() => updateQuantity(cartItem.item.id, -1)}
                          className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-mono text-xs text-white min-w-4 text-center">{cartItem.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(cartItem.item.id, 1)}
                          className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations and Actions */}
            <div className="border-t border-zinc-800 pt-4 space-y-2.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Tạm tính</span>
                <span className="font-mono text-zinc-200">{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Thuế VAT (10%)</span>
                <span className="font-mono text-zinc-200">{formatCurrency(getTax())}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-dashed border-zinc-800">
                <span>Tổng cộng (Thanh toán sau)</span>
                <span className="font-mono text-emerald-400 text-base">{formatCurrency(getTotal())}</span>
              </div>

              <button 
                onClick={handleOrder}
                className="w-full mt-4 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Gửi lệnh gọi món - Gọi món
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-6 relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="absolute -top-12 -left-12 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
            
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Smile className="h-8 w-8 text-emerald-400 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-white">Đã Gửi Đơn Gọi Món!</h3>
              <p className="text-xs text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
                Đơn hàng đã được chuyển thẳng tới nhà bếp (KDS). Món ăn sẽ được chuẩn bị và phục vụ quý khách tại <span className="font-bold text-emerald-400">{tableNumber}</span> sớm nhất!
              </p>
            </div>

            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider transition-all"
            >
              Tiếp tục xem thực đơn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
