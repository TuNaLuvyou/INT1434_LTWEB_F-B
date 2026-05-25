"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Dot } from "lucide-react";
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

    socket.on("cashier:new-order", handleNewOrder);
    socket.on("session:all-done", handleAllDone);
    socket.on("menu:soldout-notify", handleSoldOut);

    return () => {
      socket.off("cashier:new-order", handleNewOrder);
      socket.off("session:all-done", handleAllDone);
      socket.off("menu:soldout-notify", handleSoldOut);
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
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 shadow-[0_10px_30px_rgba(15,23,42,0.45)]">
        <button
          className="w-full flex items-center justify-between px-4 py-3"
          onClick={() => toggleGroup(status)}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass[status]}`}>
              {statusLabels[status]}
            </span>
            <span className="text-sm text-slate-400">{items.length} món</span>
          </div>
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </button>

        {!isCollapsed && (
          <div className="px-4 pb-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-slate-500">Không có món</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 border-b border-dashed border-slate-800 pb-3 last:border-none">
                  <div className="h-12 w-12 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800">
                    {item.menuItem.imageUrl ? (
                      <Image
                        src={item.menuItem.imageUrl}
                        alt={item.menuItem.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Dot className="h-6 w-6 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-100">{item.menuItem.name}</div>
                      <div className="text-sm font-semibold text-slate-200">{currencyFormatter.format(Number(item.unitPrice))}</div>
                    </div>
                    <div className="text-sm text-slate-400">x{item.qty}</div>
                    {item.note && <div className="text-xs text-slate-500 mt-1">Ghi chú: {item.note}</div>}
                  </div>
                </div>
              ))
            )}
            {status === "PENDING" && items.length > 0 && (
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-emerald-500/90 text-white py-2 text-sm font-semibold shadow-[0_8px_16px_rgba(16,185,129,0.2)] disabled:opacity-50"
                  disabled
                  title="Implement in next commit"
                >
                  ✓ Duyệt tất cả
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-500/60 text-rose-300 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled
                  title="Implement in next commit"
                >
                  ✗ Từ chối tất cả
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/80">
            <button
              type="button"
              onClick={() => setActiveTab("tables")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg ${
                activeTab === "tables" ? "bg-slate-100 text-slate-900" : "text-slate-400"
              }`}
            >
              Bàn
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg ${
                activeTab === "details" ? "bg-slate-100 text-slate-900" : "text-slate-400"
              }`}
            >
              Chi tiết
            </button>
          </div>
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {formatShortTime(now)}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`space-y-4 ${activeTab === "tables" ? "block" : "hidden"} lg:block`}>
            <div className="rounded-2xl bg-slate-900/80 shadow-[0_10px_30px_rgba(15,23,42,0.45)] border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold text-slate-100">Thu ngân</div>
                  <div className="text-sm text-slate-400">#{user.userId}</div>
                </div>
                <div className="hidden lg:flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="h-4 w-4" />
                  {formatShortTime(now)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/80 shadow-[0_10px_30px_rgba(15,23,42,0.45)] border border-slate-800">
              <button
                type="button"
                onClick={() => setShowNotifications((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Bell className="h-4 w-4" />
                  Thông báo
                  {unreadCount > 0 && (
                    <span className="ml-2 rounded-full bg-rose-500/80 text-white text-xs px-2 py-0.5">{unreadCount}</span>
                  )}
                </div>
                {showNotifications ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {showNotifications && (
                <div className="border-t border-slate-800 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-slate-500">Mới nhất lên đầu</div>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-semibold text-slate-300 hover:text-white"
                    >
                      Đánh dấu đã đọc tất cả
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-slate-500">Chưa có thông báo</div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
                            notification.isRead
                              ? "border-slate-800 bg-slate-950/40 text-slate-300"
                              : "border-rose-500/40 bg-rose-500/10 text-slate-100"
                          }`}
                        >
                          <div className="font-medium">{notification.message}</div>
                          <div className="text-xs text-slate-500 mt-1">{formatTimeAgo(notification.createdAt)}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-300">Danh sách bàn</div>
              <div className="space-y-2">
                {tables.map((table) => {
                  const pendingCount = table.session?.pendingCount || 0;
                  const preparingCount = table.session?.preparingCount || 0;
                  const doneCount = table.session?.doneCount || 0;
                  const isAllDone = pendingCount === 0 && preparingCount === 0 && doneCount > 0;
                  const isPending = pendingCount > 0;
                  const isServing = preparingCount > 0 || doneCount > 0;
                  const isSelected = table.session?.sessionId === selectedSessionId;

                  let statusLabel = "Trống";
                  let statusClass = "bg-slate-800 text-slate-400 border border-slate-700/80";

                  if (isPending) {
                    statusLabel = "Chờ duyệt";
                    statusClass = "bg-orange-500/15 text-orange-300 border border-orange-500/30 animate-pulse";
                  } else if (isAllDone) {
                    statusLabel = "All done";
                    statusClass = "bg-purple-500/15 text-purple-300 border border-purple-500/30";
                  } else if (isServing) {
                    statusLabel = "Đang phục vụ";
                    statusClass = "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
                  }

                  return (
                    <button
                      key={table.tableId}
                      type="button"
                      onClick={() => {
                        handleSelectSession(table.session?.sessionId || null);
                        setActiveTab("details");
                      }}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-slate-500 bg-slate-900 text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.35)]"
                          : "border-slate-800 bg-slate-900/60 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-base font-semibold">Bàn {table.tableNumber}</div>
                          <div className={`text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>{table.tableLabel}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {pendingCount > 0 && (
                        <div className={`mt-2 text-xs font-semibold ${isSelected ? "text-orange-300" : "text-orange-400"}`}>
                          Chờ duyệt: {pendingCount}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`lg:col-span-2 ${activeTab === "details" ? "block" : "hidden"} lg:block`}>
            <div className="rounded-2xl bg-slate-900/80 shadow-[0_10px_30px_rgba(15,23,42,0.45)] border border-slate-800 p-5 min-h-[600px] flex flex-col">
              {!selectedSessionId || !selectedTable ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                  <CheckCircle2 className="h-12 w-12" />
                  <div className="mt-3 text-lg font-semibold text-slate-300">Chọn một bàn để xem chi tiết</div>
                  <div className="text-sm">Danh sách món sẽ hiển thị ở đây</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <div className="text-xl font-semibold text-slate-100">
                        Bàn {selectedTable.tableNumber} — {selectedTable.tableLabel}
                      </div>
                      <div className="text-sm text-slate-400">
                        Session mở lúc {formatShortTime(selectedTable.session?.openedAt || new Date())}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">#{selectedSessionId.slice(0, 8)}</div>
                  </div>

                  {isLoadingItems ? (
                    <div className="flex-1 space-y-4 py-6">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-20 rounded-xl bg-slate-800/60 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 space-y-4 py-6">
                      {renderItemsGroup("PENDING")}
                      {renderItemsGroup("PREPARING")}
                      {renderItemsGroup("DONE")}
                      {renderItemsGroup("VOID")}
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-4 mt-auto">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-slate-400">Tổng tiền tạm tính</div>
                      <div className="text-xl font-semibold text-slate-100">{currencyFormatter.format(subtotal)}</div>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-slate-100 text-slate-900 py-3 font-semibold shadow-[0_12px_24px_rgba(148,163,184,0.25)] disabled:opacity-50"
                      disabled={hasPendingOrPreparing}
                      title={hasPendingOrPreparing ? "Không thể thanh toán khi còn món chờ" : ""}
                    >
                      💳 Thanh toán
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
