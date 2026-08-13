"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { Archive, Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Dot, Loader2, X, DollarSign, Sparkles, Plus, Minus, Trash2, Search, Calendar, Printer, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import { useReactToPrint } from "react-to-print";
import { ReceiptPrintTemplate, ReceiptPrintProps } from "@/components/print/ReceiptPrintTemplate";
import { useSocket } from "@/hooks/useSocket";
import type { CashierNewOrderPayload } from "@/types/socket";
import { getAccessTokenFromCookie, decodeTokenPayload } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Role = "ADMIN" | "MANAGER" | "CASHIER";

export interface CashierOverviewTable {
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  tableStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  isExcess?: boolean;
  session: {
    sessionId: string;
    openedAt: string | Date;
    orderNo?: string;
    pendingCount: number;
    preparingCount: number;
    doneCount: number;
    isLocked: boolean;
    pendingPayment?: {
      paymentId: string;
      paymentCode: string;
      total: number;
      provider: string;
      qrUrl?: string;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    } | null;
  } | null;
}

type OrderItemStatus = "PENDING" | "PREPARING" | "DONE" | "DELIVERED" | "VOID";

interface OrderItem {
  id: string;
  sessionId: string;
  menuItemId: string;
  qty: number;
  note: string | null;
  status: OrderItemStatus;
  unitPrice: string | number;
  itemDiscountType?: string | null;
  itemDiscountValue?: string | number | null;
  menuItem: {
    name: string;
    price: string | number;
    imageUrl: string | null;
  };
  createdAt: string | Date;
}

interface SessionItemsResponse {
  sessionId: string;
  openedAt: string | Date;
  orderNo?: string;
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  groups: Record<OrderItemStatus, OrderItem[]>;
}

interface RealtimeSessionItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  qty: number;
  unitPrice: number;
  status: OrderItemStatus;
  note?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
}

interface RealtimeKitchenItemUpdatedPayload {
  orderItemId: string;
  sessionId: string;
  tableId: string;
  menuItemId?: string;
  menuItemName?: string;
  qty?: number;
  deltaQty?: number;
  note?: string | null;
  removedOrderItemId?: string;
  status: OrderItemStatus;
  previousStatus?: OrderItemStatus;
  updatedAt: string;
}

interface Notification {
  id: string;
  type: "new-order" | "all-done" | "soldout-warning";
  message: string;
  sessionId?: string;
  tableNumber?: number;
  createdAt: Date;
  isRead: boolean;
}

interface ArchivedCashierItem {
  id: string;
  name: string;
  qty: number;
  status: OrderItemStatus;
  unitPrice: number;
}

interface ArchivedCashierSession {
  id: string;
  tableNumber: number;
  tableLabel: string;
  total: number;
  status: "PAID" | "CANCELLED";
  closedAt: string;
  items: ArchivedCashierItem[];
}

interface CashierClientProps {
  user: { userId: string; role: Role };
  initialTables: CashierOverviewTable[];
  initialSessionItems: SessionItemsResponse | null;
  initialSelectedSessionId: string | null;
  errorMsg: string | null;
  disableSound?: boolean;
  onPendingCountChange?: (count: number) => void;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const statusLabels: Record<OrderItemStatus, string> = {
  PENDING: "⏳ Chờ duyệt",
  PREPARING: "👨‍🍳 Đang làm",
  DONE: "✓ Xong",
  DELIVERED: "🚚 Đã giao",
  VOID: "✗ Đã hủy",
};

const statusBadgeClass: Record<OrderItemStatus, string> = {
  PENDING: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  PREPARING: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  DONE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  DELIVERED: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  VOID: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
};

function formatShortTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatTimeAgo(value: Date) {
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) return "vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  return formatShortTime(value);
}

function playCashierBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    if (!(window as any).__cashierAudioCtx) {
      (window as any).__cashierAudioCtx = new AudioContextCtor();
    }
    const ctx = (window as any).__cashierAudioCtx;
    
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
  } catch (error) {
    console.error("Audio api error", error);
  }
}

const getLocalDateString = (date: Date = new Date()) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const formatDateToDDMMYYYY = (date: Date) => {
  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const formatHeaderDate = (rangeStr: string) => {
  if (!rangeStr) return "";
  if (rangeStr.includes("_")) {
    const [startStr, endStr] = rangeStr.split("_");
    return `${startStr.split("-").reverse().join("-")} đến ${endStr.split("-").reverse().join("-")}`;
  }
  return rangeStr.split("-").reverse().join("-");
};

function createEmptyGroups(): Record<OrderItemStatus, OrderItem[]> {
  return { PENDING: [], PREPARING: [], DONE: [], DELIVERED: [], VOID: [] };
}

function buildGroupsFromRealtimeItems(items: RealtimeSessionItem[]): Record<OrderItemStatus, OrderItem[]> {
  const groups = createEmptyGroups();
  for (const item of items) {
    const orderItem: OrderItem = {
      id: item.id,
      sessionId: "",
      menuItemId: item.menuItemId,
      qty: item.qty,
      note: item.note ?? null,
      status: item.status,
      unitPrice: item.unitPrice,
      itemDiscountType: (item as any).itemDiscountType ?? null,
      itemDiscountValue: (item as any).itemDiscountValue ?? null,
      menuItem: {
        name: item.menuItemName,
        price: item.unitPrice,
        imageUrl: item.imageUrl ?? null,
      },
      createdAt: item.createdAt || new Date().toISOString(),
    };
    groups[item.status].push(orderItem);
  }
  return groups;
}

export default function CashierClient({
  user,
  initialTables,
  initialSessionItems,
  initialSelectedSessionId,
  errorMsg,
  disableSound = false,
  onPendingCountChange,
}: CashierClientProps) {
  const [tables, setTables] = useState<CashierOverviewTable[]>(initialTables);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId);

  const totalPending = useMemo(() => {
    return tables.reduce((sum, t) => sum + (t.session?.pendingCount || 0), 0);
  }, [tables]);

  // Loop sound while there are pending orders
  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(totalPending);
    }

    if (disableSound || totalPending === 0) return;
    
    const interval = setInterval(() => {
      playCashierBeep();
    }, 1000); // Ring every 1 second
    return () => clearInterval(interval);
  }, [totalPending, disableSound, onPendingCountChange]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    initialTables.find((table) => table.session?.sessionId === initialSelectedSessionId)?.tableId || null
  );
  const [sessionItems, setSessionItems] = useState<SessionItemsResponse | null>(initialSessionItems);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Auto-fetch tables if initialTables is empty
  useEffect(() => {
    if (initialTables.length > 0) return;
    const fetchOverview = async () => {
      try {
        const token = getAccessTokenFromCookie();
        const res = await fetch(`${API_URL}/api/cashier/overview?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.data?.tables)) {
            setTables(result.data.tables);
          }
        }
      } catch (err) {
        console.error("[CashierClient] Lỗi fetch overview:", err);
      }
    };
    fetchOverview();
  }, []);
  const [activeTab, setActiveTab] = useState<"tables" | "details" | "notifications">(initialSelectedSessionId ? "details" : "tables");
  const [now, setNow] = useState(new Date());
  const [isApproving, setIsApproving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [localErrorMsg, setLocalErrorMsg] = useState<string | null>(errorMsg);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<ArchivedCashierSession[]>([]);
  const [isPaying, setIsPaying] = useState(false);

  // Archive Filter States
  const [rangeType, setRangeType] = useState<"today" | "yesterday" | "7days" | "30days" | "90days" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(getLocalDateString());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tempCustomDateText, setTempCustomDateText] = useState<string>("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [rangeStartText, setRangeStartText] = useState<string>("");
  const [rangeEndText, setRangeEndText] = useState<string>("");
  const rangeStartInputRef = useRef<HTMLInputElement>(null);
  const rangeEndInputRef = useRef<HTMLInputElement>(null);
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
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [isConfirmingPending, setIsConfirmingPending] = useState(false);

  // POS loyalty / customer states
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posCustomerData, setPosCustomerData] = useState<any>(null);
  const [posUsePoints, setPosUsePoints] = useState(false);
  const [posPointsToUse, setPosPointsToUse] = useState<number | "">(0);
  const [isCheckingPosPhone, setIsCheckingPosPhone] = useState(false);
  const [isCreatingTakeaway, setIsCreatingTakeaway] = useState(false);

  const handleCreateTakeawaySession = async () => {
    setIsCreatingTakeaway(true);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/sessions/takeaway`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Đã tạo đơn mang về ${result.data?.session?.orderNo || ""}`);
        const ovRes = await fetch(`${API_URL}/api/cashier/overview?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        if (ovRes.ok) {
          const ovResult = await ovRes.json();
          if (ovResult.success && Array.isArray(ovResult.data?.tables)) {
            setTables(ovResult.data.tables);
          }
        }
        if (result.data?.session?.id) {
          const newSessionId = result.data.session.id;
          setSelectedSessionId(newSessionId);
          setSelectedTableId(newSessionId);
          fetchSessionItems(newSessionId);
          setActiveTab("details");
        }
      } else {
        toast.error(result.message || "Không thể tạo đơn mang về");
      }
    } catch (err) {
      console.error("[handleCreateTakeawaySession] error:", err);
      toast.error("Lỗi kết nối khi tạo đơn mang về");
    } finally {
      setIsCreatingTakeaway(false);
    }
  };

  // Printing state & refs
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<ReceiptPrintProps | null>(null);

  const handleTriggerPrint = useReactToPrint({
    contentRef: receiptPrintRef,
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
    setPrintData(data);
    setTimeout(() => {
      handleTriggerPrint();
    }, 150);
  };

  const token = typeof window !== "undefined" ? getAccessTokenFromCookie() || undefined : undefined;
  let tenantId = 'unknown';
  let branchId = 'unknown';
  if (token) {
    const payload = decodeTokenPayload(token);
    tenantId = payload?.tenantId || 'unknown';
    branchId = payload?.branchId || 'unknown';
  }
  
  const socketRoom = branchId && branchId !== 'unknown' 
    ? `tenant:${tenantId}:branch:${branchId}:cashier` 
    : `tenant:${tenantId}:cashier`;
  const { socket, isConnected } = useSocket({ room: socketRoom, token });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadArchivedSessions = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cashier_archived_sessions") || "[]";
    try {
      const parsed = JSON.parse(stored) as ArchivedCashierSession[];
      const validData = Array.isArray(parsed) ? parsed : [];
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 95);
      
      const uniqueData = validData.filter((session, idx, self) => 
        idx === self.findIndex(s => s.id === session.id)
      );

      const filteredData = uniqueData.filter(session => {
        const sessionDate = new Date(session.closedAt);
        return sessionDate >= cutoffDate;
      });

      setArchivedSessions(filteredData);

      if (filteredData.length !== validData.length) {
        localStorage.setItem("cashier_archived_sessions", JSON.stringify(filteredData));
      }
    } catch {
      setArchivedSessions([]);
    }
  }, []);

  useEffect(() => {
    loadArchivedSessions();
    window.addEventListener("storage", loadArchivedSessions);
    window.addEventListener("focus", loadArchivedSessions);
    return () => {
      window.removeEventListener("storage", loadArchivedSessions);
      window.removeEventListener("focus", loadArchivedSessions);
    };
  }, [loadArchivedSessions]);

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

  const handleNativeDateChange = (ymdDate: string) => {
    if (ymdDate) {
      const dmy = ymdDate.split("-").reverse().join("-");
      setTempCustomDateText(dmy);
    }
  };

  const handleTextInputSubmit = () => {
    const parts = tempCustomDateText.split("-");
    if (parts.length === 3) {
      const day = parts[0].trim().padStart(2, '0');
      const month = parts[1].trim().padStart(2, '0');
      const year = parts[2].trim();
      if (day.length === 2 && month.length === 2 && year.length === 4) {
        const ymd = `${year}-${month}-${day}`;
        const dateTest = new Date(ymd);
        if (!isNaN(dateTest.getTime())) {
          handleCustomDateApply(ymd);
          return;
        }
      }
    }
    toast.error("Vui lòng nhập đúng định dạng ngày dd-mm-yyyy (ví dụ: 30-05-2026)");
  };

  useEffect(() => {
    if (customDate) {
      if (customDate.includes("_")) {
        const [_, end] = customDate.split("_");
        setTempCustomDateText(end.split("-").reverse().join("-"));
      } else {
        setTempCustomDateText(customDate.split("-").reverse().join("-"));
      }
    }
  }, [customDate]);

  useEffect(() => {
    if (isDropdownOpen && customDate) {
      if (customDate.includes("_")) {
        const [_, end] = customDate.split("_");
        setTempCustomDateText(end.split("-").reverse().join("-"));
      } else {
        setTempCustomDateText(customDate.split("-").reverse().join("-"));
      }
    }
  }, [isDropdownOpen, customDate]);

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
      toast.error("Vui lòng nhập đúng định dạng dd-mm-yyyy cho cả hai ngày.");
      return;
    }

    if (new Date(startYmd) > new Date(endYmd)) {
      toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
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

  const filteredArchivedSessions = useMemo(() => {
    return archivedSessions.filter(session => {
        const sessionDate = new Date(session.closedAt);
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

        return sessionDate >= sDate && sessionDate <= eDate;
    });
  }, [archivedSessions, rangeType, customDate]);

  const selectedTable = useMemo(() => {
    return tables.find((table) => table.tableId === selectedTableId || table.session?.sessionId === selectedSessionId) || null;
  }, [tables, selectedTableId, selectedSessionId]);

  const fetchSessionItems = useCallback(async (sessionId: string) => {
    setIsLoadingItems(true);
    try {
      const response = await fetch(`${API_URL}/api/cashier/sessions/${sessionId}/items`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSessionItems(result.data as SessionItemsResponse);
        if (result.data?.pendingPayment) {
          setPendingPaymentData(result.data.pendingPayment);
        }
      } else {
        console.error("[Cashier] fetch session items failed:", result.message);
        setSessionItems(null);
      }
    } catch (error) {
      console.error("[Cashier] fetch session items error:", error);
      setSessionItems(null);
    } finally {
      setIsLoadingItems(false);
    }
  }, [token]);

  const handleSelectSession = useCallback(
    (sessionId: string | null) => {
      setSelectedSessionId(sessionId);
      if (!sessionId) {
        setSessionItems(null);
        return;
      }

      const table = tables.find((item) => item.session?.sessionId === sessionId);
      setSelectedTableId(table?.tableId || null);
      fetchSessionItems(sessionId);
    },
    [fetchSessionItems, tables]
  );

  const handleSelectTable = useCallback(
    (table: CashierOverviewTable) => {
      setSelectedTableId(table.tableId);
      const sessionId = table.session?.sessionId || null;
      setSelectedSessionId(sessionId);
      if (table.session?.pendingPayment) {
        setPendingPaymentData(table.session.pendingPayment);
      } else {
        setPendingPaymentData(null);
      }
      if (!sessionId) {
        setSessionItems(null);
        return;
      }
      fetchSessionItems(sessionId);
    },
    [fetchSessionItems]
  );

  const syncSelectedSessionFromRealtimeItems = useCallback(
    (payload: { sessionId: string; tableId: string; orderItems: RealtimeSessionItem[] }) => {
      setSessionItems((prev) => {
        if (payload.sessionId !== selectedSessionId) return prev;

        const matchedTable = tables.find((table) => table.tableId === payload.tableId);
        const nextGroups = buildGroupsFromRealtimeItems(payload.orderItems);

        return {
          sessionId: payload.sessionId,
          openedAt: prev?.openedAt || matchedTable?.session?.openedAt || new Date().toISOString(),
          tableId: payload.tableId,
          tableNumber: prev?.tableNumber || matchedTable?.tableNumber || 0,
          tableLabel: prev?.tableLabel || matchedTable?.tableLabel || "",
          groups: nextGroups,
        };
      });
    },
    [selectedSessionId, tables]
  );

  const updateTableCountersFromStatusChange = useCallback((payload: RealtimeKitchenItemUpdatedPayload) => {
    const changedQty = payload.deltaQty ?? 1;

    setTables((prev) =>
      prev.map((table) => {
        if (table.session?.sessionId !== payload.sessionId || !table.session) return table;

        const nextSession = { ...table.session };
        const decrementKey =
          payload.previousStatus === "PENDING"
            ? "pendingCount"
            : payload.previousStatus === "PREPARING"
              ? "preparingCount"
              : payload.previousStatus === "DONE"
                ? "doneCount"
                : null;
        const incrementKey =
          payload.status === "PENDING"
            ? "pendingCount"
            : payload.status === "PREPARING"
              ? "preparingCount"
              : payload.status === "DONE"
                ? "doneCount"
                : null;

        if (decrementKey) {
          nextSession[decrementKey] = Math.max(0, nextSession[decrementKey] - changedQty);
        }
        if (incrementKey) {
          nextSession[incrementKey] += changedQty;
        }

        return { ...table, session: nextSession };
      })
    );
  }, []);
  const fetchAvailableVouchers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
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
      console.error("[Cashier] Lỗi tải danh sách voucher:", err);
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
        body: JSON.stringify({ phone: cleanPhone, sessionId: selectedSessionId }),
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

  const handlePaySession = () => {
    if (!selectedSessionId) return;
    setVoucherCode("");
    setVoucherData(null);
    setVoucherError(null);
    setPaymentMethod(null);
    const initialPhone = pendingPaymentData?.customerPhone || "";
    setPosCustomerPhone(initialPhone);
    setPosCustomerData(null);
    setPosUsePoints(false);
    setPosPointsToUse(0);
    if (initialPhone) {
      handleLookupPosCustomer(initialPhone);
    }
    setIsPaymentModalOpen(true);
    fetchAvailableVouchers();
  };

  const handleValidateVoucher = async (codeOverride?: string) => {
    const codeToValidate = codeOverride || voucherCode;
    if (!codeToValidate.trim()) return;
    setIsValidatingVoucher(true);
    setVoucherError(null);
    setVoucherData(null);

    const baseAmount = subtotal;

    try {
      const params = new URLSearchParams({
        code: codeToValidate.trim().toUpperCase(),
        subtotal: String(baseAmount),
      });
      const res = await fetch(`${API_URL}/api/payment/validate-voucher?${params}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
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

  const handleManualConfirm = async () => {
    if (!pendingPaymentData) return;
    setIsConfirmingPending(true);
    try {
      const res = await fetch(`${API_URL}/api/payment/${pendingPaymentData.paymentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ keepOccupied: false })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(`Thanh toán thành công!`);
        setPendingPaymentData(null);
        setIsPaymentModalOpen(false);
        setVoucherCode("");
        setVoucherData(null);
        setPaymentMethod(null);
        
        const currentTableId = selectedTableId;
        const currentSessionId = selectedSessionId;
        
        // Update local session & table list to AVAILABLE (Trống)
        setTables((prev) =>
          prev.map((t) => {
            if (t.tableId === currentTableId || (currentSessionId && t.session?.sessionId === currentSessionId)) {
              return { ...t, tableStatus: "AVAILABLE", session: null };
            }
            return t;
          })
        );
        setSelectedSessionId(null);
        setSelectedTableId(null);
      } else {
        setLocalErrorMsg(result.message || "Không thể thanh toán");
      }
    } catch (e) {
      console.error('[Cashier] Lỗi xác nhận thủ công:', e);
      setLocalErrorMsg('Lỗi kết nối server.');
    } finally {
      setIsConfirmingPending(false);
    }
  };

  const handleConfirmPayment = async (shouldPrint: boolean = false) => {
    if (!selectedSessionId || !paymentMethod) return;
    setIsPaying(true);

    const baseAmount = subtotal;
    const discountAmount = totalDiscountInModal;
    const finalTotal = modalFinalTotal;
    const currentTableId = selectedTableId;
    const currentSessionId = selectedSessionId;

    const cleanPhoneInput = posCustomerPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    const validPhone = posCustomerData?.phone || (cleanPhoneInput.length >= 9 && cleanPhoneInput.length <= 12 ? cleanPhoneInput : undefined);

    try {
      const res = await fetch(`${API_URL}/api/payment/sessions/${selectedSessionId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
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
          keepOccupied: false,
        }),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        if (result.data?.status === 'PENDING' && result.data?.providerData?.qrUrl) {
           setPendingPaymentData({
              paymentId: result.data.paymentId || result.data.payment?.id,
              sessionId: selectedSessionId,
              ...result.data.providerData
           });
           setIsPaying(false);
           return;
        }

        setSuccessMsg(`✓ Thanh toán thành công hóa đơn cho Bàn ${selectedTable?.tableNumber || ""}!`);
        
        // Push to archived sessions for history
        const billItems = [
          ...groupedItems.PENDING,
          ...groupedItems.PREPARING,
          ...groupedItems.DONE,
        ].map(item => ({
          id: item.id,
          name: item.menuItem.name,
          qty: item.qty,
          status: item.status,
          unitPrice: Number(item.unitPrice),
        }));

        const newArchived: ArchivedCashierSession = {
          id: selectedSessionId,
          tableNumber: selectedTable?.tableNumber || 0,
          tableLabel: selectedTable?.tableLabel || "",
          total: finalTotal,
          status: "PAID",
          closedAt: new Date().toISOString(),
          items: billItems,
        };

        const updatedArchived = [newArchived, ...archivedSessions];
        setArchivedSessions(updatedArchived);
        localStorage.setItem("cashier_archived_sessions", JSON.stringify(updatedArchived));

        if (shouldPrint) {
          triggerPrintReceipt({
            tableLabel: selectedTable?.tableLabel || selectedTable?.tableNumber || "Mang về",
            sessionId: selectedSessionId,
            orderId: selectedTable?.session?.orderNo || sessionItems?.orderNo || result.data?.orderNo || undefined,
            createdAt: new Date().toLocaleString('vi-VN'),
            items: billItems,
            subtotal: baseAmount,
            discount: discountAmount,
            finalTotal: finalTotal,
            paymentMethod: paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
            customerName: posCustomerData?.phone || validPhone,
          });
        }

        setIsPaymentModalOpen(false);
        setVoucherCode("");
        setVoucherData(null);
        setPaymentMethod(null);
        
        // Update local session & table list to AVAILABLE (Trống)
        setTables((prev) =>
          prev.map((t) => {
            if (t.tableId === currentTableId || (currentSessionId && t.session?.sessionId === currentSessionId)) {
              return { ...t, tableStatus: "AVAILABLE", session: null };
            }
            return t;
          })
        );
        setSelectedSessionId(null);
        setSelectedTableId(null);

        // Reset cashier screen selection
        setSelectedSessionId(null);
        setSelectedTableId(null);
        setSessionItems(null);
        setIsPaymentModalOpen(false);
      } else {
        alert(result.message || "Không thể thực hiện thanh toán");
      }
    } catch (err) {
      console.error("[Cashier] Lỗi thanh toán:", err);
      alert("Lỗi kết nối server.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedSessionId) return;
    setIsApproving(true);
    setSuccessMsg(null);
    setLocalErrorMsg(null);
    try {
      const response = await fetch(`${API_URL}/api/cashier/sessions/${selectedSessionId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccessMsg(`✓ Đã duyệt đơn hàng thành công! Đã gửi ${result.data?.approvedItemsCount || 0} món xuống bếp.`);
        setTimeout(() => setSuccessMsg(null), 5000);

        setTables((prev) =>
          prev.map((table) => {
            if (table.session?.sessionId !== selectedSessionId) return table;
            return {
              ...table,
              session: table.session
                ? {
                    ...table.session,
                    isLocked: true,
                    pendingCount: 0,
                    preparingCount: (table.session.preparingCount || 0) + (result.data?.approvedItemsCount || 0),
                  }
                : null,
            };
          })
        );

        await fetchSessionItems(selectedSessionId);
      } else {
        setLocalErrorMsg(result.message || "Duyệt đơn hàng thất bại.");
      }
    } catch (error: any) {
      console.error("Lỗi khi duyệt đơn:", error);
      setLocalErrorMsg("Lỗi kết nối server.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAllPending = async () => {
    if (!selectedSessionId || !groupedItems.PENDING.length) return;
    if (!confirm("Bạn có chắc chắn muốn HUỶ TOÀN BỘ đơn hàng chờ duyệt này không?")) return;

    setIsApproving(true);
    setSuccessMsg(null);
    setLocalErrorMsg(null);

    try {
      const voidPromises = groupedItems.PENDING.map((item) =>
        fetch(`${API_URL}/api/cashier/sessions/${selectedSessionId}/items/${item.id}/void`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        })
      );

      await Promise.all(voidPromises);

      setSuccessMsg("✓ Đã huỷ toàn bộ món chờ duyệt thành công.");
      setTimeout(() => setSuccessMsg(null), 5000);

      await fetchSessionItems(selectedSessionId);
    } catch (error: any) {
      console.error("Lỗi khi huỷ đơn hàng:", error);
      setLocalErrorMsg("Lỗi khi huỷ đơn hàng.");
    } finally {
      setIsApproving(false);
    }
  };

  const [isVoiding, setIsVoiding] = useState<string | null>(null);

  const handleVoidItem = async (orderItemId: string) => {
    if (!selectedSessionId) return;
    if (!confirm("Bạn có chắc chắn muốn huỷ món ăn này không? Hệ thống sẽ hoàn lại tồn kho nguyên liệu tương ứng.")) return;
    
    setIsVoiding(orderItemId);
    setSuccessMsg(null);
    setLocalErrorMsg(null);
    
    try {
      const response = await fetch(`${API_URL}/api/cashier/sessions/${selectedSessionId}/items/${orderItemId}/void`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccessMsg(`✓ Đã huỷ món "${result.data?.menuItemName || 'thành công'}" và hoàn trả nguyên liệu.`);
        setTimeout(() => setSuccessMsg(null), 5000);
        
        // Refresh local items state
        const itemsResponse = await fetch(`${API_URL}/api/cashier/sessions/${selectedSessionId}/items`, {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        });

        if (itemsResponse.ok) {
          const itemsResult = await itemsResponse.json();
          if (itemsResult.success) {
            const nextSessionItems = itemsResult.data as SessionItemsResponse;
            setSessionItems(nextSessionItems);

            // Cập nhật pendingCount cho bàn sau khi huỷ
            const allItems = Object.values(nextSessionItems.groups || {}).flat();
            const newPending = allItems.filter((item) => item.status === "PENDING" || item.status === "PREPARING").length;
            setTables((prev) =>
              prev.map((table) => {
                if (table.session?.sessionId !== selectedSessionId) return table;
                return {
                  ...table,
                  session: {
                    ...table.session!,
                    pendingCount: newPending,
                  },
                };
              })
            );

            const allVoided = allItems.length > 0 && allItems.every((item) => item.status === "VOID");

            if (allVoided && !archivedSessions.find((session) => session.id === selectedSessionId)) {
              const archiveEntry: ArchivedCashierSession = {
                id: selectedSessionId,
                tableNumber: nextSessionItems.tableNumber,
                tableLabel: nextSessionItems.tableLabel,
                total: 0,
                status: "CANCELLED",
                closedAt: new Date().toISOString(),
                items: allItems.map((item) => ({
                  id: item.id,
                  name: item.menuItem.name,
                  qty: item.qty,
                  status: item.status,
                  unitPrice: Number(item.unitPrice),
                })),
              };

              const nextArchived = [archiveEntry, ...archivedSessions];
              setArchivedSessions(nextArchived);
              if (typeof window !== "undefined") {
                localStorage.setItem("cashier_archived_sessions", JSON.stringify(nextArchived));
              }
              setSuccessMsg("✓ Tất cả món đã huỷ. Đã lưu vào lịch sử.");
              setTimeout(() => setSuccessMsg(null), 5000);
            }
          }
        }
      } else {
        setLocalErrorMsg(result.message || "Huỷ món thất bại.");
      }
    } catch (error: any) {
      console.error("Lỗi khi huỷ món:", error);
      setLocalErrorMsg("Lỗi kết nối server.");
    } finally {
      setIsVoiding(null);
    }
  };



  const addNotification = useCallback((notification: Omit<Notification, "id" | "createdAt" | "isRead">) => {
    setNotifications((prev) => [
      {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        createdAt: new Date(),
        isRead: false,
        ...notification,
      },
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewOrder = (payload: CashierNewOrderPayload) => {
      const itemCount = payload.newItems?.reduce((sum, item) => sum + item.qty, 0) ?? 0;

      addNotification({
        type: "new-order",
        message: `Bàn ${payload.tableNumber ?? "?"} vừa gửi ${itemCount} món`,
        sessionId: payload.sessionId,
        tableNumber: payload.tableNumber,
      });

      setTables((prev) =>
        prev.map((table) => {
          if (table.tableId !== payload.tableId) return table;
          const currentSession = table.session;
          const nextPending = (currentSession?.pendingCount || 0) + itemCount;

          return {
            ...table,
            session: currentSession
              ? {
                  ...currentSession,
                  pendingCount: nextPending,
                }
              : {
                  sessionId: payload.sessionId,
                  openedAt: payload.createdAt || new Date().toISOString(),
                  pendingCount: nextPending,
                  preparingCount: 0,
                  doneCount: 0,
                  isLocked: false,
                },
          };
        })
      );

      if (!disableSound) {
        playCashierBeep();
      }

      setSessionItems((prev) => {
        if (payload.sessionId !== selectedSessionId || !prev) return prev;
        
        const newOrderItems: OrderItem[] = (payload.newItems || []).map((item) => ({
          id: item.id || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`),
          sessionId: payload.sessionId,
          menuItemId: item.menuItemId,
          qty: item.qty,
          note: item.note || null,
          status: "PENDING",
          unitPrice: item.unitPrice,
          menuItem: {
            name: item.menuItemName,
            price: item.unitPrice,
            imageUrl: null,
          },
          createdAt: payload.createdAt || new Date().toISOString(),
        }));

        return {
          ...prev,
          groups: {
            ...prev.groups,
            PENDING: [...(prev.groups?.PENDING || []), ...newOrderItems],
          },
        };
      });
    };

    const handleAllDone = (payload: { sessionId: string; tableNumber: number; tableLabel?: string }) => {
      addNotification({
        type: "all-done",
        message: `Bàn ${payload.tableNumber} — tất cả món đã xong`,
        sessionId: payload.sessionId,
        tableNumber: payload.tableNumber,
      });

      setTables((prev) =>
        prev.map((table) => {
          if (table.session?.sessionId !== payload.sessionId) return table;
          return table.session
            ? {
                ...table,
                session: {
                  ...table.session,
                  pendingCount: 0,
                  preparingCount: 0,
                  doneCount: Math.max(1, table.session.doneCount || 0),
                },
              }
            : table;
        })
      );
    };

    const handleSoldOut = (payload: { menuItemId: string; menuItemName: string; isSoldOut: boolean }) => {
      if (!payload.isSoldOut) return;
      addNotification({
        type: "soldout-warning",
        message: `${payload.menuItemName} vừa hết`,
      });
    };

    const handleCartUpdated = (payload: { sessionId: string; tableId: string; isLocked?: boolean }) => {
      setTables((prev) =>
        prev.map((table) => {
          if (table.tableId !== payload.tableId) return table;
          return {
            ...table,
            tableStatus: 'OCCUPIED' as const,
            session: table.session
              ? {
                  ...table.session,
                  sessionId: payload.sessionId || table.session.sessionId,
                  isLocked: payload.isLocked !== undefined ? !!payload.isLocked : table.session.isLocked,
                  pendingCount: payload.isLocked ? 0 : table.session.pendingCount,
                }
              : {
                  sessionId: payload.sessionId,
                  openedAt: new Date().toISOString(),
                  pendingCount: 0,
                  preparingCount: 0,
                  doneCount: 0,
                  isLocked: false,
                },
          };
        })
      );
      if (payload.sessionId === selectedSessionId && !sessionItems?.sessionId) {
        fetchSessionItems(payload.sessionId);
      }
    };

    const handleTableStatusChanged = (payload: { tableId: string; status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' }) => {
      setTables((prev) =>
        prev.map((table) => {
          if (table.tableId !== payload.tableId) return table;
          return {
            ...table,
            tableStatus: payload.status,
            session: payload.status === 'OCCUPIED'
              ? table.session || { sessionId: '', openedAt: new Date().toISOString(), pendingCount: 0, preparingCount: 0, doneCount: 0, isLocked: false }
              : payload.status === 'AVAILABLE' ? null : table.session,
          };
        })
      );
    };

    const handleKitchenItemUpdated = (payload: RealtimeKitchenItemUpdatedPayload) => {
      updateTableCountersFromStatusChange(payload);

      setSessionItems((prev) => {
        if (!prev || prev.sessionId !== payload.sessionId) return prev;

        const nextGroups = createEmptyGroups();
        let movedItem: OrderItem | null = null;

        for (const status of Object.keys(prev.groups) as OrderItemStatus[]) {
          for (const item of prev.groups[status]) {
            if (item.id === payload.removedOrderItemId) {
              continue;
            }

            if (item.id === payload.orderItemId) {
              movedItem = {
                ...item,
                status: payload.status,
                qty: payload.qty ?? item.qty,
                note: payload.note !== undefined ? payload.note : item.note,
                menuItem: {
                  ...item.menuItem,
                  name: payload.menuItemName || item.menuItem.name,
                },
              };
              continue;
            }
            nextGroups[status].push(item);
          }
        }

        if (movedItem) {
          nextGroups[payload.status].push(movedItem);
        }

        return {
          ...prev,
          groups: nextGroups,
        };
      });
    };
    const handlePaymentPending = (payload: any) => {
      toast(`💳 Bàn ${payload.tableNumber || ''} vừa chọn chuyển khoản VietQR (${currencyFormatter.format(payload.total)})`, {
        icon: '🔔',
        duration: 6000,
      });

      setTables((prev) =>
        prev.map((t) => {
          if (t.session?.sessionId !== payload.sessionId) return t;
          return {
            ...t,
            session: {
              ...t.session!,
              pendingPayment: {
                paymentId: payload.paymentId,
                paymentCode: payload.paymentCode,
                total: payload.total,
                provider: 'VIETQR',
                qrUrl: payload.qrUrl,
                bankName: payload.bankName,
                accountNumber: payload.accountNumber,
                accountName: payload.accountName,
              },
            },
          };
        })
      );

      if (selectedSessionId === payload.sessionId) {
        setPendingPaymentData({
          paymentId: payload.paymentId,
          paymentCode: payload.paymentCode,
          total: payload.total,
          qrUrl: payload.qrUrl,
          bankName: payload.bankName,
          accountNumber: payload.accountNumber,
          accountName: payload.accountName,
        });
      }
    };

    const handlePaymentCompleted = (payload: any) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.session?.sessionId !== payload.sessionId) return t;
          return {
            ...t,
            session: t.session
              ? {
                  ...t.session,
                  pendingPayment: null,
                }
              : null,
          };
        })
      );
      if (selectedSessionId === payload.sessionId) {
        setPendingPaymentData(null);
      }
    };

    const handlePaymentCancelled = (payload: any) => {
      toast(`ℹ️ Bàn ${payload.tableNumber || ''} đã huỷ chuyển khoản (chuyển sang thanh toán tại quầy).`, {
        duration: 5000,
      });

      setTables((prev) =>
        prev.map((t) => {
          if (t.session?.sessionId !== payload.sessionId) return t;
          return {
            ...t,
            session: t.session
              ? {
                  ...t.session,
                  pendingPayment: null,
                }
              : null,
          };
        })
      );
      if (selectedSessionId === payload.sessionId) {
        setPendingPaymentData(null);
      }
    };

    socket.on("cashier:new-order", handleNewOrder);
    socket.on("table:status-changed", handleTableStatusChanged);
    socket.on("session:all-done", handleAllDone);
    socket.on("menu:soldout-notify", handleSoldOut);
    socket.on("cart:updated", handleCartUpdated);
    socket.on("kitchen:item-updated", handleKitchenItemUpdated);
    socket.on("payment:pending", handlePaymentPending);
    socket.on("payment:completed", handlePaymentCompleted);
    socket.on("payment:cancelled", handlePaymentCancelled);

    return () => {
      socket.off("cashier:new-order", handleNewOrder);
      socket.off("table:status-changed", handleTableStatusChanged);
      socket.off("session:all-done", handleAllDone);
      socket.off("menu:soldout-notify", handleSoldOut);
      socket.off("cart:updated", handleCartUpdated);
      socket.off("kitchen:item-updated", handleKitchenItemUpdated);
      socket.off("payment:pending", handlePaymentPending);
      socket.off("payment:completed", handlePaymentCompleted);
      socket.off("payment:cancelled", handlePaymentCancelled);
    };
  }, [
    socket,
    isConnected,
    addNotification,
    selectedSessionId,
    syncSelectedSessionFromRealtimeItems,
    tables,
    updateTableCountersFromStatusChange,
    fetchSessionItems,
  ]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === "new-order" && notification.sessionId) {
      handleSelectSession(notification.sessionId);
      setActiveTab("details");
    }
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const groupedItems = useMemo(() => {
    return sessionItems?.groups || { PENDING: [], PREPARING: [], DONE: [], DELIVERED: [], VOID: [] };
  }, [sessionItems]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<OrderItemStatus, boolean>>({
    PENDING: false,
    PREPARING: false,
    DONE: true,
    DELIVERED: true,
    VOID: true,
  });

  const toggleGroup = (status: OrderItemStatus) => {
    setCollapsedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const getItemDiscountAmount = (item: OrderItem): number => {
    const unitPrice = Number(item.unitPrice);
    if (!item.itemDiscountType || !item.itemDiscountValue || Number(item.itemDiscountValue) <= 0) return 0;
    if (item.itemDiscountType === 'PERCENT') {
      return Math.round(unitPrice * Math.min(Number(item.itemDiscountValue), 100) / 100);
    }
    return Math.min(Number(item.itemDiscountValue), unitPrice);
  };

  const subtotal = useMemo(() => {
    const billItems = [...groupedItems.PENDING, ...groupedItems.PREPARING, ...groupedItems.DONE, ...groupedItems.DELIVERED];
    return billItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  }, [groupedItems]);

  const itemDiscountTotal = useMemo(() => {
    const billItems = [...groupedItems.PENDING, ...groupedItems.PREPARING, ...groupedItems.DONE, ...groupedItems.DELIVERED];
    return billItems.reduce((sum, item) => sum + getItemDiscountAmount(item) * item.qty, 0);
  }, [groupedItems]);

  const pendingBatchSubtotal = useMemo(() => {
    return groupedItems.PENDING.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  }, [groupedItems.PENDING]);

  const pendingBatchTax = useMemo(() => pendingBatchSubtotal * 0.1, [pendingBatchSubtotal]);
  const pendingBatchTotal = useMemo(() => pendingBatchSubtotal + pendingBatchTax, [pendingBatchSubtotal, pendingBatchTax]);

  const taxAmount = useMemo(() => subtotal * 0.1, [subtotal]);

  const activeDiscountAmount = useMemo(() => {
    if (pendingPaymentData) {
      return Number(pendingPaymentData.discountAmount || pendingPaymentData.pointsDiscountAmount || 0);
    }
    return voucherData?.discountAmount ?? 0;
  }, [pendingPaymentData, voucherData]);

  const totalAmount = useMemo(() => {
    if (pendingPaymentData?.total !== undefined && pendingPaymentData?.total !== null) {
      return Number(pendingPaymentData.total);
    }
    return Math.max(0, subtotal + taxAmount - activeDiscountAmount);
  }, [subtotal, taxAmount, activeDiscountAmount, pendingPaymentData]);

  const posPointsDiscount = useMemo(() => {
    if (!posCustomerData || !posUsePoints) return 0;
    const rate = posCustomerData.pointRedeemRate || 100;
    const requested = typeof posPointsToUse === 'number' && posPointsToUse >= 0 ? posPointsToUse : posCustomerData.points;
    const validPoints = Math.min(posCustomerData.points, requested);
    return Math.min(validPoints * rate, subtotal);
  }, [posCustomerData, posUsePoints, posPointsToUse, subtotal]);

  const posMembershipDiscount = useMemo(() => {
    if (!posCustomerData?.membershipTier?.discountPercent) return 0;
    const baseSubtotal = Math.max(0, subtotal - itemDiscountTotal);
    return Math.round(baseSubtotal * (posCustomerData.membershipTier.discountPercent / 100));
  }, [posCustomerData, subtotal, itemDiscountTotal]);

  const totalDiscountInModal = useMemo(() => {
    return (voucherData?.discountAmount ?? 0) + posPointsDiscount + posMembershipDiscount;
  }, [voucherData, posPointsDiscount, posMembershipDiscount]);

  const modalFinalTotal = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - totalDiscountInModal);
  }, [subtotal, taxAmount, totalDiscountInModal]);

  const hasPendingOrPreparing = groupedItems.PENDING.length > 0 || groupedItems.PREPARING.length > 0;

  const renderItemsGroup = (status: OrderItemStatus) => {
    const items = groupedItems[status];
    if (!items || items.length === 0) return null;
    const isCollapsed = collapsedGroups[status];

    return (
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-md shadow-lg transition-all duration-300">
        <button
          className="w-full flex items-center justify-between px-5 py-3.5"
          onClick={() => toggleGroup(status)}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass[status]}`}>
              {statusLabels[status]}
            </span>
            <span className="text-xs font-semibold text-zinc-400">{items.reduce((sum, i) => sum + i.qty, 0)} món</span>
          </div>
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
        </button>

        {!isCollapsed && (
          <div className="px-5 pb-5 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-dashed border-zinc-900 pb-3.5 last:border-none last:pb-0">
                <div className="h-12 w-12 rounded-xl bg-zinc-950 overflow-hidden flex items-center justify-center border border-zinc-900 shrink-0">
                    {item.menuItem.imageUrl ? (
                      <Image
                        src={item.menuItem.imageUrl}
                        alt={item.menuItem.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed className="h-4 w-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-zinc-200 text-xs truncate">{item.menuItem.name}</div>
                      <div className="flex items-center gap-1.5">
                        {item.itemDiscountValue && Number(item.itemDiscountValue) > 0 && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                            -{item.itemDiscountType === 'PERCENT' ? `${item.itemDiscountValue}%` : currencyFormatter.format(Number(item.itemDiscountValue))}
                          </span>
                        )}
                        <div className="text-xs font-bold text-zinc-200 font-mono">{currencyFormatter.format(Number(item.unitPrice))}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-semibold mt-0.5">Số lượng: x{item.qty}</div>
                    {item.note && (
                      <div className="text-[10px] text-blue-400 bg-blue-500/5 border border-blue-500/10 rounded-xl px-2.5 py-1.5 mt-1.5 font-medium space-y-1 block">
                        {item.note
                          .replace(/^📝?\s*Ghi chú:\s*/i, '')
                          .split(/•|;|\||\n/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((line, idx) => (
                            <div key={idx} className="leading-tight">
                              <span>{line}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    {(status === "PENDING" || status === "PREPARING") && (
                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleVoidItem(item.id)}
                          disabled={isVoiding === item.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          {isVoiding === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Đang huỷ...</span>
                            </>
                          ) : (
                            <span>✕ HUỶ MÓN</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }

          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full text-zinc-100">
      {/* Mobile navigation header */}
      <div className="mb-6 flex items-center justify-between lg:hidden bg-zinc-900/30 border border-zinc-900 rounded-3xl p-3 backdrop-blur-md">
        <div className="inline-flex rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("tables")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "tables" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Bàn
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "details" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Chi tiết
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all relative ${
              activeTab === "notifications" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Thông báo
            {unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono px-3 py-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          {formatShortTime(now)}
        </div>
      </div>

      {/* Floating Toast Popup Notifications (prevents layout shift/jumping) */}
      {(successMsg || localErrorMsg) && (
        <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
          {successMsg && (
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-zinc-950/95 text-emerald-400 p-4 text-xs font-semibold shadow-2xl shadow-emerald-950/50 backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {localErrorMsg && (
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-zinc-950/95 text-rose-400 p-4 text-xs font-semibold shadow-2xl shadow-rose-950/50 backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <X className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="truncate">{localErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocalErrorMsg(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

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
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Archive className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">Lịch sử Thanh toán & Lưu trữ</h2>
                  <p className="text-sm text-zinc-400 font-medium">
                    {filteredArchivedSessions.length} phiên đã hoàn tất thanh toán
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
                  <Calendar className="h-4 w-4 text-blue-500" />
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
                      <button onClick={() => handleRangeChange("today")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "today" ? "bg-blue-500/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                        Hôm nay
                      </button>
                      <button onClick={() => handleRangeChange("yesterday")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "yesterday" ? "bg-blue-500/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                        Hôm qua
                      </button>
                      <button onClick={() => handleRangeChange("7days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "7days" ? "bg-blue-500/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                        7 ngày qua
                      </button>
                      <button onClick={() => handleRangeChange("30days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "30days" ? "bg-blue-500/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
                        30 ngày qua
                      </button>
                      <button onClick={() => handleRangeChange("90days")} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${rangeType === "90days" ? "bg-blue-500/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-900"}`}>
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
                              className="flex-1 bg-zinc-900 border border-zinc-700 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 text-white font-mono"
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
                              className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl border border-zinc-700 text-zinc-300 cursor-pointer"
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
                              className="flex-1 bg-zinc-900 border border-zinc-700 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 text-white font-mono"
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
                              className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl border border-zinc-700 text-zinc-300 cursor-pointer"
                            >
                              <Calendar className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <button 
                          onClick={handleRangeSubmit}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-colors cursor-pointer"
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
              {filteredArchivedSessions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredArchivedSessions.map((session, index) => {
                    const isCancelled = session.status === "CANCELLED";
                    return (
                      <div key={`${session.id}-${index}`} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col hover:border-zinc-700 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <span className="font-bold text-sm text-zinc-100 flex-1 leading-snug">
                            {session.tableNumber === 0 || !session.tableNumber
                              ? (session.tableLabel && session.tableLabel !== 'POS' ? session.tableLabel : 'Mang về')
                              : `Bàn ${session.tableNumber}${session.tableLabel ? ` (${session.tableLabel})` : ''}`}
                          </span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${isCancelled ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                            {isCancelled ? "Đã huỷ" : "Đã thanh toán"}
                          </span>
                        </div>

                        <div className="space-y-1.5 mb-4 border-b border-zinc-800/50 pb-4">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-medium">Tổng tiền:</span>
                            <span className="text-emerald-400 font-extrabold font-mono text-sm">{currencyFormatter.format(session.total)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-medium">Thời gian thanh toán:</span>
                            <span className="text-zinc-300 font-mono text-xs">
                              {new Date(session.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {new Date(session.closedAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Chi tiết món ăn:</h4>
                          <ul className="space-y-1.5">
                            {session.items.map((item, idx) => (
                              <li key={idx} className="flex justify-between items-center text-sm bg-zinc-950/20 p-2.5 rounded-lg border border-zinc-800/40">
                                <span className="text-zinc-300 font-medium">{item.name}</span>
                                <span className="font-mono font-bold text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded text-xs">
                                  x{item.qty}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end mt-auto">
                          <button
                            type="button"
                            onClick={() => {
                              triggerPrintReceipt({
                                tableLabel: (session.tableNumber === 0 || !session.tableNumber) ? (session.tableLabel && session.tableLabel !== 'POS' ? session.tableLabel : "Mang về") : (session.tableLabel || `Bàn ${session.tableNumber}`),
                                sessionId: session.id,
                                createdAt: new Date(session.closedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                                items: session.items.map(i => ({
                                  name: i.name,
                                  qty: i.qty,
                                  unitPrice: i.unitPrice || 0,
                                })),
                                subtotal: session.total,
                                finalTotal: session.total,
                                paymentMethod: isCancelled ? 'Đã huỷ' : 'Đã thanh toán',
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            In lại hoá đơn
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-12">
                  <Archive className="h-16 w-16 mb-6 opacity-20" />
                  <h3 className="text-xl font-bold text-zinc-400 mb-2">Không có dữ liệu</h3>
                  <p className="text-sm">Chưa có phiên thanh toán nào trong khoảng thời gian này.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-7">
        {/* Left Column (Tables List) — narrower */}
        <div className={`space-y-6 ${activeTab === "tables" ? "block" : "hidden"} lg:block lg:col-span-2`}>
          {/* Cashier Info Card */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-md p-5 shadow-xl hover:border-zinc-800 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white tracking-tight">Quầy Thu Ngân</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Mã NV: {user.userId}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(true)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                  title="Lưu trữ"
                >
                  <Archive className="h-4 w-4" />
                </button>
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 font-mono px-3 py-1.5 bg-zinc-950/60 border border-zinc-900/80 rounded-xl">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  {formatShortTime(now)}
                </div>
              </div>
            </div>
          </div>

          {/* Tables Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1 mb-2">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sơ đồ bàn phục vụ</div>
            </div>
            <div className="space-y-1.5 max-h-[580px] overflow-y-auto scrollbar-thin pr-1">
              {tables.filter(t => t.tableNumber !== 0 && t.tableId !== 'takeaway' && t.tableLabel !== 'Mang về' && !t.tableLabel?.startsWith('Mang về')).map((table) => {
                const pendingCount = table.session?.pendingCount || 0;
                const preparingCount = table.session?.preparingCount || 0;
                const doneCount = table.session?.doneCount || 0;
                const isAllDone = pendingCount === 0 && preparingCount === 0 && doneCount > 0;
                const isPending = pendingCount > 0;
                const isServing = preparingCount > 0 || doneCount > 0;
                const isSelected = table.tableId === selectedTableId || table.session?.sessionId === selectedSessionId;

                const hasPendingPayment = !!table.session?.pendingPayment;

                let statusDot = "bg-zinc-600";
                let statusLabel = table.session ? "Sẵn sàng" : "Trống";
                let statusClass = "text-zinc-500";

                if (hasPendingPayment) {
                  statusDot = "bg-amber-400 animate-ping";
                  statusLabel = "Chờ CK";
                  statusClass = "text-amber-400 font-extrabold animate-pulse";
                } else if (isPending) {
                  statusDot = "bg-orange-400 animate-pulse";
                  statusLabel = `${pendingCount} món`;
                  statusClass = "text-orange-400 font-bold";
                } else if (isAllDone) {
                  statusDot = "bg-purple-400";
                  statusLabel = "Xong";
                  statusClass = "text-purple-400 font-bold";
                } else if (isServing) {
                  statusDot = "bg-emerald-400";
                  statusLabel = "Đang PV";
                  statusClass = "text-emerald-400 font-bold";
                } else if (table.session) {
                  statusDot = "bg-blue-400";
                  statusLabel = table.tableNumber === 0 ? "Mang về" : "Đang ăn";
                  statusClass = "text-blue-400 font-bold";
                }

                const isExcess = table.isExcess;

                return (
                  <button
                    key={table.tableId}
                    type="button"
                    onClick={() => {
                      if (isExcess) return;
                      handleSelectTable(table);
                      setActiveTab("details");
                    }}
                    disabled={isExcess}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-all relative ${
                      isExcess
                        ? "opacity-50 grayscale cursor-not-allowed border-red-900/30 bg-red-950/10"
                        : isSelected
                        ? "border-zinc-500 bg-zinc-900 text-zinc-100"
                        : "border-zinc-900 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isExcess ? 'bg-red-500' : statusDot}`} />
                      <span className={`text-sm font-bold shrink-0 ${isExcess ? 'text-red-400' : 'text-zinc-100'}`}>
                        {table.tableNumber > 0 ? `Bàn ${table.tableNumber}` : table.tableLabel}
                      </span>
                      {isExcess ? (
                        <span className="text-[9px] ml-auto font-semibold text-red-500 bg-red-950/40 px-1.5 py-0.5 rounded">Quá giới hạn</span>
                      ) : (
                        <span className={`text-[10px] ml-auto font-semibold ${statusClass}`}>{statusLabel}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Middle Column (Session Details & Bill Actions) — wider */}
        <div className={`lg:col-span-3 ${activeTab === "details" ? "block" : "hidden"} lg:block`}>
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-md p-6 min-h-[600px] flex flex-col shadow-2xl">
            {!selectedSessionId || !selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Chọn đơn hoặc bàn hoạt động</div>
                  <div className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">Vui lòng chọn một bàn hoặc đơn mang về bên trái để hiển thị hóa đơn và duyệt món.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-zinc-900/80 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="text-base font-bold text-white tracking-tight">
                        {selectedTable.tableNumber > 0 ? (
                          <>BÀN {selectedTable.tableNumber} <span className="text-zinc-500 font-medium">({selectedTable.tableLabel})</span></>
                        ) : (
                          <span className="text-amber-400 font-extrabold">{selectedTable.tableLabel}</span>
                        )}
                      </div>
                      {selectedTable.session?.isLocked && (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                          🔒 Đang chế biến
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                      Mở lúc: {new Date(selectedTable.session?.openedAt || new Date()).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500 bg-zinc-950/60 border border-zinc-900 px-2 py-1 rounded-xl">
                    ID: {selectedSessionId.slice(0, 8)}...
                  </div>
                </div>

                {isLoadingItems ? (
                  <div className="flex-1 space-y-4 py-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-20 rounded-2xl bg-zinc-950/40 border border-zinc-900 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 py-6 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
                    {renderItemsGroup("PENDING")}
                    {renderItemsGroup("PREPARING")}
                    {renderItemsGroup("DONE")}
                    {renderItemsGroup("DELIVERED")}
                    {renderItemsGroup("VOID")}
                  </div>
                )}

                <div className="border-t border-zinc-900 pt-5 mt-auto">
                  {pendingPaymentData && (
                    <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-300">
                      <div>
                        <p className="font-bold text-amber-200">Khách chọn thanh toán VietQR</p>
                        <p className="text-[11px] opacity-80">Mã CK: <span className="font-mono font-bold text-white">{pendingPaymentData.paymentCode}</span></p>
                      </div>
                      <span className="font-extrabold text-sm text-amber-300">{currencyFormatter.format(pendingPaymentData.total)}</span>
                    </div>
                  )}

                  {groupedItems.PENDING.length > 0 && !pendingPaymentData ? (
                    <div className="bg-zinc-950/40 border border-emerald-900/30 rounded-2xl px-4 py-3 space-y-1.5 mb-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Tạm tính đợt này</span>
                        <span className="font-mono">{currencyFormatter.format(pendingBatchSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Thuế VAT (10%)</span>
                        <span className="font-mono">{currencyFormatter.format(pendingBatchTax)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-900/80 text-xs font-bold text-white">
                        <span className="uppercase tracking-wider text-emerald-400">Tổng duyệt đợt này</span>
                        <span className="text-xl font-black font-mono text-emerald-400">{currencyFormatter.format(pendingBatchTotal)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl px-4 py-3 space-y-1.5 mb-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Tạm tính (Tiền món)</span>
                        <span className="font-mono">{currencyFormatter.format(subtotal)}</span>
                      </div>
                      {itemDiscountTotal > 0 && (
                        <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                          <span>Chiết khấu món</span>
                          <span className="font-mono">-{currencyFormatter.format(itemDiscountTotal)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Thuế VAT (10%)</span>
                        <span className="font-mono">{currencyFormatter.format(taxAmount)}</span>
                      </div>
                      {activeDiscountAmount > 0 && (
                        <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
                          <span>Giảm giá {pendingPaymentData?.pointsRedeemed ? `(Tích điểm ${pendingPaymentData.pointsRedeemed} điểm)` : '(Voucher / Điểm)'}</span>
                          <span className="font-mono">-{currencyFormatter.format(activeDiscountAmount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-900/80 text-xs font-bold text-white">
                        <span className="uppercase tracking-wider">Tổng thanh toán bàn</span>
                        <span className="text-xl font-black font-mono text-white">{currencyFormatter.format(totalAmount)}</span>
                      </div>
                    </div>
                  )}

                  {pendingPaymentData ? (
                    <button
                      type="button"
                      onClick={handleManualConfirm}
                      disabled={isConfirmingPending}
                      className="w-full rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                    >
                      <span>{isConfirmingPending ? "ĐANG XÁC NHẬN..." : "XÁC NHẬN"}</span>
                    </button>
                  ) : groupedItems.PENDING.length > 0 ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleRejectAllPending}
                        disabled={isApproving}
                        className="flex-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>✕ HUỶ ĐƠN</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-[2] rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>ĐANG DUYỆT...</span>
                          </>
                        ) : (
                          <span>✓ DUYỆT ĐƠN</span>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePaySession}
                      className="w-full rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2"
                      disabled={isPaying}
                    >
                      <span>{isPaying ? "ĐANG THANH TOÁN..." : "THANH TOÁN"}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (Notifications Panel) — narrower */}
        <div className={`lg:col-span-2 ${activeTab === "notifications" ? "block" : "hidden"} lg:block`}>
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-md p-6 min-h-[600px] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-900/80 pb-4 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                <Bell className="h-4 w-4 text-rose-400" />
                <span>Thông báo mới</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-extrabold px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider bg-zinc-950/60 border border-zinc-900 px-2.5 py-1 rounded-xl"
                >
                  Đọc tất cả
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2.5 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
              {notifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 space-y-3 py-16">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-600">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chưa có thông báo mới</div>
                    <div className="text-[11px] text-zinc-600 mt-1 max-w-[200px] mx-auto">Thông báo từ khách gọi món, thanh toán VietQR sẽ hiển thị tại đây.</div>
                  </div>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left rounded-2xl border p-3.5 text-xs transition-all duration-200 hover:scale-[0.99] cursor-pointer ${
                      notification.isRead
                        ? "border-zinc-900/60 bg-zinc-950/20 text-zinc-400 hover:bg-zinc-900/30"
                        : "border-rose-500/30 bg-rose-500/10 text-zinc-100 shadow-lg shadow-rose-500/5 hover:bg-rose-500/15"
                    }`}
                  >
                    <div className="font-semibold">{notification.message}</div>
                    <div className="text-[10px] text-zinc-500 mt-1.5 flex items-center justify-between font-mono">
                      <span>{formatTimeAgo(notification.createdAt)}</span>
                      {!notification.isRead && <span className="text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">MỚI</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-0 animate-in fade-in duration-200">
          <div className="w-full h-full max-w-none rounded-none border-none bg-zinc-950 shadow-none flex flex-col overflow-hidden text-zinc-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900">
              <div>
                <div className="text-lg font-bold text-white tracking-tight">💳 Thanh Toán Hóa Đơn (Cashier)</div>
                <div className="text-sm text-zinc-500 mt-1">
                  Bàn {selectedTable?.tableNumber || ""} — {selectedTable?.tableLabel || ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto scrollbar-thin px-6 py-5 flex-1 grid grid-cols-[200px_1fr] gap-6">
              {/* Phuong thuc thanh toan - cot ben trai */}
              <div className="flex flex-col gap-2 pt-0">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Phương thức thanh toán</div>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`rounded-2xl border py-5 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${paymentMethod === "CASH"
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
                  className={`rounded-2xl border py-5 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${paymentMethod === "TRANSFER"
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                >
                  <span className="text-2xl">📲</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">Chuyển khoản</span>
                </button>
              </div>

              <div className="space-y-5">
                {/* Nhập SĐT tích điểm */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tích điểm / Khách hàng (SĐT)</div>
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
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleLookupPosCustomer()}
                      disabled={isCheckingPosPhone}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
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

                {/* Nhap voucher + validation */}
                <div className="space-y-2.5">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Voucher / Khuyến mãi</div>
                  <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Nhập mã voucher hoặc chọn..."
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value);
                          setShowVoucherDropdown(true);
                        }}
                        onFocus={() => setShowVoucherDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (voucherCode.trim()) handleValidateVoucher();
                          }, 200);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-bold uppercase tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                        className="absolute right-2 top-2 text-zinc-500 hover:text-white"
                      >
                        ▼
                      </button>

                      {/* Filtered Dropdown */}
                      {showVoucherDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowVoucherDropdown(false)} />
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto scrollbar-thin bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 divide-y divide-zinc-800">
                            {availableVouchers.filter(v => v.code.toLowerCase().includes(voucherCode.toLowerCase())).length === 0 ? (
                              <div className="p-3 text-xs text-zinc-500 text-center">Không tìm thấy voucher</div>
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
                                    className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs cursor-pointer"
                                  >
                                    <div>
                                      <span className="font-bold text-white font-mono">{v.code}</span>
                                      <span className="text-[10px] text-zinc-400 block">
                                        {v.discountType === "PERCENT" ? `Giảm ${v.discountValue}%` : `Giảm ${currencyFormatter.format(Number(v.discountValue))}`}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-mono">
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
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-[11px] text-rose-400">
                      ✗ {voucherError}
                    </div>
                  )}
                </div>

                {/* Tổng kết - đồng bộ font */}
                <div className="flex flex-col gap-2 pt-4 border-t border-zinc-900 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tạm tính</span>
                    <span className="font-mono text-zinc-300">{currencyFormatter.format(subtotal)}</span>
                  </div>
                  {itemDiscountTotal > 0 && (
                    <div className="flex justify-between text-rose-400 font-medium">
                      <span>Chiết khấu món</span>
                      <span className="font-mono">-{currencyFormatter.format(itemDiscountTotal)}</span>
                    </div>
                  )}
                  {posMembershipDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 font-medium">
                      <span>Giảm giá hạng ({posCustomerData?.membershipTier?.name} -{posCustomerData?.membershipTier?.discountPercent}%)</span>
                      <span className="font-mono">-{currencyFormatter.format(posMembershipDiscount)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-medium transition-colors ${totalDiscountInModal > 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                    <span>Giảm giá {posPointsDiscount > 0 ? `(Tích điểm ${typeof posPointsToUse === 'number' ? posPointsToUse : (posCustomerData?.points || 0)} điểm)` : ''}</span>
                    <span className="font-mono">
                      {totalDiscountInModal > 0 ? `-${currencyFormatter.format(totalDiscountInModal)}` : '0 đ'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thuế VAT (10%)</span>
                    <span className="font-mono text-zinc-300">{currencyFormatter.format(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-200 mt-1 pt-2 border-t border-zinc-800/50">
                    <span>Tổng cộng</span>
                    <span className="font-mono text-zinc-200">{currencyFormatter.format(modalFinalTotal)}</span>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={isPaying}
                    className="px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white py-3 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(false)}
                    disabled={!paymentMethod || isPaying}
                    className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Xác nhận"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(true)}
                    disabled={!paymentMethod || isPaying}
                    className="flex-[1.2] rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-500 disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isPaying ? (
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

      {/* Hidden Print Container */}
      <div style={{ display: "none" }}>
        {printData && <ReceiptPrintTemplate ref={receiptPrintRef} {...printData} />}
      </div>
    </div>
  );
}
