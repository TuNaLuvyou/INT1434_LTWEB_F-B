"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { Archive, Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Dot, Loader2, X, DollarSign, Sparkles, Plus, Minus, Trash2, Search, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { useSocket } from "@/hooks/useSocket";
import type { CashierNewOrderPayload } from "@/types/socket";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Role = "ADMIN" | "MANAGER" | "CASHIER";

export interface CashierOverviewTable {
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  tableStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  session: {
    sessionId: string;
    openedAt: string | Date;
    pendingCount: number;
    preparingCount: number;
    doneCount: number;
    isLocked: boolean;
  } | null;
}

type OrderItemStatus = "PENDING" | "PREPARING" | "DONE" | "VOID";

interface OrderItem {
  id: string;
  sessionId: string;
  menuItemId: string;
  qty: number;
  note: string | null;
  status: OrderItemStatus;
  unitPrice: string | number;
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
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  groups: Record<OrderItemStatus, OrderItem[]>;
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
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const statusLabels: Record<OrderItemStatus, string> = {
  PENDING: "⏳ Chờ duyệt",
  PREPARING: "👨‍🍳 Đang làm",
  DONE: "✓ Xong",
  VOID: "✗ Đã hủy",
};

const statusBadgeClass: Record<OrderItemStatus, string> = {
  PENDING: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  PREPARING: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  DONE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
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

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(640, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  } catch (error) {
    console.error("Audio api error", error);
  }
}

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateToDDMMYYYY = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatHeaderDate = (rangeStr: string) => {
  if (!rangeStr) return "";
  if (rangeStr.includes("_")) {
    const [startStr, endStr] = rangeStr.split("_");
    return `${startStr.split("-").reverse().join("-")} đến ${endStr.split("-").reverse().join("-")}`;
  }
  return rangeStr.split("-").reverse().join("-");
};

export default function CashierClient({
  user,
  initialTables,
  initialSessionItems,
  initialSelectedSessionId,
  errorMsg,
}: CashierClientProps) {
  const [tables, setTables] = useState<CashierOverviewTable[]>(initialTables);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    initialTables.find((table) => table.session?.sessionId === initialSelectedSessionId)?.tableId || null
  );
  const [sessionItems, setSessionItems] = useState<SessionItemsResponse | null>(initialSessionItems);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [activeTab, setActiveTab] = useState<"tables" | "details">(initialSelectedSessionId ? "details" : "tables");
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

  const token = typeof window !== "undefined" ? getAccessTokenFromCookie() || undefined : undefined;
  const { socket, isConnected } = useSocket({ room: "cashier", token });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cashier_archived_sessions") || "[]";
    try {
      const parsed = JSON.parse(stored) as ArchivedCashierSession[];
      const validData = Array.isArray(parsed) ? parsed : [];
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 95);
      
      const filteredData = validData.filter(session => {
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
    return tables.find((table) => table.tableId === selectedTableId) || null;
  }, [tables, selectedTableId]);

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
      if (!sessionId) {
        setSessionItems(null);
        return;
      }
      fetchSessionItems(sessionId);
    },
    [fetchSessionItems]
  );

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

  const handlePaySession = () => {
    if (!selectedSessionId) return;
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

  const handleConfirmPayment = async () => {
    if (!selectedSessionId || !paymentMethod) return;
    setIsPaying(true);

    const baseAmount = subtotal;
    const discountAmount = voucherData?.discountAmount ?? 0;
    const finalTotal = Math.max(0, baseAmount - discountAmount);

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
          subtotal: baseAmount,
          discountAmount,
          total: finalTotal,
          keepOccupied: false, // Cashier checkout releases the table!
        }),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        setSuccessMsg(`✓ Thanh toán thành công hóa đơn cho Bàn ${selectedTable?.tableNumber || ""}!`);
        setTimeout(() => setSuccessMsg(null), 5000);

        // Update local session & table list
        setTables((prev) =>
          prev.map((t) => {
            if (t.session?.sessionId === selectedSessionId) {
              return { ...t, tableStatus: "AVAILABLE", session: null };
            }
            return t;
          })
        );

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

            const allItems = Object.values(nextSessionItems.groups || {}).flat();
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
            session: {
              sessionId: payload.sessionId,
              openedAt: currentSession?.openedAt || payload.createdAt || new Date().toISOString(),
              pendingCount: nextPending,
              preparingCount: currentSession?.preparingCount || 0,
              doneCount: currentSession?.doneCount || 0,
              isLocked: currentSession?.isLocked || false,
            },
          };
        })
      );

      playCashierBeep();

      if (payload.sessionId === selectedSessionId) {
        fetchSessionItems(payload.sessionId);
      }
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
          return {
            ...table,
            session: table.session
              ? {
                  ...table.session,
                  pendingCount: 0,
                  preparingCount: 0,
                  doneCount: Math.max(1, table.session.doneCount || 0),
                }
              : table.session,
          };
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
            session: table.session
              ? {
                  ...table.session,
                  isLocked: payload.isLocked !== undefined ? !!payload.isLocked : table.session.isLocked,
                  pendingCount: payload.isLocked ? 0 : table.session.pendingCount,
                }
              : null,
          };
        })
      );
      if (payload.sessionId === selectedSessionId) {
        fetchSessionItems(payload.sessionId);
      }
    };

    socket.on("cashier:new-order", handleNewOrder);
    socket.on("session:all-done", handleAllDone);
    socket.on("menu:soldout-notify", handleSoldOut);
    socket.on("cart:updated", handleCartUpdated);

    return () => {
      socket.off("cashier:new-order", handleNewOrder);
      socket.off("session:all-done", handleAllDone);
      socket.off("menu:soldout-notify", handleSoldOut);
      socket.off("cart:updated", handleCartUpdated);
    };
  }, [socket, isConnected, addNotification, selectedSessionId, fetchSessionItems]);

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
    return sessionItems?.groups || { PENDING: [], PREPARING: [], DONE: [], VOID: [] };
  }, [sessionItems]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<OrderItemStatus, boolean>>({
    PENDING: false,
    PREPARING: false,
    DONE: true,
    VOID: true,
  });

  const toggleGroup = (status: OrderItemStatus) => {
    setCollapsedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const subtotal = useMemo(() => {
    const billItems = [...groupedItems.PENDING, ...groupedItems.PREPARING, ...groupedItems.DONE];
    return billItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  }, [groupedItems]);

  const hasPendingOrPreparing = groupedItems.PENDING.length > 0 || groupedItems.PREPARING.length > 0;

  const renderItemsGroup = (status: OrderItemStatus) => {
    const items = groupedItems[status];
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
            <span className="text-xs font-semibold text-zinc-400">{items.length} món</span>
          </div>
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
        </button>

        {!isCollapsed && (
          <div className="px-5 pb-5 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {items.length === 0 ? (
              <div className="text-xs text-zinc-500 italic py-2 text-center">Không có món nào thuộc nhóm này</div>
            ) : (
              items.map((item) => (
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
                      <Dot className="h-6 w-6 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-zinc-200 text-xs truncate">{item.menuItem.name}</div>
                      <div className="text-xs font-bold text-zinc-200 font-mono">{currencyFormatter.format(Number(item.unitPrice))}</div>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-semibold mt-0.5">Số lượng: x{item.qty}</div>
                    {item.note && (
                      <div className="text-[10px] text-orange-400 bg-orange-500/5 border border-orange-500/10 rounded-lg px-2 py-1 mt-1.5 inline-block font-medium">
                        📝 Ghi chú: {item.note}
                      </div>
                    )}
                    {(status === "PENDING" || status === "PREPARING") && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleVoidItem(item.id)}
                          disabled={isVoiding === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        >
                          {isVoiding === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Đang huỷ...
                            </>
                          ) : (
                            "❌ Huỷ món"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {status === "PENDING" && items.length > 0 && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex-1 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 text-xs font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 active:scale-[0.98]"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Đang duyệt...
                    </>
                  ) : (
                    "✓ Duyệt đơn"
                  )}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-600 hover:text-zinc-500 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-not-allowed"
                  disabled
                  title="Tính năng từ chối"
                >
                  ✗ Từ chối
                </button>
              </div>
            )}
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
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono px-3 py-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          {formatShortTime(now)}
        </div>
      </div>

      {localErrorMsg && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-400 animate-in fade-in duration-200">
          {localErrorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400 animate-in fade-in duration-200">
          {successMsg}
        </div>
      )}

      {isArchiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl mx-4 rounded-3xl border border-zinc-900 bg-zinc-950 shadow-2xl flex flex-col h-[85vh]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-zinc-900 gap-4 shrink-0">
              <div>
                <div className="text-sm font-bold text-white">Lịch sử thanh toán</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  {filteredArchivedSessions.length} phiên đã lưu
                </div>
              </div>
              
              <div className="flex items-center gap-3 relative">
                {/* Drowdown Filter */}
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-semibold hover:text-white hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <Calendar className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                    <span>
                      {rangeType === "today" && `Hôm nay: ${formatDateToDDMMYYYY(new Date())}`}
                      {rangeType === "yesterday" && `Hôm qua: ${formatDateToDDMMYYYY(new Date(Date.now() - 24 * 60 * 60 * 1000))}`}
                      {rangeType === "7days" && "7 ngày qua"}
                      {rangeType === "30days" && "30 ngày qua"}
                      {rangeType === "90days" && "90 ngày qua"}
                      {rangeType === "custom" && `Ngày: ${formatHeaderDate(customDate)}`}
                    </span>
                  </button>

                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1 max-h-[65vh] overflow-y-auto">
                        <div>
                          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chọn ngày cụ thể</div>
                          <div className="px-2.5 py-1.5 space-y-1.5">
                            <div className="relative flex items-center">
                              <input 
                                type="text" 
                                placeholder="dd-mm-yyyy"
                                value={tempCustomDateText}
                                onChange={(e) => setTempCustomDateText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleTextInputSubmit();
                                  }
                                }}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono text-center cursor-text"
                              />
                              <button 
                                type="button"
                                onClick={() => dateInputRef.current?.showPicker()}
                                className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                                title="Mở lịch chọn"
                              >
                                📅
                              </button>
                              <input 
                                ref={dateInputRef}
                                type="date" 
                                max={getLocalDateString()}
                                onChange={(e) => handleNativeDateChange(e.target.value)}
                                className="absolute w-0 h-0 opacity-0 pointer-events-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleTextInputSubmit}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-900/10"
                            >
                              Áp dụng ngày
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-zinc-900 pt-1.5 mt-1.5">
                          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chọn khoảng ngày</div>
                          <div className="px-2.5 py-1.5 space-y-2">
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-zinc-500 font-medium ml-1">Từ ngày</span>
                              <div className="relative flex items-center">
                                <input 
                                  type="text" 
                                  placeholder="dd-mm-yyyy"
                                  value={rangeStartText}
                                  onChange={(e) => setRangeStartText(e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono text-center cursor-text"
                                />
                                <button 
                                  type="button"
                                  onClick={() => rangeStartInputRef.current?.showPicker()}
                                  className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                                >
                                  📅
                                </button>
                                <input 
                                  ref={rangeStartInputRef}
                                  type="date" 
                                  max={getLocalDateString()}
                                  onChange={(e) => handleNativeRangeStartChange(e.target.value)}
                                  className="absolute w-0 h-0 opacity-0 pointer-events-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-[9px] text-zinc-500 font-medium ml-1">Đến ngày</span>
                              <div className="relative flex items-center">
                                <input 
                                  type="text" 
                                  placeholder="dd-mm-yyyy"
                                  value={rangeEndText}
                                  onChange={(e) => setRangeEndText(e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono text-center cursor-text"
                                />
                                <button 
                                  type="button"
                                  onClick={() => rangeEndInputRef.current?.showPicker()}
                                  className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                                >
                                  📅
                                </button>
                                <input 
                                  ref={rangeEndInputRef}
                                  type="date" 
                                  max={getLocalDateString()}
                                  onChange={(e) => handleNativeRangeEndChange(e.target.value)}
                                  className="absolute w-0 h-0 opacity-0 pointer-events-none"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleRangeSubmit}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-900/10 mt-1"
                            >
                              Áp dụng khoảng ngày
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-zinc-900 pt-1.5 mt-1">
                          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 mb-1.5 pb-1">Chọn nhanh</div>
                          
                          <button 
                            onClick={() => handleRangeChange("today")}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              rangeType === "today" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                            }`}
                          >
                            Hôm nay
                          </button>
                          
                          <button 
                            onClick={() => handleRangeChange("yesterday")}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              rangeType === "yesterday" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                            }`}
                          >
                            Hôm qua
                          </button>
                          
                          <button 
                            onClick={() => handleRangeChange("7days")}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              rangeType === "7days" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                            }`}
                          >
                            7 ngày gần nhất
                          </button>
                          
                          <button 
                            onClick={() => handleRangeChange("30days")}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              rangeType === "30days" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                            }`}
                          >
                            30 ngày gần nhất
                          </button>

                          <button 
                            onClick={() => handleRangeChange("90days")}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              rangeType === "90days" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                            }`}
                          >
                            90 ngày gần nhất
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(false)}
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {filteredArchivedSessions.length === 0 ? (
                <div className="text-xs text-zinc-500 italic text-center py-10">
                  Chưa có phiên nào được lưu trong thời gian này.
                </div>
              ) : (
                filteredArchivedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-zinc-900 bg-zinc-900/30 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-zinc-100">
                        Bàn {session.tableNumber} <span className="text-zinc-500">({session.tableLabel})</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {new Date(session.closedAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                        Tổng: {currencyFormatter.format(session.total)}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          session.status === "CANCELLED" ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {session.status}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {session.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{item.name}</span>
                          <span className="text-zinc-500 font-mono">x{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (Tables & Notifications) */}
        <div className={`space-y-6 ${activeTab === "tables" ? "block" : "hidden"} lg:block`}>
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

          {/* Notifications Card */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-md shadow-xl transition-all duration-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-zinc-900/80 hover:bg-zinc-900/20 transition-all"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                <Bell className="h-4 w-4 text-zinc-400" />
                Thông báo mới
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold px-2 py-0.5">{unreadCount}</span>
                )}
              </div>
              {showNotifications ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>

            {showNotifications && (
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Lịch sử nhận tin</div>
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Đọc tất cả
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic py-2 text-center">Chưa có thông báo nào</div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left rounded-2xl border px-4 py-3 text-xs transition-all duration-200 hover:scale-[0.99] ${
                          notification.isRead
                            ? "border-zinc-900/60 bg-zinc-950/20 text-zinc-400"
                            : "border-rose-500/20 bg-rose-500/5 text-zinc-200"
                        }`}
                      >
                        <div className="font-semibold">{notification.message}</div>
                        <div className="text-[9px] text-zinc-500 mt-1 font-mono">{formatTimeAgo(notification.createdAt)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tables Section */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Sơ đồ bàn phục vụ</div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {tables.map((table) => {
                const pendingCount = table.session?.pendingCount || 0;
                const preparingCount = table.session?.preparingCount || 0;
                const doneCount = table.session?.doneCount || 0;
                const isAllDone = pendingCount === 0 && preparingCount === 0 && doneCount > 0;
                const isPending = pendingCount > 0;
                const isServing = preparingCount > 0 || doneCount > 0;
                const isSelected = table.tableId === selectedTableId;

                let statusLabel = "Trống";
                let statusClass = "bg-zinc-950 text-zinc-500 border border-zinc-900";

                if (isPending) {
                  statusLabel = "Chờ duyệt";
                  statusClass = "bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse font-bold";
                } else if (isAllDone) {
                  statusLabel = "Hoàn thành";
                  statusClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold";
                } else if (isServing) {
                  statusLabel = "Đang phục vụ";
                  statusClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold";
                }

                return (
                  <button
                    key={table.tableId}
                    type="button"
                    onClick={() => {
                      handleSelectTable(table);
                      setActiveTab("details");
                    }}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all duration-300 hover:scale-[0.99] ${
                      isSelected
                        ? "border-zinc-500 bg-zinc-900 text-zinc-100 shadow-[0_12px_24px_rgba(0,0,0,0.4)]"
                        : "border-zinc-900 bg-zinc-900/30 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-zinc-100">Bàn {table.tableNumber}</div>
                        <div className={`text-[10px] ${isSelected ? "text-zinc-400" : "text-zinc-500"}`}>{table.tableLabel}</div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <div className={`mt-2.5 text-[10px] font-bold inline-flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-lg border border-orange-500/20`}>
                        Chờ duyệt: {pendingCount} món
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Session Details) */}
        <div className={`lg:col-span-2 ${activeTab === "details" ? "block" : "hidden"} lg:block`}>
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-md p-6 min-h-[600px] flex flex-col shadow-2xl">
            {!selectedSessionId || !selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Chọn bàn hoạt động</div>
                  <div className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">Vui lòng chọn một bàn bên trái để hiển thị hóa đơn và duyệt món.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-zinc-900/80 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="text-base font-bold text-white tracking-tight">
                        BÀN {selectedTable.tableNumber} <span className="text-zinc-500 font-medium">({selectedTable.tableLabel})</span>
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
                  <div className="flex-1 space-y-4 py-6 max-h-[500px] overflow-y-auto pr-1">
                    {renderItemsGroup("PENDING")}
                    {renderItemsGroup("PREPARING")}
                    {renderItemsGroup("DONE")}
                    {renderItemsGroup("VOID")}
                  </div>
                )}

                <div className="border-t border-zinc-900 pt-5 mt-auto">
                  <div className="flex items-center justify-between mb-4 bg-zinc-950/40 border border-zinc-900 rounded-2xl px-4 py-3">
                    <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tổng tạm tính</div>
                    <div className="text-xl font-black text-white font-mono">{currencyFormatter.format(subtotal)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePaySession}
                    className="w-full rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2"
                    disabled={!selectedTable.session?.isLocked || hasPendingOrPreparing || isPaying}
                    title={
                      !selectedTable.session?.isLocked
                        ? "Cần duyệt đơn hàng trước khi thanh toán"
                        : hasPendingOrPreparing
                        ? "Không thể thanh toán khi còn món chờ duyệt hoặc đang làm"
                        : ""
                    }
                  >
                    <span>{isPaying ? "ĐANG THANH TOÁN..." : "💳 THANH TOÁN HÓA ĐƠN"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900">
              <div>
                <div className="text-sm font-bold text-white tracking-tight">💳 THANH TOÁN HÓA ĐƠN</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
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

            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              {/* Danh sach mon an */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Chi tiết hóa đơn</div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {[
                    ...groupedItems.PENDING,
                    ...groupedItems.PREPARING,
                    ...groupedItems.DONE,
                  ].map((cartItem) => (
                    <div key={cartItem.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-medium truncate flex-1 pr-3">{cartItem.menuItem.name}</span>
                      <span className="text-zinc-500 shrink-0">x{cartItem.qty}</span>
                      <span className="text-zinc-200 font-mono ml-4 shrink-0">
                        {currencyFormatter.format(Number(cartItem.unitPrice) * cartItem.qty)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-900 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span>Tạm tính</span>
                    <span className="font-mono text-zinc-300">{currencyFormatter.format(subtotal)}</span>
                  </div>
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
                        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 divide-y divide-zinc-800">
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
                  <button
                    type="button"
                    onClick={() => handleValidateVoucher()}
                    disabled={!voucherCode.trim() || isValidatingVoucher}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer"
                  >
                    {isValidatingVoucher ? "..." : "Áp dụng"}
                  </button>
                </div>

                {voucherData && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✓ {voucherData.code}</span>
                      <div className="text-[11px] text-emerald-300 mt-0.5">
                        Giảm {voucherData.discountType === "PERCENT" ? `${voucherData.discountValue}%` : currencyFormatter.format(voucherData.discountValue)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      -{currencyFormatter.format(voucherData.discountAmount)}
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
                <span className="text-lg font-black text-indigo-400 font-mono">
                  {currencyFormatter.format(Math.max(0, subtotal - (voucherData?.discountAmount ?? 0)))}
                </span>
              </div>

              {/* Phuong thuc thanh toan */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Phương thức thanh toán</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${paymentMethod === "CASH"
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
                    className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${paymentMethod === "TRANSFER"
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
                disabled={isPaying}
                className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 py-3 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!paymentMethod || isPaying}
                className="flex-[2] rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(99,102,241,0.25)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-500 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPaying ? (
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
    </div>
  );
}
