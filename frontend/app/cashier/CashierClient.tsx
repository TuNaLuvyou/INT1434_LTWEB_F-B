"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Dot, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import type { CashierNewOrderPayload } from "@/types/socket";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Role = "ADMIN" | "MANAGER" | "STAFF";

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

export default function CashierClient({
  user,
  initialTables,
  initialSessionItems,
  initialSelectedSessionId,
  errorMsg,
}: CashierClientProps) {
  const [tables, setTables] = useState<CashierOverviewTable[]>(initialTables);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId);
  const [sessionItems, setSessionItems] = useState<SessionItemsResponse | null>(initialSessionItems);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [activeTab, setActiveTab] = useState<"tables" | "details">(initialSelectedSessionId ? "details" : "tables");
  const [now, setNow] = useState(new Date());
  const [isApproving, setIsApproving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [localErrorMsg, setLocalErrorMsg] = useState<string | null>(errorMsg);

  const token = typeof window !== "undefined" ? getAccessTokenFromCookie() || undefined : undefined;
  const { socket, isConnected } = useSocket({ room: "cashier", token });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const selectedTable = useMemo(() => {
    return tables.find((table) => table.session?.sessionId === selectedSessionId) || null;
  }, [tables, selectedSessionId]);

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
      fetchSessionItems(sessionId);
    },
    [fetchSessionItems]
  );

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
      if (payload.isLocked) {
        setTables((prev) =>
          prev.map((table) => {
            if (table.tableId !== payload.tableId) return table;
            return {
              ...table,
              session: table.session
                ? {
                    ...table.session,
                    isLocked: true,
                    pendingCount: 0,
                  }
                : null,
            };
          })
        );
        if (payload.sessionId === selectedSessionId) {
          fetchSessionItems(payload.sessionId);
        }
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
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 font-mono px-3 py-1.5 bg-zinc-950/60 border border-zinc-900/80 rounded-xl">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                {formatShortTime(now)}
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
                const isSelected = table.session?.sessionId === selectedSessionId;

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
                      handleSelectSession(table.session?.sessionId || null);
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
                    className="w-full rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3.5 font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2"
                    disabled={!selectedTable.session?.isLocked || hasPendingOrPreparing}
                    title={
                      !selectedTable.session?.isLocked
                        ? "Cần duyệt đơn hàng trước khi thanh toán"
                        : hasPendingOrPreparing
                        ? "Không thể thanh toán khi còn món chờ duyệt hoặc đang làm"
                        : ""
                    }
                  >
                    <span>💳 THANH TOÁN HÓA ĐƠN</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
