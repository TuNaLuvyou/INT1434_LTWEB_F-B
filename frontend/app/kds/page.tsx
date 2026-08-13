"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  X,
  Search,
  Loader2,
  Calendar,
  ChevronDown,
  Volume2,
  VolumeX,
  Printer
} from "lucide-react";
import toast from "react-hot-toast";
import { useReactToPrint } from "react-to-print";
import { KitchenTicketTemplate, KitchenTicketPrintProps } from "@/components/print/KitchenTicketTemplate";
import { useSocket } from "@/hooks/useSocket";
import { getAccessTokenFromCookie } from "@/lib/auth/client";
import { useAuthStore } from "@/stores/auth.store";

interface KDSItem {
  id: string;
  name: string;
  quantity: number;
  status: string;
  note?: string | null;
}

interface KDSOther {
  id: string;
  orderNo: string;
  tableNo: string;
  items: KDSItem[];
  status: "pending" | "preparing" | "ready";
  createdAt: Date;
  timerStartTime: number; // Tối ưu hoá: Lưu timestamp thời gian bắt đầu thay vì đếm liên tục trong state toàn cục
}

interface ArchivedKdsItem {
  id: string;
  name: string;
  quantity: number;
  status: string;
  note?: string | null;
}

interface ArchivedKdsOrder {
  id: string;
  orderNo: string;
  tableNo: string;
  archivedAt: string;
  items: ArchivedKdsItem[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

const getLocalDateString = (date: Date = new Date()) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const formatHeaderDate = (rangeStr: string) => {
  if (!rangeStr) return "";
  if (rangeStr.includes("_")) {
    const [startStr, endStr] = rangeStr.split("_");
    return `${startStr.split("-").reverse().join("-")} đến ${endStr.split("-").reverse().join("-")}`;
  }
  return rangeStr.split("-").reverse().join("-");
};

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

interface KitchenRealtimePayload {
  sessionId: string;
  orderNo?: number | null;
  tableId: string;
  tableNumber?: number;
  tableLabel?: string;
  items: Array<{
    orderItemId: string;
    menuItemId: string;
    menuItemName: string;
    qty: number;
    note?: string;
    status: string;
    createdAt?: string;
  }>;
  createdAt: string;
}

interface KitchenItemRealtimePayload {
  orderItemId: string;
  sessionId: string;
  tableId: string;
  menuItemId?: string;
  menuItemName?: string;
  qty?: number;
  deltaQty?: number;
  note?: string | null;
  removedOrderItemId?: string;
  status: "PREPARING" | "DONE" | "VOID";
  previousStatus?: "PENDING" | "PREPARING" | "DONE" | "VOID";
  updatedAt: string;
}

const getLatestBatchItems = (items: KDSItem[], targetStatuses: string[]) => {
  const matching = items.filter(item => targetStatuses.includes(item.status));
  if (matching.length === 0) return [];

  const timestamps = matching.map(item => new Date((item as any).createdAt || Date.now()).getTime());
  const maxTime = Math.max(...timestamps);

  return matching.filter(item => {
    const itemTime = new Date((item as any).createdAt || Date.now()).getTime();
    return Math.abs(maxTime - itemTime) <= 60000;
  });
};

const renderKdsNoteLines = (noteStr?: string | null, isLineThrough = false) => {
  if (!noteStr) return null;
  const clean = String(noteStr).replace(/📝?\s*Ghi chú:\s*/gi, '');
  const lines = clean
    .split(/•|;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <div className={`text-yellow-400 text-[11px] space-y-0.5 border-t border-zinc-800/40 pt-1 mt-1 font-medium ${isLineThrough ? 'line-through opacity-60' : ''}`}>
      {lines.map((line, idx) => (
        <div key={idx} className="flex items-start gap-1 leading-tight">
          <span className="text-yellow-500/60 font-bold select-none">•</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * TỐI ƯU HÓA BƯỚC 1: Component con độc lập quản lý bộ đếm thời gian
 * Không làm re-render toàn bộ thẻ Kanban hay state `orders` toàn cục mỗi giây
 */
interface OrderTimerProps {
  status: string;
  timerStartTime: number;
}

function OrderTimer({ status, timerStartTime }: OrderTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((Date.now() - timerStartTime) / 1000));
  });

  useEffect(() => {
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - timerStartTime) / 1000)));

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - timerStartTime) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [timerStartTime]);

  const formatTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const getUrgencyColor = (seconds: number, s: string) => {
    if (s === "ready") return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    if (seconds > 600) return "text-rose-400 border-rose-500/20 bg-rose-500/5 animate-pulse"; // > 10m
    if (seconds > 300) return "text-amber-400 border-amber-500/20 bg-amber-500/5"; // > 5m
    return "text-indigo-400 border-indigo-500/20 bg-indigo-500/5";
  };

  const isUrgent = elapsedSeconds > 600;

  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold ${getUrgencyColor(elapsedSeconds, status)}`}>
      {status === "preparing" ? (
        <Flame className="h-3 w-3 text-orange-500 animate-bounce" />
      ) : status === "ready" ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : isUrgent ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span>{formatTimer(elapsedSeconds)}</span>
    </div>
  );
}

export default function KDSPage() {
  const [orders, setOrders] = useState<KDSOther[]>([]);
  const [isVoidingId, setIsVoidingId] = useState<string | null>(null);
  const [rawSessions, setRawSessions] = useState<any[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<ArchivedKdsOrder[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // Printing state & refs for Kitchen Ticket
  const kitchenTicketPrintRef = useRef<HTMLDivElement>(null);
  const [kitchenTicketData, setKitchenTicketData] = useState<KitchenTicketPrintProps | null>(null);

  const handleTriggerKitchenPrint = useReactToPrint({
    contentRef: kitchenTicketPrintRef,
    pageStyle: `
      @page {
        size: 80mm 120mm;
        margin: 0mm;
      }
      @media print {
        html, body {
          width: 80mm !important;
          height: 120mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .kitchen-ticket-root {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  });

  const triggerPrintKitchenTicket = (data: KitchenTicketPrintProps) => {
    setKitchenTicketData(data);
    setTimeout(() => {
      handleTriggerKitchenPrint();
    }, 150);
  };

  // State quản lý Báo hết món
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [featureLocked, setFeatureLocked] = useState(false);
  const [disableSound, setDisableSound] = useState(false);
  const pendingOptimisticRef = useRef<Map<string, { targetStatus: string; updatedAt: number }>>(new Map());

  const fetchMenuItems = async () => {
    setMenuLoading(true);
    setFetchError(null);
    try {
      const accessToken = getAccessTokenFromCookie();
      let tId = '';
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          tId = payload.tenantId || '';
        } catch(e) {}
      }
      
      const bId = user?.currentBranchId || '';

      const url = new URL(`${API_URL}/api/menu`);
      if (tId) url.searchParams.append('tenantId', tId);
      if (bId) url.searchParams.append('branchId', bId);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setCategories(result.data.categories || []);
        setMenuItems(result.data.items || []);
      } else {
        throw new Error(result.message || "Không thể tải danh sách thực đơn");
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
      const bId = user?.currentBranchId || '';
      
      const url = new URL(`${API_URL}/api/kds/orders`);
      if (bId) {
        url.searchParams.append('branchId', bId);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        }
      });
      if (!response.ok) {
        if (response.status === 403) {
          setFeatureLocked(true);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        const now = Date.now();
        const mergedData = result.data.map((session: any) => {
          const updatedItems = session.orderItems.map((item: any) => {
            const pending = pendingOptimisticRef.current.get(item.id);
            if (pending) {
              if (now - pending.updatedAt < 10000 && item.status !== pending.targetStatus) {
                return { ...item, status: pending.targetStatus };
              } else {
                pendingOptimisticRef.current.delete(item.id);
              }
            }
            return item;
          });
          return { ...session, orderItems: updatedItems };
        });

        setRawSessions(mergedData);
        setFeatureLocked(false);
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
        throw new Error(result.message || "Không thể cập nhật trạng thái món");
      }
      setMenuItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, isSoldOut: !currentSoldOut } : item
        )
      );
      toast.success(result.message || "Đã cập nhật trạng thái món");
    } catch (err: any) {
      console.error("[KDS Menu] Lỗi cập nhật hết món:", err);
      toast.error(err.message || "Đã xảy ra lỗi");
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const { user } = useAuthStore();

  const token = typeof window !== 'undefined' ? (getAccessTokenFromCookie() || undefined) : undefined;
  let tenantId = 'unknown';
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId || 'unknown';
    } catch(e) {}
  }
  
  const branchId = user?.currentBranchId || '';
  
  const { socket: kitchenSocket, isConnected: isKitchenConnected } = useSocket({
    room: branchId ? `tenant:${tenantId}:branch:${branchId}:kitchen` : '',
    token,
  });

  const { socket: menuSocket, isConnected: isMenuConnected } = useSocket({
    room: `tenant:${tenantId}:menu-updates`,
  });

  const playBeep = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      if (!(window as any).__kdsAudioCtx) {
        (window as any).__kdsAudioCtx = new AudioContextCtor();
      }

      const ctx = (window as any).__kdsAudioCtx as AudioContext;
      if (ctx.state === "suspended") {
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
      console.error("[KDS Audio] Error playing chime:", e);
    }
  };

  const totalPending = useMemo(() => {
    return orders.filter(o => o.status === "pending").length;
  }, [orders]);

  useEffect(() => {
    if (disableSound || totalPending === 0) return;
    
    const interval = setInterval(() => {
      playBeep();
    }, 1000); // Ring every 1 second to match POS
    return () => clearInterval(interval);
  }, [totalPending, disableSound]);

  // Listen to menu soldout
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

  // Fetch on mount and reconnect
  useEffect(() => {
    if (isKitchenConnected) {
      fetchKdsOrders();
    }
  }, [isKitchenConnected]);

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Archive Filter States
  const [rangeType, setRangeType] = useState<"today" | "yesterday" | "7days" | "30days" | "90days" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [rangeStartText, setRangeStartText] = useState<string>("");
  const [rangeEndText, setRangeEndText] = useState<string>("");
  const rangeStartInputRef = useRef<HTMLInputElement>(null);
  const rangeEndInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("kds_archived_orders") || "[]";
    try {
      const parsed = JSON.parse(stored) as ArchivedKdsOrder[];
      const validOrders = Array.isArray(parsed) ? parsed : [];
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 95);

      const uniqueOrders = validOrders.filter((order, idx, self) => 
        idx === self.findIndex(o => o.id === order.id)
      );

      const filteredOrders = uniqueOrders.filter(order => {
        const orderDate = new Date(order.archivedAt);
        return orderDate >= cutoffDate;
      });

      setArchivedOrders(filteredOrders);

      if (filteredOrders.length !== validOrders.length) {
        localStorage.setItem("kds_archived_orders", JSON.stringify(filteredOrders));
      }
    } catch {
      setArchivedOrders([]);
    }
  }, []);

  useEffect(() => {
    setCustomDate(getLocalDateString());
  }, []);

  const handleRangeChange = (newRange: typeof rangeType) => {
    setRangeType(newRange);
    setIsDropdownOpen(false);
    
    let targetDate = customDate;
    if (newRange === "today") {
      targetDate = getLocalDateString(new Date());
    } else if (newRange === "yesterday") {
      targetDate = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    }
    
    setCustomDate(targetDate);
  };

  const handleCustomDateApply = (dateStr: string) => {
    setCustomDate(dateStr);
    setRangeType("custom");
    setIsDropdownOpen(false);
  };

  const handleNativeRangeStartChange = (ymdDate: string) => {
    if (ymdDate) {
      setRangeStartText(ymdDate.split("-").reverse().join("-"));
    }
  };

  const handleNativeRangeEndChange = (ymdDate: string) => {
    if (ymdDate) {
      setRangeEndText(ymdDate.split("-").reverse().join("-"));
    }
  };

  const handleRangeSubmit = () => {
    const parsePart = (text: string) => {
      const parts = text.split("-");
      if (parts.length === 3) {
        const day = parts[0].trim().padStart(2, '0');
        const month = parts[1].trim().padStart(2, '0');
        const year = parts[2].trim();
        if (day.length === 2 && month.length === 2 && year.length === 4) {
          const ymd = `${year}-${month}-${day}`;
          const dateTest = new Date(ymd);
          if (!isNaN(dateTest.getTime())) {
            return ymd;
          }
        }
      }
      return null;
    };

    const startYmd = parsePart(rangeStartText);
    const endYmd = parsePart(rangeEndText);

    if (!startYmd || !endYmd) {
      toast.error("Vui lòng nhập đúng định dạng dd-mm-yyyy");
      return;
    }

    if (new Date(startYmd) > new Date(endYmd)) {
      toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }

    handleCustomDateApply(`${startYmd}_${endYmd}`);
  };

  useEffect(() => {
    if (isDropdownOpen) {
      if (customDate && customDate.includes("_")) {
        const [s, e] = customDate.split("_");
        setRangeStartText(s.split("-").reverse().join("-"));
        setRangeEndText(e.split("-").reverse().join("-"));
      } else {
        const todayDmy = getLocalDateString().split("-").reverse().join("-");
        setRangeStartText(todayDmy);
        setRangeEndText(todayDmy);
      }
    }
  }, [isDropdownOpen, customDate]);

  const filteredArchivedOrders = useMemo(() => {
    return archivedOrders.filter(order => {
        const orderDate = new Date(order.archivedAt);
        let startYmd = "";
        let endYmd = "";
        
        if (rangeType === "today") {
            startYmd = endYmd = getLocalDateString(new Date());
        } else if (rangeType === "yesterday") {
            const y = new Date(Date.now() - 24 * 60 * 60 * 1000);
            startYmd = endYmd = getLocalDateString(y);
        } else if (rangeType === "7days") {
            startYmd = getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
            endYmd = getLocalDateString(new Date());
        } else if (rangeType === "30days") {
            startYmd = getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
            endYmd = getLocalDateString(new Date());
        } else if (rangeType === "90days") {
            startYmd = getLocalDateString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
            endYmd = getLocalDateString(new Date());
        } else if (rangeType === "custom") {
            if (customDate.includes("_")) {
                [startYmd, endYmd] = customDate.split("_");
            } else {
                startYmd = endYmd = customDate;
            }
        }

        const sDate = new Date(startYmd);
        const eDate = new Date(endYmd);
        eDate.setHours(23, 59, 59, 999);
        sDate.setHours(0, 0, 0, 0);

        return orderDate >= sDate && orderDate <= eDate;
    });
  }, [archivedOrders, rangeType, customDate]);

  // Listen for socket events (Optimistic UI: hiện ticket tức thì 0ms, GET chạy ngầm ở dưới)
  useEffect(() => {
    if (!kitchenSocket || !isKitchenConnected) return;

    const handleNewTicket = (payload: KitchenRealtimePayload) => {
      if (payload && payload.sessionId && Array.isArray(payload.items) && payload.items.length > 0) {
        setRawSessions((prev) => {
          const existingIndex = prev.findIndex((s) => s.id === payload.sessionId);
          const newItems = payload.items.map((item) => ({
            id: item.orderItemId,
            menuItemId: item.menuItemId,
            menuItem: { id: item.menuItemId, name: item.menuItemName },
            qty: item.qty,
            status: item.status || 'PENDING',
            note: item.note || null,
          }));

          if (existingIndex >= 0) {
            const updated = [...prev];
            const existing = updated[existingIndex];
            const existingItemIds = new Set(existing.orderItems.map((i: any) => i.id));
            const combinedItems = [
              ...existing.orderItems,
              ...newItems.filter((i) => !existingItemIds.has(i.id)),
            ];
            updated[existingIndex] = {
              ...existing,
              orderItems: combinedItems,
            };
            return updated;
          } else {
            const newSession = {
              id: payload.sessionId,
              orderNo: payload.orderNo,
              table: {
                label: payload.tableLabel,
                tableNumber: payload.tableNumber,
              },
              openedAt: payload.createdAt || new Date().toISOString(),
              lockedAt: payload.createdAt || new Date().toISOString(),
              orderItems: newItems,
            };
            return [newSession, ...prev];
          }
        });

        playBeep();
      }
    };

    const handleItemUpdated = (payload: KitchenItemRealtimePayload) => {
      if (payload?.orderItemId && payload?.status) {
        setRawSessions((prev) => {
          return prev.map((session) => {
            if (payload.sessionId && session.id !== payload.sessionId) return session;

            let nextItems = session.orderItems;
            if (payload.removedOrderItemId) {
              nextItems = nextItems.filter((i: any) => i.id !== payload.removedOrderItemId);
            }

            const pending = pendingOptimisticRef.current.get(payload.orderItemId) 
              || (payload.removedOrderItemId ? pendingOptimisticRef.current.get(payload.removedOrderItemId) : null);

            let updated = false;
            nextItems = nextItems.map((item: any) => {
              if (item.id === payload.orderItemId) {
                updated = true;
                
                // Tránh tình trạng giật lùi (downgrade) trạng thái từ DONE về PREPARING do mạng lag API cũ đến sau
                if (pending && pending.targetStatus === 'DONE' && payload.status === 'PREPARING') {
                  return item; 
                }
                if (pending && pending.targetStatus === payload.status) {
                  pendingOptimisticRef.current.delete(payload.orderItemId);
                  if (payload.removedOrderItemId) pendingOptimisticRef.current.delete(payload.removedOrderItemId);
                }
                return { 
                  ...item, 
                  status: payload.status,
                  qty: payload.qty ?? item.qty,
                  note: payload.note ?? item.note
                };
              }
              return item;
            });

            // Nếu món bị gộp hoặc chưa tồn tại trong session hiện tại, thêm vào
            if (!updated && session.id === payload.sessionId) {
              nextItems.push({
                id: payload.orderItemId,
                menuItemId: payload.menuItemId,
                menuItem: { id: payload.menuItemId, name: payload.menuItemName },
                qty: payload.qty || 1,
                status: payload.status,
                note: payload.note || null
              });
            }

            return { ...session, orderItems: nextItems };
          });
        });
      }
    };

    kitchenSocket.on('kitchen:new-ticket', handleNewTicket);
    kitchenSocket.on('kitchen:item-updated', handleItemUpdated);

    return () => {
      kitchenSocket.off('kitchen:new-ticket', handleNewTicket);
      kitchenSocket.off('kitchen:item-updated', handleItemUpdated);
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
        id: oi.id,
        name: oi.menuItem.name,
        quantity: oi.qty,
        status: oi.status,
        note: oi.note
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

      const tableLabel = session.table?.label ? session.table?.label : (session.table?.tableNumber ? `Bàn ${session.table?.tableNumber}` : 'Mang về');
      const timerStartTime = session.lockedAt ? new Date(session.lockedAt).getTime() : new Date(session.openedAt).getTime();

      return {
        id: session.id,
        orderNo: session.orderNo || `ORD-${session.id.substring(0, 4).toUpperCase()}`,
        tableNo: tableLabel,
        items,
        status,
        createdAt: session.lockedAt ? new Date(session.lockedAt) : new Date(session.openedAt),
        timerStartTime // Tối ưu hoá Bước 1: Lưu timestamp tĩnh
      };
    }).filter(Boolean) as KDSOther[];

    setOrders(mappedOrders);
  }, [rawSessions]);

  /**
   * TỐI ƯU HÓA BƯỚC 2: Tiền xử lý dữ liệu các cột Kanban bằng useMemo
   * Tránh tính toán `getLatestBatchItems` & `.filter` dư thừa trực tiếp trong JSX mỗi lần re-render
   */
  const kanbanColumns = useMemo(() => {
    const pendingOrders = orders
      .map(order => {
        const items = getLatestBatchItems(order.items, ['PENDING']);
        return { order, items };
      })
      .filter(group => group.items.length > 0);

    const pendingItemCount = pendingOrders.reduce(
      (sum, group) => sum + group.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    const preparingOrders = orders
      .map(order => {
        const items = getLatestBatchItems(order.items, ['PREPARING']);
        return { order, items };
      })
      .filter(group => group.items.length > 0);

    const preparingItemCount = preparingOrders.reduce(
      (sum, group) => sum + group.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    const readyOrders = orders
      .map(order => {
        const items = getLatestBatchItems(order.items, ['DONE', 'DELIVERED']);
        return { order, items };
      })
      .filter(group => group.items.length > 0);

    const readyItemCount = readyOrders.reduce(
      (sum, group) => sum + group.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    const pendingPreparingCount = pendingItemCount + preparingItemCount;

    return {
      pending: { orders: pendingOrders, itemCount: pendingItemCount },
      preparing: { orders: preparingOrders, itemCount: preparingItemCount },
      ready: { orders: readyOrders, itemCount: readyItemCount },
      pendingPreparingCount,
    };
  }, [orders]);

  /**
   * TỐI ƯU HÓA OPTIMISTIC UI: Cập nhật giao diện NGAY LẬP TỨC (0ms delay), API chạy ngầm ở dưới hệ thống
   */
  const advanceStatus = (sessionId: string, currentStatus: "pending" | "preparing" | "ready") => {
    if (currentStatus === "ready") return;
    
    const targetOldStatus = currentStatus === "pending" ? "PENDING" : "PREPARING";
    const newStatus = currentStatus === "pending" ? "PREPARING" : "DONE";

    // 1. In phiếu bếp ngay lập tức nếu chuyển từ Pending -> Preparing
    if (currentStatus === "pending") {
      const targetOrder = orders.find(o => o.id === sessionId);
      if (targetOrder) {
        const pendingItems = targetOrder.items.filter(i => i.status === "PENDING");
        if (pendingItems.length > 0) {
          triggerPrintKitchenTicket({
            tableLabel: targetOrder.tableNo || "Bàn",
            ticketId: sessionId,
            createdAt: new Date().toLocaleString('vi-VN'),
            items: pendingItems.map(i => ({
              name: i.name,
              qty: i.quantity,
              note: i.note || undefined,
            })),
          });
        }
      }
    }

    // Ghi nhận optimistic updates vào ref để tránh fetchKdsOrders ghi đè khi socket vừa trả về
    const targetSession = rawSessions.find(s => s.id === sessionId);
    if (targetSession) {
      targetSession.orderItems.forEach((item: any) => {
        if (item.status === targetOldStatus) {
          pendingOptimisticRef.current.set(item.id, { targetStatus: newStatus, updatedAt: Date.now() });
        }
      });
    }

    // 2. OPTIMISTIC UPDATE: Đổi trạng thái trên UI NGAY LẬP TỨC (0ms)
    setRawSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          orderItems: session.orderItems.map((item: any) =>
            item.status === targetOldStatus
              ? { ...item, status: newStatus, updatedAt: new Date().toISOString() }
              : item
          ),
        };
      })
    );

    // 3. Âm thầm gửi API cập nhật ở dưới background
    try {
      const accessToken = getAccessTokenFromCookie();
      fetch(`${API_URL}/api/kds/orders/${sessionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({ currentStatus, newStatus }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          console.error("[KDS] Lỗi cập nhật trạng thái ở backend:", result.message);
          toast.error(result.message || "Không thể đồng bộ trạng thái với máy chủ");
        }
      }).catch((err) => {
        console.error("[KDS] Lỗi kết nối khi cập nhật trạng thái:", err);
      });
    } catch (err: any) {
      console.error("[KDS] Lỗi gửi yêu cầu cập nhật:", err);
    }
  };

  const handleVoidKdsItem = async (sessionId: string, orderItemId: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy món "${name}" do hết món không?`)) return;
    setIsVoidingId(orderItemId);

    pendingOptimisticRef.current.set(orderItemId, { targetStatus: "VOID", updatedAt: Date.now() });

    // 1. OPTIMISTIC UPDATE: Đổi trạng thái món sang VOID trên UI NGAY LẬP TỨC (0ms)
    setRawSessions((prev) => {
      const nextSessions = prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextItems = session.orderItems.map((item: any) =>
          item.id === orderItemId ? { ...item, status: "VOID" } : item
        );
        return { ...session, orderItems: nextItems };
      });

      const updatedSession = nextSessions.find((session) => session.id === sessionId);
      if (updatedSession) {
        const allVoided = updatedSession.orderItems.every((item: any) => item.status === "VOID");
        if (allVoided) {
          archiveSession(updatedSession);
          return nextSessions.filter((session) => session.id !== sessionId);
        }
      }

      return nextSessions;
    });

    // 2. Gửi API hủy món ngầm ở dưới background
    try {
      const accessToken = getAccessTokenFromCookie();
      fetch(`${API_URL}/api/kds/sessions/${sessionId}/items/${orderItemId}/void`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken || ''}`,
        },
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          console.error("[KDS] Lỗi hủy món trên DB:", result.message);
          toast.error(result.message || "Không thể hủy món trên máy chủ");
        }
      }).catch((err) => {
        console.error("[KDS] Lỗi kết nối khi hủy món:", err);
      }).finally(() => {
        setIsVoidingId(null);
      });
    } catch (err: any) {
      console.error("[KDS] Lỗi hủy món:", err);
      setIsVoidingId(null);
    }
  };

  /**
   * TỐI ƯU HÓA: Đồng bộ hóa localStorage và xóa khỏi UI ngay lập tức
   */
  const archiveSession = (session: any) => {
    try {
      const itemIdsToArchive = session.orderItems.map((oi: any) => oi.id);
      const existingStr = typeof window !== 'undefined' ? (localStorage.getItem("kds_archived_item_ids") || "[]") : "[]";
      const existingArchived = JSON.parse(existingStr);
      const updatedArchived = Array.from(new Set([...existingArchived, ...itemIdsToArchive]));
      if (typeof window !== 'undefined') {
        localStorage.setItem("kds_archived_item_ids", JSON.stringify(updatedArchived));
      }

      const archiveEntry: ArchivedKdsOrder = {
        id: session.id,
        orderNo: session.orderNo || `ORD-${session.id.substring(0, 4).toUpperCase()}`,
        tableNo: session.table?.label || (session.table?.tableNumber ? `Bàn ${session.table?.tableNumber}` : 'Mang về'),
        archivedAt: new Date().toISOString(),
        items: session.orderItems.map((oi: any) => ({
          id: oi.id,
          name: oi.menuItem.name,
          quantity: oi.qty,
          status: oi.status,
          note: oi.note,
        })),
      };

      setArchivedOrders(prev => {
        const next = [archiveEntry, ...prev];
        const unique = next.filter((order, idx, self) => 
          idx === self.findIndex(o => o.id === order.id)
        );
        if (typeof window !== "undefined") {
          localStorage.setItem("kds_archived_orders", JSON.stringify(unique));
        }
        return unique;
      });

      // Optimistic update đồng bộ cả rawSessions và orders
      setRawSessions(prev => prev.filter(s => s.id !== session.id));
      setOrders(prev => prev.filter(order => order.id !== session.id));
    } catch (err) {
      console.error("[KDS] Error archiving session to localStorage:", err);
    }
  };

  const completeOrder = (sessionId: string) => {
    // 1. OPTIMISTIC UPDATE: Đưa vào Lịch sử & xóa đơn khỏi UI NGAY LẬP TỨC (0ms)
    const session = rawSessions.find(s => s.id === sessionId);
    if (session) {
      archiveSession(session);
    }

    setRawSessions(prev => prev.filter(s => s.id !== sessionId));
    setOrders(prev => prev.filter(o => o.id !== sessionId));

    toast.success("Đã lưu trữ và giao món thành công!");

    // 2. Gửi API hoàn tất/giao món ngầm ở dưới background
    try {
      const accessToken = getAccessTokenFromCookie();
      fetch(`${API_URL}/api/kds/orders/${sessionId}/deliver`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken || ''}`,
        },
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          console.error("[KDS] Lỗi khi giao món trên DB:", result.message);
          toast.error("Không thể đồng bộ giao món lên máy chủ!");
        }
      }).catch((err) => {
        console.error("[KDS] Lỗi kết nối khi lưu trữ:", err);
      });
    } catch (err) {
      console.error("[KDS] Lỗi kết nối khi lưu trữ:", err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Grid Accent */}
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-lg text-white">KDS</span>
              <span className="hidden sm:inline font-bold tracking-tight text-sm sm:text-lg text-white">Kitchen Display</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4">
            <button 
              onClick={() => {
                fetchMenuItems();
                setIsMenuDrawerOpen(true);
              }}
              className="text-xs bg-orange-600/10 border border-orange-500/20 hover:bg-orange-600 hover:text-white px-2 sm:px-3.5 py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 text-orange-400 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ChefHat className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden sm:inline">Báo Hết Món</span>
            </button>
            <button 
              onClick={() => setIsArchiveOpen(true)}
              className="text-xs bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:text-white px-2 sm:px-3.5 py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 text-zinc-300 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lịch sử</span>
            </button>
            <button
              onClick={() => setDisableSound(!disableSound)}
              className={`text-xs border px-2 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                disableSound 
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {disableSound ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{disableSound ? 'Bật âm báo' : 'Tắt âm báo'}</span>
            </button>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse hidden sm:block" />
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">ĐẦU BẾP</span>
          </div>
        </div>
      </header>

      {/* Top Banner Stats */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap gap-3 sm:gap-4 items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
            <span className="text-[10px] sm:text-xs text-zinc-400">Chờ/nấu:</span>
            <span className="font-bold font-mono text-xs sm:text-sm">
              {kanbanColumns.pendingPreparingCount}
            </span>
          </div>
        </div>
      </div>

      {/* Feature Lock Overlay */}
      {featureLocked && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-zinc-950/60" />
          <div className="relative flex flex-col items-center gap-4 max-w-md text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600/20 to-amber-600/20 border border-orange-500/20 flex items-center justify-center">
              <ChefHat className="h-8 w-8 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Tính năng chưa được hỗ trợ</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Gói cước hiện tại của bạn không hỗ trợ KDS (Kitchen Display System). 
              Vui lòng nâng cấp gói cước để sử dụng tính năng này.
            </p>
            <a
              href="/admin/settings"
              className="mt-2 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,88,12,0.3)]"
            >
              Nâng cấp ngay
            </a>
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 relative">
        
        {/* Column 1: PENDING */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-4 sm:p-5 max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Hàng Chờ</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 font-bold border border-zinc-800">
              {kanbanColumns.pending.itemCount} món
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {kanbanColumns.pending.orders.map(({ order, items }) => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-all duration-300 relative group overflow-hidden"
              >
                {/* Hot Alert glow for urgent orders (>10 mins) */}
                {(Date.now() - order.timerStartTime) > 600000 && (
                  <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-rose-500 to-amber-500" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <OrderTimer status={order.status} timerStartTime={order.timerStartTime} />
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-zinc-300 font-medium">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {items.map((item, idx) => (
                      <li key={idx} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/60 flex flex-col gap-1.5 hover:border-zinc-800/80 transition-all duration-300">
                        <div className="flex justify-between items-center text-xs group/item">
                          <span className="text-zinc-400 font-light flex items-center gap-2">
                            {item.name}
                            {(item.status === 'PENDING' || item.status === 'PREPARING') && (
                              <button
                                onClick={() => handleVoidKdsItem(order.id, item.id, item.name)}
                                disabled={isVoidingId === item.id}
                                className="text-[10px] text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200"
                                title="Báo hết món & Huỷ"
                              >
                                {isVoidingId === item.id ? "Đang huỷ..." : "Hết món"}
                              </button>
                            )}
                          </span>
                          <span className="font-mono font-bold text-white bg-zinc-800 border border-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                            x{item.quantity}
                          </span>
                        </div>
                        {renderKdsNoteLines(item.note)}
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
            {kanbanColumns.pending.orders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <ChefHat className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có đơn hàng nào đang chờ nấu.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: PREPARING */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-4 sm:p-5 max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Đang nấu</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-orange-400 font-bold border border-zinc-800">
              {kanbanColumns.preparing.itemCount} món
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {kanbanColumns.preparing.orders.map(({ order, items }) => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-all duration-300 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <OrderTimer status={order.status} timerStartTime={order.timerStartTime} />
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-zinc-300 font-medium">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {items.map((item, idx) => (
                      <li key={idx} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/60 flex flex-col gap-1.5 hover:border-zinc-800/80 transition-all duration-300">
                        <div className="flex justify-between items-center text-xs group/item">
                          <span className="text-zinc-300 font-medium flex items-center gap-2">
                            {item.name}
                            {(item.status === 'PENDING' || item.status === 'PREPARING') && (
                              <button
                                onClick={() => handleVoidKdsItem(order.id, item.id, item.name)}
                                disabled={isVoidingId === item.id}
                                className="text-[10px] text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200"
                                title="Báo hết món & Huỷ"
                              >
                                {isVoidingId === item.id ? "Đang huỷ..." : "Hết món"}
                              </button>
                            )}
                          </span>
                          <span className="font-mono font-bold text-white bg-orange-950/20 border border-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded shrink-0">
                            x{item.quantity}
                          </span>
                        </div>
                        {renderKdsNoteLines(item.note)}
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
            {kanbanColumns.preparing.orders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <Flame className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có món ăn nào đang chế biến.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: READY */}
        <div className="flex flex-col bg-zinc-900/20 border border-zinc-900 rounded-3xl p-4 sm:p-5 max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-210px)] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="font-bold text-sm tracking-wide text-zinc-200 uppercase">Sẵn Sàng</h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-emerald-400 font-bold border border-zinc-800">
              {kanbanColumns.ready.itemCount} món
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {kanbanColumns.ready.orders.map(({ order, items }) => (
              <div 
                key={order.id} 
                className="bg-zinc-900/60 border border-emerald-950/60 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-800 transition-all duration-300 relative overflow-hidden"
              >
                {/* Visual glow on edges for ready orders */}
                <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-xs text-white">{order.orderNo}</span>
                    <OrderTimer status={order.status} timerStartTime={order.timerStartTime} />
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/40 mb-3">
                    <span className="text-xs text-emerald-400 font-semibold">{order.tableNo}</span>
                  </div>

                  <ul className="space-y-2 mb-4 opacity-75">
                    {items.map((item, idx) => (
                      <li key={idx} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/60 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400 line-through decoration-zinc-600">{item.name}</span>
                          <span className="font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                            x{item.quantity}
                          </span>
                        </div>
                        {renderKdsNoteLines(item.note, true)}
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
            {kanbanColumns.ready.orders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <Check className="h-7 w-7 stroke-[1.2] mb-2" />
                <p className="text-xs font-light">Không có đơn hàng nào sẵn sàng trả khách.</p>
              </div>
            )}
          </div>
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

        {/* Archive Modal */}
        {isArchiveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsArchiveOpen(false)}
            />
            <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-7xl mx-4 overflow-hidden shadow-2xl flex flex-col h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-zinc-900 bg-zinc-900/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <Archive className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Lịch sử Giao món</h2>
                    <p className="text-sm text-zinc-400 font-medium">
                      Các đơn hàng đã hoàn tất
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsArchiveOpen(false)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Area */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/50 flex flex-wrap gap-4 items-center justify-between shrink-0">
                <div className="relative">
                  <div 
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-zinc-200">
                      {rangeType === "today" && "Hôm nay"}
                      {rangeType === "yesterday" && "Hôm qua"}
                      {rangeType === "7days" && "7 ngày qua"}
                      {rangeType === "30days" && "30 ngày qua"}
                      {rangeType === "90days" && "90 ngày qua"}
                      {rangeType === "custom" && (customDate ? formatHeaderDate(customDate) : "Tùy chỉnh")}
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-400 ml-2" />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute top-full mt-2 left-0 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[65vh] overflow-y-auto">
                      <div className="p-2 space-y-1">
                        <button onClick={() => handleRangeChange("today")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "today" ? "bg-orange-500/10 text-orange-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                          Hôm nay
                        </button>
                        <button onClick={() => handleRangeChange("yesterday")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "yesterday" ? "bg-orange-500/10 text-orange-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                          Hôm qua
                        </button>
                        <button onClick={() => handleRangeChange("7days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "7days" ? "bg-orange-500/10 text-orange-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                          7 ngày qua
                        </button>
                        <button onClick={() => handleRangeChange("30days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "30days" ? "bg-orange-500/10 text-orange-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                          30 ngày qua
                        </button>
                        <button onClick={() => handleRangeChange("90days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "90days" ? "bg-orange-500/10 text-orange-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                          90 ngày qua
                        </button>
                      </div>

                      <div className="border-t border-zinc-800 p-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Khoảng thời gian tùy chỉnh</label>
                        <div className="space-y-4 mt-3">
                          <div>
                            <span className="text-xs text-zinc-400 mb-1 block">Từ ngày</span>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="dd-mm-yyyy"
                                className="flex-1 bg-zinc-900 border border-zinc-700 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-orange-500 text-white font-mono"
                                value={rangeStartText}
                                onChange={(e) => setRangeStartText(e.target.value)}
                              />
                              <input 
                                ref={rangeStartInputRef}
                                type="date"
                                className="w-10 opacity-0 absolute pointer-events-none"
                                onChange={(e) => handleNativeRangeStartChange(e.target.value)}
                              />
                              <button 
                                onClick={() => rangeStartInputRef.current?.showPicker()}
                                className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl border border-zinc-700 text-zinc-300"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 mb-1 block">Đến ngày</span>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="dd-mm-yyyy"
                                className="flex-1 bg-zinc-900 border border-zinc-700 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-orange-500 text-white font-mono"
                                value={rangeEndText}
                                onChange={(e) => setRangeEndText(e.target.value)}
                              />
                              <input 
                                ref={rangeEndInputRef}
                                type="date"
                                className="w-10 opacity-0 absolute pointer-events-none"
                                onChange={(e) => handleNativeRangeEndChange(e.target.value)}
                              />
                              <button 
                                onClick={() => rangeEndInputRef.current?.showPicker()}
                                className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl border border-zinc-700 text-zinc-300"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={handleRangeSubmit}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded-xl transition-colors"
                          >
                            Áp dụng khoảng thời gian
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                {filteredArchivedOrders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredArchivedOrders.map((order, idx) => {
                      const doneCount = order.items.filter(item => item.status === "DONE").length;
                      const voidCount = order.items.filter(item => item.status === "VOID").length;
                      const isCancelled = voidCount === order.items.length;
                      return (
                      <div key={`${order.id}-${idx}`} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col hover:border-zinc-700 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <span className="font-bold text-sm text-zinc-100 flex-1 leading-snug">{order.orderNo}</span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${isCancelled ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>
                            {isCancelled ? "Đã huỷ" : "Đã giao"}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5 mb-4 border-b border-zinc-800/50 pb-4">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-medium">Bàn:</span>
                            <span className="text-zinc-200 font-semibold">{order.tableNo}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-medium">Thời gian hoàn tất:</span>
                            <span className="text-zinc-300 font-mono text-xs">
                              {new Date(order.archivedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {new Date(order.archivedAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Món ăn:</h4>
                            <span className="text-[10px] text-zinc-500">Hoàn tất: {doneCount} | Huỷ: {voidCount}</span>
                          </div>
                          <ul className="space-y-1.5">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="flex flex-col gap-1 text-sm bg-zinc-950/20 p-2.5 rounded-lg border border-zinc-800/40">
                                <div className="flex justify-between items-center">
                                  <span className={`text-zinc-300 ${item.status === 'VOID' ? 'line-through opacity-50' : ''}`}>{item.name}</span>
                                  <span className="font-mono font-bold text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded text-xs">
                                    x{item.quantity}
                                  </span>
                                </div>
                                {renderKdsNoteLines(item.note)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end mt-auto">
                          <button
                            type="button"
                            onClick={() => {
                              triggerPrintKitchenTicket({
                                tableLabel: order.tableNo || "Bàn",
                                ticketId: order.id,
                                createdAt: new Date(order.archivedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                                items: order.items.map(i => ({
                                  name: i.name,
                                  qty: i.quantity,
                                  note: i.note || undefined,
                                })),
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            In lại phiếu bếp
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-12">
                    <Archive className="h-16 w-16 mb-6 opacity-20" />
                    <h3 className="text-xl font-bold text-zinc-400 mb-2">Không có dữ liệu</h3>
                    <p className="text-sm">Chưa có đơn hàng nào trong khoảng thời gian này.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Hidden Print Container for Kitchen Ticket */}
      <div style={{ display: "none" }}>
        {kitchenTicketData && <KitchenTicketTemplate ref={kitchenTicketPrintRef} {...kitchenTicketData} />}
      </div>
    </div>
  );
}
