"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  LayoutGrid,
  ChefHat,
  Volume2,
  VolumeX,
  Printer,
  UtensilsCrossed,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { ReceiptPrintTemplate, ReceiptPrintProps } from "@/components/print/ReceiptPrintTemplate";
import { useSocket } from "@/hooks/useSocket";
import { getAccessTokenFromCookie, decodeTokenPayload } from "@/lib/auth/client";
import CashierClient from "./CashierClient";
import ItemOptionsModal from "./ItemOptionsModal";
import toast from "react-hot-toast";
import { getStoredToppings } from "@/components/ToppingManagerModal";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  bgColor: string;
  emoji: string;
  description: string;
  imageUrl?: string | null;
  isSoldOut?: boolean;
  hasSizes?: boolean;
  selectedModifiers?: any;
  optionsNote?: string;
  selectedSugar?: string;
  selectedIce?: string;
  selectedToppings?: string[];
  optionKey?: string;
  itemDiscountType?: 'PERCENT' | 'FIXED' | null;
  itemDiscountValue?: number;
}

interface CartItem {
  cartId?: string;
  item: MenuItem;
  quantity: number;
  options?: any;
}

const DEFAULT_POS_MODIFIERS = [
  { id: 'group-topping', name: 'Thêm Topping', type: 'MULTI_SELECT' },
  { id: 'opt-top-tc', modifierGroupId: 'group-topping', name: 'Trân châu đen', priceAdjustment: 5000, isActive: true, type: 'MULTI_SELECT' },
  { id: 'opt-top-thach', modifierGroupId: 'group-topping', name: 'Thạch dừa', priceAdjustment: 5000, isActive: true, type: 'MULTI_SELECT' },
  { id: 'opt-top-cheese', modifierGroupId: 'group-topping', name: 'Kem Cheese', priceAdjustment: 8000, isActive: true, type: 'MULTI_SELECT' },
];

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
  const addedItemDuringSelectRef = useRef(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [checkoutOrderNo, setCheckoutOrderNo] = useState("");

  // Item Options Modal state
  const [selectedModalItem, setSelectedModalItem] = useState<any | null>(null);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [posModifiers, setPosModifiers] = useState<any[]>(DEFAULT_POS_MODIFIERS);

  useEffect(() => {
    const updateModifiers = () => {
      const stored = getStoredToppings();
      if (stored && stored.length > 0) {
        const toppingGroup = { id: 'group-topping', name: 'Thêm Topping', type: 'MULTI_SELECT' };
        const options = stored.map(t => ({
          id: t.id,
          modifierGroupId: 'group-topping',
          name: t.name,
          priceAdjustment: t.priceAdjustment,
          isActive: t.isActive !== false,
          type: 'MULTI_SELECT'
        }));
        setPosModifiers([toppingGroup, ...options]);
      } else {
        setPosModifiers(DEFAULT_POS_MODIFIERS);
      }
    };

    updateModifiers();
    window.addEventListener("options_updated", updateModifiers);
    window.addEventListener("toppings_updated", updateModifiers);
    return () => {
      window.removeEventListener("options_updated", updateModifiers);
      window.removeEventListener("toppings_updated", updateModifiers);
    };
  }, []);

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

  // POS customer loyalty states
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posCustomerData, setPosCustomerData] = useState<any>(null);
  const [posUsePoints, setPosUsePoints] = useState(false);
  const [posPointsToUse, setPosPointsToUse] = useState<number | "">(0);
  const [isCheckingPosPhone, setIsCheckingPosPhone] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'tables' | 'menu' | 'cashier'>('tables');

  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [disableSound, setDisableSound] = useState(false);

  function playPOSBeep() {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      
      // Use singleton to avoid browser limits
      if (!(window as any).__posAudioCtx) {
        (window as any).__posAudioCtx = new AudioContextCtor();
      }
      const ctx = (window as any).__posAudioCtx;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playChime = (freq: number, startTime: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1.0, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.7);
      };
      
      const now = ctx.currentTime;
      playChime(880, now);
      playChime(1108.73, now);
      playChime(880, now + 0.15);
      playChime(1108.73, now + 0.15);
    } catch (e) {
      console.error('Audio api error', e);
    }
  }

  const [cashierUser, setCashierUser] = useState<{ userId: string; role: 'ADMIN' | 'MANAGER' | 'CASHIER' } | null>(null);

  useEffect(() => {
    const token = getAccessTokenFromCookie();
    if (!token) return;
    const decoded = decodeTokenPayload(token);
    if (decoded?.userId && decoded?.role) {
      setCashierUser({ userId: decoded.userId, role: decoded.role as any });
    }
  }, []);

  // Live POS States
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Printing state & refs for POS
  const posReceiptPrintRef = useRef<HTMLDivElement>(null);
  const [posPrintData, setPosPrintData] = useState<ReceiptPrintProps | null>(null);

  const handleTriggerPosPrint = useReactToPrint({
    contentRef: posReceiptPrintRef,
    pageStyle: `
      @page {
        size: auto;
        margin: 0mm;
      }
      @media print {
        html, body {
          width: 100% !important;
          min-width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .receipt-print-root {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          padding: 12mm 15mm !important;
          margin: 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  const triggerPrintReceipt = (data: ReceiptPrintProps) => {
    setPosPrintData(data);
    setTimeout(() => {
      handleTriggerPosPrint();
    }, 150);
  };
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [takeawayLabel, setTakeawayLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [isConfirmingPending, setIsConfirmingPending] = useState(false);

  // Persist sessionId, selectedTableId, activeTab, và cart qua sessionStorage để không mất khi reload
  useEffect(() => {
    if (sessionId) sessionStorage.setItem('pos_sessionId', sessionId);
    else sessionStorage.removeItem('pos_sessionId');
  }, [sessionId]);

  useEffect(() => {
    if (selectedTableId) sessionStorage.setItem('pos_selectedTableId', selectedTableId);
    else sessionStorage.removeItem('pos_selectedTableId');
  }, [selectedTableId]);

  useEffect(() => {
    if (activeTab) sessionStorage.setItem('pos_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (sessionId && cart.length > 0) {
      sessionStorage.setItem('pos_cart', JSON.stringify(cart));
    } else if (!sessionId) {
      sessionStorage.removeItem('pos_cart');
    }
  }, [cart, sessionId]);

  // Fetch Menu, Categories and Tables on mount
  const fetchData = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      
      let tId = '';
      let bId = '';
      if (accessToken) {
        const payload = decodeTokenPayload(accessToken);
        tId = payload?.tenantId || '';
        bId = payload?.branchId || '';
      }

      // Fetch Menu & Categories
      const menuRes = await fetch(`${API_URL}/api/menu?tenantId=${tId}&branchId=${bId}`);
      const menuData = await menuRes.json();
      if (menuRes.ok && menuData.success) {
        setMenuItems(menuData.data.items || []);
        setCategories(menuData.data.categories || []);
      }

      // Fetch Tables
      const tablesRes = await fetch(`${API_URL}/api/tables?t=${Date.now()}`, {
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
    const savedSessionId = sessionStorage.getItem('pos_sessionId') || '';
    const savedTableId = sessionStorage.getItem('pos_selectedTableId') || '';
    const savedTab = (sessionStorage.getItem('pos_activeTab') as any) || '';
    const savedCartStr = sessionStorage.getItem('pos_cart');

    if (savedTab) {
      setActiveTab(savedTab);
    } else if (savedSessionId) {
      setActiveTab('menu');
    }

    let hasLocalCart = false;
    if (savedCartStr) {
      try {
        const parsedCart = JSON.parse(savedCartStr);
        if (Array.isArray(parsedCart) && parsedCart.length > 0) {
          setCart(parsedCart);
          hasLocalCart = true;
        }
      } catch (e) {}
    }

    if (savedSessionId) {
      setSessionId(savedSessionId);
      setSelectedTableId(savedTableId);
      fetchData().then(() => fetchSessionDetails(savedSessionId, hasLocalCart));
    } else {
      fetchData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Session details for selected table
  const fetchSessionDetails = async (sessId: string, hasLocalCart: boolean = false) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessId}`);
      const result = await response.json();
      if (response.ok && result.success) {
        if (!hasLocalCart) {
          syncCartWithSession(result.data);
        }
        // Nếu session đã đóng, xoá dữ liệu đã lưu
        if (result.data?.session?.status && result.data.session.status !== 'OPEN') {
          setSessionId("");
          setSelectedTableId("");
          setCart([]);
          sessionStorage.removeItem('pos_sessionId');
          sessionStorage.removeItem('pos_selectedTableId');
          sessionStorage.removeItem('pos_activeTab');
          sessionStorage.removeItem('pos_cart');
        }
      } else {
        // Session không tồn tại → xoá dữ liệu persist
        setSessionId("");
        setSelectedTableId("");
        setCart([]);
        sessionStorage.removeItem('pos_sessionId');
        sessionStorage.removeItem('pos_selectedTableId');
        sessionStorage.removeItem('pos_activeTab');
        sessionStorage.removeItem('pos_cart');
      }
    } catch (err) {
      console.error("[POS] Lỗi tải chi tiết phiên:", err);
    }
  };

  const [selectingTableId, setSelectingTableId] = useState<string | null>(null);

  // Select table from grid — auto navigate to menu tab (Optimistic UI)
  const handleSelectTable = async (tableId: string) => {
    if (isCancelling) return;
    if (tableId === selectedTableId) {
      setActiveTab('menu');
      return;
    }

    // Switch tab immediately for 0ms perceived latency
    setSelectingTableId(tableId);
    setSelectedTableId(tableId);
    setActiveTab('menu');
    addedItemDuringSelectRef.current = false;

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
        // Chỉ sync cart từ server nếu user chưa thêm món trong lúc chờ API
        // Tránh mất items do race condition giữa addToCart (local) và syncCartWithSession
        if (!addedItemDuringSelectRef.current) {
          syncCartWithSession(result.data.session);
        }
      } else {
        alert(result.message || "Không thể khởi tạo phiên cho bàn");
        setSelectedTableId("");
        setActiveTab('tables');
      }
    } catch (err) {
      console.error("[POS] Lỗi tham gia phiên bàn:", err);
      setSelectedTableId("");
      setActiveTab('tables');
    } finally {
      setSelectingTableId(null);
    }
  };

  const handleDeselectTable = async () => {
    if (!sessionId) {
      setSelectedTableId("");
      setActiveTab('tables');
      return;
    }
    setIsCancelling(true);
    const cancelledTableId = selectedTableId;
    const oldSessionId = sessionId;
    setSelectedTableId("");
    setSessionId("");
    setCart([]);
    setActiveTab('tables');
    setTables(prev =>
      prev.map(t =>
        t.id === cancelledTableId ? { ...t, status: 'AVAILABLE' } : t
      )
    );
    try {
      const accessToken = getAccessTokenFromCookie();
      await fetch(`${API_URL}/api/sessions/${oldSessionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || ""}`,
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
    } catch (err) {
      console.error("[POS] Lỗi huỷ bàn:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateTakeawaySession = async (): Promise<string | null> => {
    try {
      setActionLoading(true);
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/sessions/takeaway`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || ""}`,
        },
      });
      const result = await res.json();
      if (res.ok && result.success && result.data?.session) {
        const takeawaySession = result.data.session;
        setSessionId(takeawaySession.id);
        setSelectedTableId('takeaway');
        const label = 'Mang về';
        setTakeawayLabel(label);
        return takeawaySession.id;
      } else {
        alert(result.message || "Không thể tạo đơn mang về.");
        return null;
      }
    } catch (err) {
      console.error("[POS] Lỗi tạo đơn mang về:", err);
      alert("Lỗi kết nối server khi tạo đơn mang về.");
      return null;
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
  let tenantId = 'unknown';
  let branchId = 'unknown';
  if (token) {
    const payload = decodeTokenPayload(token);
    tenantId = payload?.tenantId || 'unknown';
    branchId = payload?.branchId || 'unknown';
  }
  
  const { socket: cashierSocket, isConnected: isCashierConnected } = useSocket({
    room: `tenant:${tenantId}:branch:${branchId}:floor-plan`,
    token,
  });

  const { socket: menuSocket, isConnected: isMenuConnected } = useSocket({
    room: `tenant:${tenantId}:menu-updates`,
  });

  const { socket: orderSocket, isConnected: isOrderConnected } = useSocket({
    room: `tenant:${tenantId}:branch:${branchId}:cashier`,
    token,
  });

  // Listen to cashier new-order events for a single POS beep
  useEffect(() => {
    if (!orderSocket || !isOrderConnected) return;

    const handleNewOrder = () => {
      playPOSBeep();
    };

    orderSocket.on('cashier:new-order', handleNewOrder);

    return () => {
      orderSocket.off('cashier:new-order', handleNewOrder);
    };
  }, [orderSocket, isOrderConnected]);



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
        fetchSessionDetails(sessionId);
      }
    };

    const handleTableStatusChanged = (payload: any) => {
      setTables(prev =>
        prev.map(t =>
          t.id === payload.tableId ? { ...t, status: payload.status } : t
        )
      );
    };

    cashierSocket.on('table:session-updated', handleSessionUpdate);
    cashierSocket.on('table:status-changed', handleTableStatusChanged);

    return () => {
      cashierSocket.off('table:session-updated', handleSessionUpdate);
      cashierSocket.off('table:status-changed', handleTableStatusChanged);
    };
  }, [cashierSocket, isCashierConnected, sessionId]);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch && item.isActive;
  });

  // Map a MenuItem to a cart-compatible item shape
  const toCartItem = (item: any, qty: number): CartItem => {
    const categorySlug = item.category?.slug || "mon-chinh";
    return {
      item: {
        id: item.id,
        name: item.name,
        price: Number(item.price),
        category: item.categoryId,
        bgColor: categoryGradients[categorySlug] || "from-amber-500 to-orange-600",
        emoji: categoryEmojis[categorySlug] || "🍲",
        description: item.description || "",
        isSoldOut: item.isSoldOut,
        imageUrl: item.imageUrl,
      },
      quantity: qty,
    };
  };

  const handleOpenItemModal = (item: any) => {
    if (item.isSoldOut) {
      alert("Món ăn này đã hết hàng!");
      return;
    }
    setSelectedModalItem(item);
    setIsOptionsModalOpen(true);
  };

  const handleAddToCartFromModal = (itemWithOptions: any, options: any) => {
    addedItemDuringSelectRef.current = true;

    const optionKeyParts: string[] = [];
    if (options.isDrink) {
      if (options.selectedSize) optionKeyParts.push(`Size: ${options.selectedSize.name}`);
      if (options.sugar) optionKeyParts.push(`Đường: ${options.sugar}`);
      if (options.ice) optionKeyParts.push(`Đá: ${options.ice}`);
      if (options.toppings && options.toppings.length > 0) optionKeyParts.push(`Topping: ${options.toppings.join(', ')}`);
    }
    if (options.note && options.note.trim()) optionKeyParts.push(`Ghi chú: ${options.note.trim()}`);

    const optionKey = optionKeyParts.join(' • ');
    const cartItemId = optionKey ? `${itemWithOptions.id}_${optionKey}` : itemWithOptions.id;

    const newItem: CartItem = {
      cartId: cartItemId,
      item: {
        ...itemWithOptions,
        optionsNote: optionKey,
        selectedSugar: options.isDrink ? options.sugar : undefined,
        selectedIce: options.isDrink ? options.ice : undefined,
        selectedToppings: options.isDrink ? (options.toppings || []) : [],
        optionKey: optionKey,
        itemDiscountType: options.itemDiscountType || null,
        itemDiscountValue: options.itemDiscountValue || 0,
      },
      quantity: options.quantity || 1,
      options: options,
    };

    setCart(prev => {
      const idx = prev.findIndex(i => (i.cartId || i.item.id) === cartItemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + (options.quantity || 1) };
        return next;
      }
      return [...prev, newItem];
    });
  };

  const addToCart = (item: any) => {
    handleOpenItemModal(item);
  };

  const updateQuantity = (cartKey: string, delta: number) => {
    const existing = cart.find(i => (i.cartId || i.item.id) === cartKey);
    if (!existing) return;
    const newQty = existing.quantity + delta;

    if (newQty <= 0) {
      removeFromCart(cartKey);
      return;
    }

    setCart(prev => prev.map(i => (i.cartId || i.item.id) === cartKey ? { ...i, quantity: newQty } : i));
  };

  const removeFromCart = (cartKey: string) => {
    setCart(prev => prev.filter(i => (i.cartId || i.item.id) !== cartKey));
  };

  const getItemDiscount = (item: CartItem): number => {
    if (!item.item.itemDiscountType || !item.item.itemDiscountValue || item.item.itemDiscountValue <= 0) return 0;
    const unitPrice = item.item.price;
    if (item.item.itemDiscountType === 'PERCENT') {
      return Math.round(unitPrice * Math.min(item.item.itemDiscountValue, 100) / 100) * item.quantity;
    }
    return Math.min(item.item.itemDiscountValue, unitPrice) * item.quantity;
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  const getItemDiscountTotal = () => cart.reduce((sum, item) => sum + getItemDiscount(item), 0);
  const getSubtotalAfterItemDiscount = () => Math.max(0, getSubtotal() - getItemDiscountTotal());
  const getTax = () => getSubtotalAfterItemDiscount() * 0.1;
  const getTotal = () => getSubtotalAfterItemDiscount() + getTax();

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

  const handleLookupPosCustomer = async (phoneToLookup?: string) => {
    const targetPhone = phoneToLookup !== undefined ? phoneToLookup : posCustomerPhone;
    const cleanPhone = targetPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      setPosCustomerData(null);
      return;
    }
    setIsCheckingPosPhone(true);
    try {
      const res = await fetch(`${API_URL}/api/customer/lookup-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, sessionId }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setPosCustomerData(result.data);
        if (result.data.points > 0) {
          setPosUsePoints(true);
          setPosPointsToUse(result.data.points);
        }
      } else {
        setPosCustomerData(null);
      }
    } catch (err) {
      console.error('[handleLookupPosCustomer] error:', err);
    } finally {
      setIsCheckingPosPhone(false);
    }
  };

  const posTierDiscount = useMemo(() => {
    if (!posCustomerData?.membershipTier?.discountPercent || posCustomerData.membershipTier.discountPercent <= 0) return 0;
    return Math.round((getSubtotal() * posCustomerData.membershipTier.discountPercent) / 100);
  }, [posCustomerData, cart]);

  const posPointsDiscount = useMemo(() => {
    if (!posCustomerData || !posUsePoints) return 0;
    const rate = posCustomerData.pointRedeemRate || 100;
    const requested = typeof posPointsToUse === 'number' && posPointsToUse >= 0 ? posPointsToUse : posCustomerData.points;
    const validPoints = Math.min(posCustomerData.points, requested);
    return Math.min(validPoints * rate, Math.max(0, getSubtotal() - posTierDiscount));
  }, [posCustomerData, posUsePoints, posPointsToUse, cart, posTierDiscount]);

  const totalDiscountInModal = useMemo(() => {
    return (voucherData?.discountAmount ?? 0) + posTierDiscount + posPointsDiscount;
  }, [voucherData, posTierDiscount, posPointsDiscount]);

  const modalFinalTotal = useMemo(() => {
    return Math.max(0, getTotal() - totalDiscountInModal);
  }, [cart, totalDiscountInModal]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const newSessionId = await handleCreateTakeawaySession();
      if (!newSessionId) return;
      activeSessionId = newSessionId;
    }
    setVoucherCode("");
    setVoucherData(null);
    setVoucherError(null);
    setPaymentMethod(null);
    setPosCustomerPhone("");
    setPosCustomerData(null);
    setPosUsePoints(false);
    setPosPointsToUse(0);
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

  const handleConfirmPayment = async (shouldPrint: boolean = false) => {
    if (cart.length === 0 || !sessionId || !paymentMethod) return;

    setActionLoading(true);

    const baseAmount = getSubtotal();
    const discountAmount = totalDiscountInModal;
    const finalTotal = modalFinalTotal;

    const currentSessionId = sessionId;

    const cleanPhoneInput = posCustomerPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    const validPhone = posCustomerData?.phone || (cleanPhoneInput.length >= 9 && cleanPhoneInput.length <= 12 ? cleanPhoneInput : undefined);

    const selectedTable = tables.find(t => t.id === selectedTableId || (t as any).tableId === selectedTableId);
    const existingOrderNo = (selectedTable as any)?.session?.orderNo || (selectedTable as any)?.orderNo;

    const saveToCashierArchived = (sId: string, orderNoStr?: string) => {
      try {
        const stored = localStorage.getItem("cashier_archived_sessions") || "[]";
        const validData = JSON.parse(stored);
        const existingList = Array.isArray(validData) ? validData : [];

        if (existingList.some((item: any) => item.id === sId)) return;

        const newArchived = {
          id: sId,
          orderNo: orderNoStr || existingOrderNo || undefined,
          tableNumber: (selectedTable as any)?.tableNumber || (selectedTable as any)?.number || 0,
          tableLabel: selectedTable?.label || (selectedTable as any)?.tableLabel || (selectedTable as any)?.tableNumber || "POS",
          total: finalTotal,
          status: "PAID",
          closedAt: new Date().toISOString(),
          items: cart.map(c => ({
            id: c.item.id,
            name: c.item.name,
            qty: c.quantity,
            status: "DONE",
            unitPrice: Number(c.item.price),
          })),
        };

        const updated = [newArchived, ...existingList];
        localStorage.setItem("cashier_archived_sessions", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("[POS] Lỗi lưu archived session:", err);
      }
    };

    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/payment/sessions/${currentSessionId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || ""}`,
        },
        body: JSON.stringify({
          method: paymentMethod,
          voucherId: voucherData?.id,
          customerPhone: validPhone,
          usePoints: posCustomerData && posUsePoints ? true : false,
          pointsToUse: posUsePoints && typeof posPointsToUse === 'number' ? posPointsToUse : undefined,
          subtotal: baseAmount,
          discountAmount,
          total: finalTotal,
          keepOccupied: true, // POS ALWAYS keeps the table occupied!
          items: cart.map(i => ({ menuItemId: i.item.id, qty: i.quantity, note: i.item.optionsNote || undefined })),
        }),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        if (result.data?.status === 'PENDING' && result.data?.providerData?.qrUrl) {
           setPendingPaymentData({
              paymentId: result.data.paymentId || result.data.payment?.id,
              sessionId: currentSessionId,
              ...result.data.providerData
           });
           setIsPaymentModalOpen(false); // Đóng modal chọn phương thức
        } else {
           // Mã đơn hàng CHÍNH XÁC duy nhất từ máy chủ Backend
           const officialOrderNo = result.data?.orderNo || existingOrderNo || `#${currentSessionId.slice(-6).toUpperCase()}`;
           setCheckoutOrderNo(officialOrderNo);

           if (shouldPrint) {
             triggerPrintReceipt({
               tableLabel: selectedTable?.label || (selectedTable as any)?.tableNumber || "Bàn POS",
               sessionId: currentSessionId,
               orderId: officialOrderNo,
               createdAt: new Date().toLocaleString('vi-VN'),
               items: cart.map(c => {
                 const opts: string[] = [];
                 if (c.item.selectedSugar) opts.push(`Đường: ${c.item.selectedSugar}`);
                 if (c.item.selectedIce) opts.push(`Đá: ${c.item.selectedIce}`);
                 if (c.item.selectedToppings && c.item.selectedToppings.length > 0) opts.push(...c.item.selectedToppings);
                 return {
                   name: c.item.name,
                   qty: c.quantity,
                   unitPrice: Number(c.item.price),
                   selectedOptions: opts.length > 0 ? opts : undefined,
                   note: c.item.optionsNote || undefined,
                 };
               }),
               subtotal: baseAmount,
               discount: discountAmount,
               finalTotal: finalTotal,
               paymentMethod: paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
               customerName: posCustomerData?.phone || validPhone,
             });
           }

           saveToCashierArchived(currentSessionId, officialOrderNo);
           setShowCheckoutSuccess(true);
           setSessionId("");
           setSelectedTableId("");
           setCart([]);
           setIsPaymentModalOpen(false);
           fetchData(); // reload tables ngầm
        }
      } else {
        toast.error(result.message || "Không thể thực hiện thanh toán");
      }
    } catch (err) {
      console.error("[POS] Lỗi kết nối server khi thanh toán:", err);
      toast.error("Lỗi kết nối server khi thanh toán.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualConfirm = async () => {
    if (!pendingPaymentData) return;
    setIsConfirmingPending(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/payment/${pendingPaymentData.paymentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || ""}`,
        },
        body: JSON.stringify({ keepOccupied: true })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setCheckoutOrderNo(result.data?.orderNo || `#${pendingPaymentData.sessionId.slice(-6).toUpperCase()}`);
        
        try {
          const stored = localStorage.getItem("cashier_archived_sessions") || "[]";
          const validData = JSON.parse(stored);
          const existingList = Array.isArray(validData) ? validData : [];
          if (!existingList.some((item: any) => item.id === pendingPaymentData.sessionId)) {
            const newArchived = {
              id: pendingPaymentData.sessionId,
              orderNo: result.data?.orderNo || undefined,
              tableNumber: 0,
              tableLabel: "POS",
              total: pendingPaymentData.total || 0,
              status: "PAID",
              closedAt: new Date().toISOString(),
              items: [],
            };
            localStorage.setItem("cashier_archived_sessions", JSON.stringify([newArchived, ...existingList]));
            window.dispatchEvent(new Event("storage"));
          }
        } catch (err) {
          console.error("[POS] Error archiving manual confirm:", err);
        }

        setPendingPaymentData(null);
        setShowCheckoutSuccess(true);
        // Clean session
        setSessionId("");
        setSelectedTableId("");
        setCart([]);
        fetchData(); // reload tables
      } else {
        alert(result.message || "Không thể thanh toán");
      }
    } catch (e) {
      console.error('[POS] Lỗi xác nhận thủ công:', e);
      alert('Lỗi kết nối server.');
    } finally {
      setIsConfirmingPending(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  return (
    <div className="min-h-screen lg:h-screen bg-zinc-950 flex flex-col font-sans relative lg:overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <Link href="/" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-bold tracking-tight text-sm sm:text-lg text-white">POS Cashier</span>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 sm:gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('tables')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'tables'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Bàn</span>
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>Gọi món</span>
            </button>
            <button
              onClick={() => setActiveTab('cashier')}
              className={`relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'cashier'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Thu ngân</span>
              {pendingOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-lg shadow-rose-500/30 animate-in zoom-in duration-150">
                  {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setDisableSound(!disableSound)}
              className={`text-xs border px-2 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0 ${
                disableSound
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              {disableSound ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{disableSound ? 'Bật âm báo' : 'Tắt âm báo'}</span>
            </button>
          </div>
        </div>

        {/* Selected table indicator when in menu tab */}
        {activeTab === 'menu' && (selectedTableId || sessionId) && (
          <div className="border-t border-zinc-900/60 bg-zinc-950/40 px-3 sm:px-6 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                Đang phục vụ:{' '}
                <span className="font-bold text-zinc-200">
                  {selectedTableId === 'takeaway' || (!tables.find(t => t.id === selectedTableId) && sessionId)
                    ? (takeawayLabel || 'Mang về')
                    : (tables.find(t => t.id === selectedTableId)?.label || selectedTableId)}
                </span>
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ========== TAB: BÀN (Table Grid) ========== */}
      <div className={`flex-1 min-h-0 max-w-7xl w-full mx-auto p-3 sm:p-6 overflow-y-auto ${activeTab === 'tables' ? 'block' : 'hidden'}`}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Chọn bàn phục vụ</h2>
            {(selectedTableId || sessionId) && (
              <button
                type="button"
                onClick={handleDeselectTable}
                disabled={isCancelling}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 px-3 py-1.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Đang huỷ..." : "Huỷ Bàn"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {tables.map(table => {
              const isExcess = table.isExcess;
              const isOccupied = table.status === 'OCCUPIED';
              const isReserved = table.status === 'RESERVED';
              const isAvailable = table.status === 'AVAILABLE' || table.status === 'EMPTY' || !isOccupied && !isReserved;
              const isCurrentTable = table.id === selectedTableId;
              const isBlocked = selectedTableId && !isCurrentTable && isAvailable;

              return (
                <button
                  key={table.id}
                  onClick={() => {
                    if (isExcess) return;
                    handleSelectTable(table.id);
                  }}
                  disabled={isExcess || isOccupied || selectingTableId === table.id || !!isBlocked || isCancelling}
                  className={`relative group flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    isExcess
                      ? 'bg-red-950/10 border-red-900/30 text-red-400 cursor-not-allowed opacity-50 grayscale'
                      : isOccupied
                        ? 'bg-rose-500/5 border-rose-500/20 text-rose-400 cursor-not-allowed opacity-70'
                        : selectingTableId === table.id
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : isReserved
                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                            : isCurrentTable
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10'
                              : isBlocked
                                ? 'bg-zinc-900/30 border-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                                : 'bg-zinc-900/30 border-zinc-800 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 active:scale-[0.97]'
                  }`}
                >
                  {/* Table number */}
                  <span className="text-2xl sm:text-3xl font-black tracking-tight">
                    {table.tableNumber || table.label?.replace('Bàn ', '') || '?'}
                  </span>
                  <span className="text-[10px] font-medium mt-1 opacity-80">
                    {table.label || `Bàn ${table.tableNumber || ''}`}
                  </span>

                  {/* Status badge */}
                  <span className={`mt-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isOccupied
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : selectingTableId === table.id
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : isCurrentTable
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                          : isBlocked
                            ? 'bg-zinc-500/10 text-zinc-500 border-zinc-700'
                            : isReserved
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {selectingTableId === table.id ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Đang chọn...
                      </span>
                    ) : isCurrentTable ? 'Đang PV' : isOccupied ? 'Có khách' : isBlocked ? 'Đã chọn bàn khác' : isReserved ? 'Đã đặt' : 'Trống'}
                  </span>
                </button>
              );
            })}
          </div>

          {tables.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <p className="text-sm font-light">Không có bàn nào. Vui lòng tải lại trang.</p>
            </div>
          )}
          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          )}
        </div>
      {/* ========== TAB: GỌI MÓN (Menu + Cart) ========== */}
      <div className={`flex-1 min-h-0 flex flex-col lg:flex-row overflow-x-hidden max-w-7xl w-full mx-auto p-3 sm:p-4 gap-4 sm:gap-6 ${activeTab === 'menu' ? 'flex' : 'hidden'}`}>
          
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
                    onClick={() => handleOpenItemModal(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenItemModal(item);
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
                    Trống
                  </p>
                </div>
              ) : (
                cart.map(cartItem => {
                  const itemKey = cartItem.cartId || cartItem.item.id;
                  return (
                    <div
                      key={itemKey}
                      className="flex gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/50 group hover:border-zinc-700/60 transition-colors"
                    >
                      {cartItem.item.imageUrl ? (
                        <img 
                          src={cartItem.item.imageUrl} 
                          alt={cartItem.item.name} 
                          className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm border border-zinc-800/80" 
                        />
                      ) : (
                        <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr ${cartItem.item.bgColor || 'from-amber-500/20 to-orange-500/20'} border border-amber-500/20 flex items-center justify-center text-lg shadow-sm text-amber-400 font-bold`}>
                          {cartItem.item.emoji || '🍹'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-semibold text-xs text-zinc-100 truncate block">{cartItem.item.name}</span>
                          <button
                            onClick={() => removeFromCart(itemKey)}
                            aria-label={`Xóa ${cartItem.item.name}`}
                            className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {cartItem.item.optionsNote ? (
                          <div className="text-[10px] text-blue-300 font-medium mt-1 space-y-0.5">
                            {String(cartItem.item.optionsNote)
                              .replace(/📝?\s*Ghi chú:\s*/gi, '')
                              .split(/•|;|\||\n/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((line, idx) => (
                                <div key={idx} className="leading-tight">
                                  <span>{line}</span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          (cartItem.item.selectedSugar || cartItem.item.selectedIce || (cartItem.item.selectedToppings && cartItem.item.selectedToppings.length > 0)) && (
                            <div className="text-[10px] text-blue-300 font-medium mt-1 space-y-0.5">
                              {(cartItem.item.selectedSugar || cartItem.item.selectedIce) && (
                                <div className="text-blue-300 font-medium">
                                  {cartItem.item.selectedSugar && <span>Đường: {cartItem.item.selectedSugar}</span>}
                                  {cartItem.item.selectedSugar && cartItem.item.selectedIce && <span> • </span>}
                                  {cartItem.item.selectedIce && <span>Đá: {cartItem.item.selectedIce}</span>}
                                </div>
                              )}
                              {cartItem.item.selectedToppings && cartItem.item.selectedToppings.length > 0 && (
                                <div>Topping: {cartItem.item.selectedToppings.join(", ")}</div>
                              )}
                            </div>
                          )
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] text-blue-400 font-bold">
                              {formatCurrency(cartItem.item.price * cartItem.quantity)}
                            </span>
                            {getItemDiscount(cartItem) > 0 && (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full font-mono">
                                -{formatCurrency(getItemDiscount(cartItem))}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(itemKey, -1)}
                              aria-label="Giảm số lượng"
                              className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-mono text-xs text-white min-w-[18px] text-center tabular-nums">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateQuantity(itemKey, 1)}
                              aria-label="Tăng số lượng"
                              className="h-5 w-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: total + CTA */}
            <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4 space-y-3 bg-zinc-900/40">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Tạm tính</span>
                  <span className="font-mono text-zinc-300 tabular-nums">{formatCurrency(getSubtotal())}</span>
                </div>
                {getItemDiscountTotal() > 0 && (
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>Chiết khấu món</span>
                    <span className="font-mono">-{formatCurrency(getItemDiscountTotal())}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Thuế VAT (10%)</span>
                  <span className="font-mono text-zinc-300 tabular-nums">{formatCurrency(getTax())}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-800">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  Tổng hóa đơn
                </span>
                <span className="font-mono font-extrabold text-lg text-blue-400 tabular-nums">
                  {formatCurrency(getTotal())}
                </span>
              </div>

               <button
                 onClick={handleCheckout}
                 disabled={cart.length === 0 || actionLoading}
                 className={`
                   w-full h-12 rounded-2xl font-bold text-sm
                   flex items-center justify-center gap-2
                   transition-all duration-150
                   ${cart.length > 0 && !actionLoading
                     ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] cursor-pointer'
                     : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                   }
                 `}
               >
                 {actionLoading && (
                   <Loader2 className="h-4.5 w-4.5 animate-spin" />
                 )}
                 {actionLoading 
                   ? 'Đang xử lý...' 
                   : cart.length === 0
                     ? 'Chưa có món nào'
                     : 'Thanh toán'}
               </button>
            </div>
          </aside>
        </div>

      {/* ========== TAB: THU NGÂN (Cashier) ========== */}
      <div className={`flex-1 min-h-0 max-w-7xl w-full mx-auto p-3 sm:p-6 overflow-y-auto ${activeTab === 'cashier' ? 'block' : 'hidden'}`}>
          {cashierUser ? (
            <CashierClient 
              user={cashierUser} 
              initialTables={[]} 
              initialSessionItems={null} 
              initialSelectedSessionId={null} 
              errorMsg={null}
              disableSound={disableSound}
              onPendingCountChange={setPendingOrderCount}
            />
          ) : (
            <div className="flex items-center justify-center py-20 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải thông tin người dùng...</span>
            </div>
          )}
        </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && sessionId && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-0 animate-in fade-in duration-200">
          <div className="w-full h-full max-w-none rounded-none border-none bg-zinc-950 shadow-none flex flex-col overflow-hidden text-zinc-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900">
              <div>
                <div className="text-lg font-bold text-white tracking-tight">💳 Thanh Toán Hóa Đơn (POS)</div>
                <div className="text-sm text-zinc-500 mt-1">
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

            <div className="overflow-y-auto px-6 py-5 flex-1 grid grid-cols-[200px_1fr] gap-6">
              {/* Phuong thuc thanh toan - cot ben trai */}
              <div className="flex flex-col gap-3 pt-0">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Phương thức thanh toán</div>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`rounded-2xl border py-5 flex flex-col items-center gap-2 transition-all duration-200 ${paymentMethod === "CASH"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                >
                  <span className="text-3xl">💵</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Tiền mặt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("TRANSFER")}
                  className={`rounded-2xl border py-5 flex flex-col items-center gap-2 transition-all duration-200 ${paymentMethod === "TRANSFER"
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                >
                  <span className="text-3xl">📲</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Chuyển khoản</span>
                </button>
              </div>

              <div className="space-y-5">
                {/* Nhập SĐT tích điểm */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tích điểm / Khách hàng (SĐT)</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập SĐT khách hàng..."
                      value={posCustomerPhone}
                      onChange={(e) => {
                        setPosCustomerPhone(e.target.value);
                        setPosCustomerData(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLookupPosCustomer();
                        }
                      }}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleLookupPosCustomer()}
                      disabled={isCheckingPosPhone}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isCheckingPosPhone ? "..." : "Tra cứu"}
                    </button>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3 text-xs space-y-2 h-[104px] flex flex-col justify-center">
                    {isCheckingPosPhone ? (
                      <div className="flex items-center justify-center gap-2 text-zinc-400 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang tra cứu...</span>
                      </div>
                    ) : posCustomerData ? (
                      <div className="text-blue-300 space-y-1.5">
                        <div className="flex items-center justify-between font-medium gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>Khách: <strong className="text-white">{posCustomerData.phone}</strong></span>
                            {posCustomerData.membershipTier ? (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-900 shadow-sm"
                                style={{ backgroundColor: posCustomerData.membershipTier.color || '#ffd700' }}
                              >
                                Hạng {posCustomerData.membershipTier.name} {posCustomerData.membershipTier.discountPercent > 0 ? `(-${posCustomerData.membershipTier.discountPercent}%)` : ''}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                                Thành viên
                              </span>
                            )}
                          </div>
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0">
                            {posCustomerData.points} điểm
                          </span>
                        </div>

                        {posCustomerData.points > 0 ? (
                          <div className="pt-1.5 border-t border-blue-500/20 space-y-1.5">
                            <label className="flex items-center justify-between cursor-pointer select-none">
                              <span className="text-[11px] font-semibold text-blue-200">Dùng điểm giảm giá</span>
                              <input
                                type="checkbox"
                                checked={posUsePoints}
                                onChange={(e) => setPosUsePoints(e.target.checked)}
                                className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                              />
                            </label>

                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] transition-colors ${posUsePoints ? 'text-zinc-400' : 'text-zinc-600'}`}>Số điểm:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={posCustomerData.points}
                                  disabled={!posUsePoints}
                                  value={posPointsToUse}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Math.max(0, Math.min(posCustomerData.points, Number(e.target.value)));
                                    setPosPointsToUse(val);
                                  }}
                                  className={`w-20 bg-zinc-950 border rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold transition-all focus:outline-none ${
                                    posUsePoints 
                                      ? 'border-blue-500/40 text-blue-300 opacity-100' 
                                      : 'border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                                  }`}
                                />
                                <span className={`text-[11px] transition-colors ${posUsePoints ? 'text-zinc-400' : 'text-zinc-600'}`}>điểm</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-blue-400/80 pt-1">
                            ✨ Thanh toán xong sẽ tự động cộng điểm cho SĐT này!
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-zinc-600 text-xs font-medium py-2">
                        Trống
                      </div>
                    )}
                  </div>
                </div>

                {/* Voucher */}
                <div className="space-y-3 relative">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mã giảm giá</div>
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
                        onFocus={() => {
                          if (!voucherData) setShowVoucherDropdown(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            if (voucherCode.trim() && !voucherData) handleValidateVoucher();
                          }, 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleValidateVoucher();
                            setShowVoucherDropdown(false);
                          }
                        }}
                        placeholder="Nhập hoặc chọn voucher..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 transition-all font-mono uppercase"
                      />
                      {voucherData || voucherCode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVoucherCode("");
                            setVoucherData(null);
                            setVoucherError(null);
                            setShowVoucherDropdown(false);
                          }}
                          className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Xóa voucher"
                        >
                          ✕
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                          className="absolute right-2.5 top-2.5 text-[9px] text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        >
                          ▼
                        </button>
                      )}

                      {!voucherData && showVoucherDropdown && (
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
                                    className="w-full text-left px-3 py-2 hover:bg-zinc-850 transition-colors flex items-center justify-between text-xs cursor-pointer"
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
                  </div>

                  {voucherError && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-[11px] text-rose-400 animate-in fade-in duration-200">
                      ✕ {voucherError}
                    </div>
                  )}
                </div>

                {/* Tổng kết - đồng bộ font */}
                <div className="flex flex-col gap-2 pt-4 border-t border-zinc-900 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tạm tính</span>
                    <span className="font-mono text-zinc-300">{formatCurrency(getSubtotal())}</span>
                  </div>
                  {getItemDiscountTotal() > 0 && (
                    <div className="flex justify-between text-rose-400">
                      <span>Chiết khấu món</span>
                      <span className="font-mono">-{formatCurrency(getItemDiscountTotal())}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-medium transition-colors ${totalDiscountInModal > 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                    <span>
                      Giảm giá
                      {posTierDiscount > 0 ? ` (Hạng ${posCustomerData?.membershipTier?.name} -${posCustomerData?.membershipTier?.discountPercent}%)` : ''}
                      {posPointsDiscount > 0 ? ` (Tích điểm ${typeof posPointsToUse === 'number' ? posPointsToUse : (posCustomerData?.points || 0)} điểm)` : ''}
                    </span>
                    <span className="font-mono">
                      {totalDiscountInModal > 0 ? `-${formatCurrency(totalDiscountInModal)}` : '0 đ'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thuế VAT (10%)</span>
                    <span className="font-mono text-zinc-300">{formatCurrency(getTax())}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-200 mt-1 pt-2 border-t border-zinc-800/50">
                    <span>Tổng cộng</span>
                    <span className="font-mono text-zinc-200">{formatCurrency(modalFinalTotal)}</span>
                  </div>
                </div>

                {/* Tổng thanh toán */}
                <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-5 py-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Tổng thanh toán</span>
                  <span className="text-2xl font-black text-blue-400 font-mono min-w-[120px] text-right">
                    {formatCurrency(modalFinalTotal)}
                  </span>
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={actionLoading}
                    className="px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white py-3.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(false)}
                    disabled={!paymentMethod || actionLoading}
                    className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white py-3.5 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Xác nhận"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(true)}
                    disabled={!paymentMethod || actionLoading}
                    className="flex-[1.2] rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3.5 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-500 disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      "Xác nhận & In HĐ"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Payment QR Modal */}
      {pendingPaymentData && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-zinc-800/90 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
            <div className="p-6 border-b border-zinc-800 text-center relative">
               <h3 className="font-bold text-2xl text-white">Chờ Thanh Toán VietQR</h3>
               <button 
                 onClick={() => setPendingPaymentData(null)}
                 className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
               >
                 <X className="h-6 w-6" />
               </button>
            </div>
            <div className="p-8 flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="bg-white rounded-3xl shrink-0 shadow-2xl w-[300px] h-[380px] overflow-hidden relative">
                 <img src={pendingPaymentData.qrUrl} alt="VietQR" className="w-[110%] max-w-none h-auto absolute left-1/2 -translate-x-1/2 top-0" />
              </div>
              <div className="text-left space-y-3 flex-1 w-full border border-zinc-800/50 bg-zinc-800/20 rounded-3xl p-6">
                 <p className="text-zinc-400 text-sm">Ngân hàng: <br/><span className="text-white font-semibold text-lg">{pendingPaymentData.bankName}</span></p>
                 <p className="text-zinc-400 text-sm mt-2">Số TK: <br/><span className="text-white font-bold text-2xl tracking-wider text-blue-300">{pendingPaymentData.accountNumber}</span></p>
                 <p className="text-zinc-400 text-sm mt-2">Chủ TK: <br/><span className="text-white font-semibold text-lg">{pendingPaymentData.accountName}</span></p>
                 <div className="mt-6 border-t border-zinc-800 pt-6">
                   <p className="text-zinc-400 text-base mb-1">Tổng tiền thanh toán</p>
                   <span className="text-blue-400 font-black text-4xl drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]">{formatCurrency(pendingPaymentData.total || getTotal())}</span>
                 </div>
              </div>
            </div>
            <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex gap-4">
              <button
                onClick={() => setPendingPaymentData(null)}
                className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-white hover:bg-zinc-800 py-4 text-base font-bold uppercase tracking-wider transition-all"
              >
                Đóng lại
              </button>
              <button
                onClick={handleManualConfirm}
                disabled={isConfirmingPending}
                className="flex-[2] rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 text-base font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                {isConfirmingPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Đang xác nhận...</>
                ) : (
                  "XÁC NHẬN"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-8 text-center space-y-8 relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="absolute -top-12 -left-12 h-24 w-24 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
            
            <button 
              onClick={() => setShowCheckoutSuccess(false)}
              className="absolute right-6 top-6 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="h-20 w-20 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10" />
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-2xl text-white">Thanh Toán Thành Công!</h3>
              <p className="text-sm text-zinc-400 max-w-[300px] mx-auto leading-relaxed">
                Hóa đơn đã được ghi nhận. Đơn hàng đã tự động đồng bộ sang màn hình hiển thị nhà bếp (KDS).
              </p>
            </div>

            <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800/80 font-mono text-center">
              <span className="text-xs text-zinc-500 uppercase tracking-widest block mb-1.5">Mã đơn hàng</span>
              <span className="text-white font-bold tracking-wider text-2xl">{checkoutOrderNo}</span>
            </div>

            <button 
              onClick={() => setShowCheckoutSuccess(false)}
              className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-white rounded-2xl py-4 text-sm font-semibold uppercase tracking-wider transition-all"
            >
              Tiếp tục bán hàng
            </button>
          </div>
        </div>
      )}

      {/* Hidden Print Container for POS */}
      <div style={{ display: "none" }}>
        {posPrintData && <ReceiptPrintTemplate ref={posReceiptPrintRef} {...posPrintData} />}
      </div>

      {/* Item Options Modal for Customizing Dishes */}
      <ItemOptionsModal
        isOpen={isOptionsModalOpen}
        item={selectedModalItem}
        modifiers={selectedModalItem?.modifiers || posModifiers}
        onClose={() => {
          setIsOptionsModalOpen(false);
          setSelectedModalItem(null);
        }}
        onAddToCart={handleAddToCartFromModal}
      />
    </div>
  );
}
