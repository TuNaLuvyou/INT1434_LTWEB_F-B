'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, Receipt, X, Trash, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

import MenuCard, { MenuCardItem } from '@/components/MenuCard';
import CategoryFilter from '@/components/CategoryFilter';
import { useMenuSoldOut } from '../hooks/useMenuSoldOut';
import { useCartStore, CartItem } from '@/stores/cart.store';
import { submitOrder } from '@/app/actions/order.actions';
import { useCartSync } from '@/hooks/useCartSync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface MenuItemForDisplay {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  isSoldOut: boolean;
  isActive: boolean;
  [key: string]: unknown;
}

interface MenuItemListProps {
  initialItems: MenuItemForDisplay[];
  categories: CategoryInfo[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (price: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

// ─── Component ────────────────────────────────────────────────────────────────

export default function MenuItemList({ initialItems, categories }: MenuItemListProps) {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params?.tableId as string;

  // ── Realtime sold-out sync (Lắng nghe sự thay đổi hết món qua Socket.io) ──
  const { items: rawItems, isConnected } = useMenuSoldOut(initialItems, {
    onItemSoldOut: (payload: any) => {
      if (payload.isSoldOut) {
        // Find the item name if possible, or just say 'Một món ăn'
        const item = initialItems.find(i => i.id === payload.menuItemId);
        const name = item ? item.name : 'Một món ăn';
        showToast({ type: 'error', message: `Món "${name}" hiện đã hết.` });
      }
    }
  });
  const items = rawItems as MenuItemForDisplay[];

  // ── Zustand Store State & Actions ──
  const cartItems = useCartStore((s) => s.items);
  const sessionId = useCartStore((s) => s.sessionId);
  const sessionTableId = useCartStore((s) => s.tableId);
  const isSubmitting = useCartStore((s) => s.isSubmitting);
  const submitError = useCartStore((s) => s.submitError);
  const isGeofenceEnabled = useCartStore((s) => s.isGeofenceEnabled);
  const isLocked = false; // Bỏ khóa bàn: luôn false để cho phép khách hàng gọi thêm món liên tục.

  const initSession = useCartStore((s) => s.initSession);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const updateNote = useCartStore((s) => s.updateNote);
  const clearCart = useCartStore((s) => s.clearCart);
  const setSubmitting = useCartStore((s) => s.setSubmitting);
  const setSubmitError = useCartStore((s) => s.setSubmitError);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();

  // ── UI state ──
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'current' | 'history'>('current');
  type CartItemEntry = CartItem & { status?: string };
  const [lastOrder, setLastOrder] = useState<CartItemEntry[] | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeoLocation = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [loadingItemIds, setLoadingItemIds] = useState<Record<string, boolean>>({});
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [sessionClosedStatus, setSessionClosedStatus] = useState<'PAID' | 'CANCELLED' | 'UNKNOWN' | null>(null);
  const [dbOrderItems, setDbOrderItems] = useState<any[]>([]);
  const [isOccupiedByPos, setIsOccupiedByPos] = useState(false);

  const fetchSessionDetails = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sid}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const dbItems = result.data.orderItems || [];
          setDbOrderItems(dbItems);
          
          const placedItems = dbItems.filter((oi: any) => oi.status !== 'CART');
          if (placedItems.length > 0) {
            const mapped = placedItems.map((oi: any) => ({
              menuItemId: oi.menuItemId,
              name: oi.menuItem?.name || oi.menuItemName || '',
              price: Number(oi.unitPrice),
              imageUrl: oi.menuItem?.imageUrl || null,
              qty: oi.qty,
              note: oi.note || '',
              status: oi.status,
            }));
            setLastOrder(mapped);
          } else {
            setLastOrder(null);
          }
        }
      }
    } catch (err) {
      console.error('[MenuItemList] Lấy chi tiết phiên bàn thất bại:', err);
    }
  }, []);

  // ── Realtime cart synchronization ──
  const { registerActivity } = useCartSync(
    sessionId,
    sessionTableId,
    useCallback((message: string) => {
      showToast({ type: 'success', message });
      if (sessionId) {
        fetchSessionDetails(sessionId);
      }
    }, [sessionId, fetchSessionDetails]),
    useCallback((event: { sessionId: string; status?: string }) => {
      if (event?.status === 'CANCELLED') {
        showToast({ type: 'error', message: 'Đơn đã bị huỷ do hết món. Bạn có thể gọi món mới.' });
        return;
      }
      clearCart();
      setLastOrder(null);
      setDbOrderItems([]);
      setIsSessionClosed(true);
      setSessionClosedStatus((event?.status as any) || 'UNKNOWN');
    }, [clearCart]),
    useCallback((event: any) => {
      if (sessionId) {
        fetchSessionDetails(sessionId);
      }
    }, [sessionId, fetchSessionDetails])
  );

  const handleUpdateQty = useCallback(async (itemId: string, qty: number) => {
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateQty(itemId, qty);
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [updateQty, registerActivity]);

  const handleUpdateNote = useCallback(async (itemId: string, note: string) => {
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateNote(itemId, note);
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [updateNote, registerActivity]);

  // ── Khởi tạo session tự động khi quét QR code / vào bàn ──
  useEffect(() => {
    if (tableNumber) {
      initSession(tableNumber).then(({ sessionId }) => {
        fetchSessionDetails(sessionId);
      }).catch((err) => {
        const msg = (err as Error)?.message || '';
        if (msg.includes('409') || msg.toLowerCase().includes('đã có người đặt')) {
          setIsOccupiedByPos(true);
        } else {
          console.error('[MenuItemList] Khởi tạo session thất bại:', err);
          if (msg.includes('404') || msg.toLowerCase().includes('bàn không tồn tại')) {
            router.replace('/404');
          }
        }
      });
    }
  }, [tableNumber, initSession, router, fetchSessionDetails]);

  // ── Lắng nghe sự kiện phiên đã đóng ──
  useEffect(() => {
    const handleSessionClosed = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string }>).detail;
      if (detail?.status === 'CANCELLED') {
        showToast({ type: 'error', message: 'Đơn đã bị huỷ do hết món. Bạn có thể gọi món mới.' });
        return;
      }
      setIsSessionClosed(true);
      setSessionClosedStatus((detail?.status as any) || 'UNKNOWN');
    };
    window.addEventListener('session-closed', handleSessionClosed);
    return () => {
      window.removeEventListener('session-closed', handleSessionClosed);
    };
  }, []);

  // Thao tác với DOM để phục vụ auto-scroll của CategoryFilter
  const handleCategoryChange = (id: string | null) => {
    setActiveCategoryId(id);
    if (id === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      const el = document.getElementById(`category-${cat.slug}`);
      if (el) {
        // Khoảng bù cho CategoryFilter sticky + khoảng đệm an toàn
        const offset = 80;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  // ── Toast helper ──
  const showToast = (t: { type: 'success' | 'error'; message: string }) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Cart actions bridge ──
  const addToCart = useCallback(async (itemId: string) => {
    if (isLocked) {
      showToast({ type: 'error', message: 'Order đang được chuẩn bị bởi nhà hàng — không thể thêm món mới.' });
      return;
    }
    const found = items.find((i) => i.id === itemId);
    if (!found || found.isSoldOut) return;
    registerActivity();
    setLoadingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await addItem({
        menuItemId: found.id,
        name: found.name,
        price: Number(found.price),
        imageUrl: found.imageUrl,
      });
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  }, [items, addItem, registerActivity, isLocked]);

  const visibleCategories = categories.filter((cat) => {
    if (activeCategoryId !== null && cat.id !== activeCategoryId) return false;
    return items.some((i) => i.categoryId === cat.id);
  });

  // Tự động đóng Drawer khi giỏ hàng trống và không có lịch sử đơn hàng cũ
  useEffect(() => {
    if (cartItems.length === 0 && !lastOrder) {
      setMobileCartOpen(false);
    }
  }, [cartItems.length, lastOrder]);

  // ── Gọi món chính thức bằng Server Action ──
  const handleOrder = async () => {
    if (!sessionId || !sessionTableId || cartItems.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const executeSubmit = async (lat?: number, lng?: number) => {
      try {
        const result = await submitOrder({
          sessionId,
          tableId: sessionTableId,
          items: cartItems.map((i) => ({
            menuItemId: i.menuItemId,
            qty: i.qty,
            note: i.note || undefined,
          })),
          lat,
          lng,
        });

        if (result.success) {
          const updatedLastOrder = [...(lastOrder || [])];
          for (const cartItem of cartItems) {
            const existing = updatedLastOrder.find((i) => i.menuItemId === cartItem.menuItemId);
            if (existing) {
              existing.qty += cartItem.qty;
              if (cartItem.note) {
                existing.note = existing.note ? `${existing.note}, ${cartItem.note}` : cartItem.note;
              }
            } else {
              updatedLastOrder.push({ ...cartItem });
            }
          }
          setLastOrder(updatedLastOrder);
          clearCart();
          setMobileCartOpen(true); // Tiếp tục mở để khách tiện quan sát các món đã gọi
          showToast({
            type: 'success',
            message: '🍳 Gửi món lên hệ thống thành công! Nhà bếp đang xử lý.',
          });
        } else {
          lastGeoLocation.current = null; // Xoá cache định vị khi gặp lỗi để khách thử lại vị trí mới
          let errMsg = result.message || 'Có lỗi xảy ra khi gọi món.';
          if (result.errors && (result.errors as any).itemErrors) {
            const specificErrors = (result.errors as any).itemErrors.map((e: any) => e.message);
            errMsg = `Không thể đặt các món: ${specificErrors.join(', ')}`;
          }
          setSubmitError(errMsg);
          showToast({ type: 'error', message: errMsg });
        }
      } catch (networkErr) {
        lastGeoLocation.current = null; // Xoá cache định vị khi gặp lỗi mạng
        const errMsg = 'Mất kết nối mạng. Vui lòng kiểm tra lại kết nối và thử lại.';
        setSubmitError(errMsg);
        showToast({ type: 'error', message: errMsg });
        console.error('[MenuItemList] submitOrder error:', networkErr);
      } finally {
        setSubmitting(false);
      }
    };

    if (isGeofenceEnabled) {
      // 1. Kiểm tra cache định vị (nếu toạ độ đã lấy thành công trong vòng 60 giây qua, dùng luôn để tránh đè cổng định vị)
      if (lastGeoLocation.current && Date.now() - lastGeoLocation.current.timestamp < 60000) {
        console.log('[GPS Cache] Sử dụng toạ độ định vị đã lưu trong bộ đệm:', lastGeoLocation.current);
        executeSubmit(lastGeoLocation.current.lat, lastGeoLocation.current.lng);
        return;
      }

      if (!navigator.geolocation) {
        const errMsg = 'Trình duyệt không hỗ trợ định vị GPS để gọi món.';
        setSubmitError(errMsg);
        showToast({ type: 'error', message: errMsg });
        setSubmitting(false);
        return;
      }

      const getCoordinates = (onSuccess: (lat: number, lng: number) => void, onError: (err: GeolocationPositionError) => void) => {
        navigator.geolocation.getCurrentPosition(
          (position) => onSuccess(position.coords.latitude, position.coords.longitude),
          (error) => {
            if (error.code === 3 || error.code === 2) {
              console.warn('GPS High Accuracy failed or timed out, retrying with low accuracy...');
              navigator.geolocation.getCurrentPosition(
                (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude),
                onError,
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
              );
            } else {
              onError(error);
            }
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      };

      getCoordinates(
        (lat, lng) => {
          // Lưu vào bộ đệm cache định vị
          lastGeoLocation.current = { lat, lng, timestamp: Date.now() };
          executeSubmit(lat, lng);
        },
        (error) => {
          console.error('Customer geolocation error:', error);
          lastGeoLocation.current = null; // Xoá cache định vị khi lấy toạ độ thất bại
          let errMsg = 'Không thể xác định vị trí GPS.';
          if (error.code === 1) {
            errMsg = 'Quyền truy cập GPS bị chặn. Vui lòng cấp quyền định vị cho trình duyệt trên thanh địa chỉ để đặt món.';
          } else if (error.code === 2) {
            errMsg = 'Vị trí của bạn hiện không khả dụng. Vui lòng bật GPS trên thiết bị.';
          } else if (error.code === 3) {
            errMsg = 'Hết thời gian chờ lấy định vị GPS. Vui lòng thử đặt món lại.';
          }
          setSubmitError(errMsg);
          showToast({ type: 'error', message: errMsg });
          setSubmitting(false);
        }
      );
    } else {
      executeSubmit();
    }
  };

  const renderCartItems = (entries: CartItemEntry[], showActions: boolean = true) => (
    <div className="space-y-2">
      {entries.map((item) => (
        <div key={item.menuItemId} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="40px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">R</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
            <p className="text-[11px] text-amber-600 font-semibold tabular-nums">{fmt(item.price * item.qty)}</p>
          </div>

          {showActions ? (
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => handleUpdateQty(item.menuItemId, item.qty - 1)} disabled={loadingItemIds[item.menuItemId]} aria-label="Giảm" className="h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 cursor-pointer disabled:opacity-50">
                <Minus size={10} />
              </button>
              {loadingItemIds[item.menuItemId] ? (
                <Loader2 size={10} className="animate-spin text-amber-600 w-4 text-center" />
              ) : (
                <span className="text-xs font-bold text-gray-900 w-4 text-center tabular-nums">{item.qty}</span>
              )}
              <button type="button" onClick={() => handleUpdateQty(item.menuItemId, item.qty + 1)} disabled={loadingItemIds[item.menuItemId]} aria-label="Tăng" className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-50">
                <Plus size={10} />
              </button>
              <button type="button" onClick={() => handleUpdateQty(item.menuItemId, 0)} disabled={loadingItemIds[item.menuItemId]} aria-label="Xoá" className="h-6 w-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center cursor-pointer disabled:opacity-50">
                <Trash2 size={10} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">x{item.qty}</span>
              {item.status && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  item.status === 'VOID' ? 'bg-red-50 text-red-600' :
                  item.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' :
                  item.status === 'PREPARING' ? 'bg-amber-50 text-amber-600' :
                  'bg-orange-50 text-orange-600'
                }`}>
                  {item.status === 'VOID' ? 'Huỷ' : item.status === 'DONE' ? 'Xong' : item.status === 'PREPARING' ? 'Nấu' : 'Chờ'}
                </span>
              )}
            </div>
          )}
          {showActions && (
            <input
              type="text"
              placeholder="Ghi chú..."
              defaultValue={item.note || ''}
              disabled={loadingItemIds[item.menuItemId]}
              onBlur={(e) => {
                if (e.target.value !== (item.note || '')) {
                  handleUpdateNote(item.menuItemId, e.target.value);
                }
              }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-600 placeholder-gray-400 focus:outline-none focus:border-amber-400 disabled:opacity-50"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderProgressTracker = () => {
    if (dbOrderItems.length === 0) return null;

    const step1Done = dbOrderItems.length > 0;
    const step2Done = isLocked;
    
    const hasPreparing = dbOrderItems.some(item => item.status === 'PREPARING');
    const hasPending = dbOrderItems.some(item => item.status === 'PENDING');
    const hasDoneOrVoid = dbOrderItems.some(item => ['PREPARING', 'DONE', 'VOID'].includes(item.status));
    
    const step3Done = isLocked && hasDoneOrVoid;
    const step3Active = isLocked && hasPreparing;
    
    const step4Done = isLocked && dbOrderItems.length > 0 && !hasPending && !hasPreparing;

    const steps = [
      { id: 1, label: 'Gửi món', desc: 'Đã nhận yêu cầu', done: step1Done, active: !isLocked },
      { id: 2, label: 'Duyệt đơn', desc: 'Nhà hàng xác nhận', done: step2Done, active: isLocked && hasPending },
      { id: 3, label: 'Chế biến', desc: hasPreparing ? 'Bếp đang làm...' : 'Bếp chuẩn bị', done: step3Done, active: step3Active },
      { id: 4, label: 'Hoàn thành', desc: 'Sẵn sàng phục vụ', done: step4Done, active: step4Done }
    ];

    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-800">Tiến độ</h3>
          <span className="text-[11px] text-gray-400 font-medium">Bàn {tableNumber}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {steps.map((step, idx) => {
            const done = step.done;
            return (
              <div key={step.id} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${done ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? '✓' : step.id}
                </div>
                <span className={`text-[10px] font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {idx < steps.length - 1 && <div className={`flex-1 h-px ${done ? 'bg-amber-300' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {dbOrderItems.map((oi) => {
            const statusLabels: Record<string, { text: string, style: string }> = {
              PENDING: { text: 'Chờ duyệt', style: 'bg-orange-50 text-orange-600' },
              PREPARING: { text: 'Đang nấu', style: 'bg-amber-50 text-amber-600' },
              DONE: { text: 'Đã xong', style: 'bg-emerald-50 text-emerald-600' },
              VOID: { text: 'Đã huỷ', style: 'bg-red-50 text-red-600' }
            };
            const label = statusLabels[oi.status] || { text: oi.status, style: 'bg-gray-50 text-gray-600' };

            return (
              <div key={oi.id} className="flex items-center justify-between text-[11px] py-1 px-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 truncate">{oi.menuItem?.name || oi.menuItemName} x{oi.qty}</span>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${label.style}`}>
                  {label.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {!isConnected && (
        <div role="status" aria-live="polite" className="fixed top-20 right-4 z-50 flex items-center gap-1.5 bg-gray-900/90 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Đang kết nối...
        </div>
      )}

      {/* ── CategoryFilter sticky đỉnh trang ── */}
      <CategoryFilter
        categories={categories}
        activeId={activeCategoryId}
        onChange={handleCategoryChange}
      />

      {/* ══════════════════════════════════════════════════
          LAYOUT CHÍNH
          ══════════════════════════════════════════════════ */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4 flex-1 space-y-6 pb-28">
        {/* Banner Khóa bàn */}
        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-amber-900 leading-snug">Order đã được duyệt & khóa bàn</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Đơn hàng của bàn bạn đang được nhà hàng chuẩn bị. Bạn không thể tự ý thêm, sửa hoặc hủy món từ thiết bị của mình. Vui lòng liên hệ nhân viên phục vụ nếu cần thay đổi!
              </p>
            </div>
          </div>
        )}

        {/* Progress Tracker Realtime */}
        {isLocked && renderProgressTracker()}

        {visibleCategories.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          if (catItems.length === 0) return null;

          return (
            <section
              key={cat.id}
              id={`category-${cat.slug}`}
              aria-labelledby={`heading-${cat.id}`}
              className="scroll-mt-20"
            >
              <h2
                id={`heading-${cat.id}`}
                className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-2.5"
              >
                {cat.name}
              </h2>

              <div className="space-y-2">
                {catItems.map((item, index) => {
                  const card: MenuCardItem = {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    price: Number(item.price),
                    imageUrl: item.imageUrl,
                    isSoldOut: item.isSoldOut,
                  };
                  return <MenuCard key={item.id} item={card} onAddToCart={addToCart} priority={index < 2} />;
                })}
              </div>
            </section>
          );
        })}

        {visibleCategories.length === 0 && (
          <div className="py-20 text-center text-gray-400 text-sm font-light">
            Không tìm thấy món ăn nào thuộc danh mục này.
          </div>
        )}
      </main>

      {/* ── Floating Cart ── */}
      <button
        onClick={() => setMobileCartOpen(true)}
        type="button"
        aria-label="Xem giỏ hàng"
        className="fixed bottom-6 right-6 z-40 bg-amber-500 text-white shadow-lg rounded-full px-4 py-3 flex items-center gap-2 active:bg-amber-600 transition-colors cursor-pointer"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
              {totalItems}
            </span>
          )}
        </div>
        {totalItems > 0 && (
          <span className="font-bold text-sm tabular-nums">{fmt(subtotal)}</span>
        )}
      </button>



      {/* ── Cart Drawer ── */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50">
          <div onClick={() => setMobileCartOpen(false)} className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto bg-white rounded-t-2xl shadow-xl p-4 pb-6 flex flex-col max-h-[80vh]">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setCartTab('current')} type="button" className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${cartTab === 'current' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Đang gọi
                  {cartItems.length > 0 && <span className="ml-1 text-[10px] bg-amber-500 text-white rounded-full h-3.5 min-w-[14px] px-1 inline-flex items-center justify-center">{totalItems}</span>}
                </button>
                <button onClick={() => setCartTab('history')} type="button" className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${cartTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Đã gọi
                  {lastOrder && lastOrder.length > 0 && <span className="ml-1 text-[10px] bg-emerald-500 text-white rounded-full h-3.5 min-w-[14px] px-1 inline-flex items-center justify-center">{lastOrder.reduce((s, i) => s + i.qty, 0)}</span>}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {cartItems.length > 0 && cartTab === 'current' && (
                  <button onClick={clearCart} type="button" className="text-[11px] font-medium text-red-500 px-2 py-1 cursor-pointer">Xoá</button>
                )}
                <button onClick={() => setMobileCartOpen(false)} type="button" aria-label="Đóng" className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 mb-4 space-y-4">
              {isLocked ? (
                renderProgressTracker()
              ) : cartTab === 'current' ? (
                cartItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase">{totalItems} món</div>
                    {renderCartItems(cartItems, true)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                    <ShoppingBag size={36} strokeWidth={1} className="text-gray-200" />
                    <p className="text-sm text-gray-400">Chưa có món nào</p>
                  </div>
                )
              ) : (
                lastOrder && lastOrder.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Món đã gửi ({lastOrder.reduce((sum, i) => sum + i.qty, 0)})
                    </div>
                    {renderCartItems(lastOrder, false)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                    <Receipt size={36} strokeWidth={1} className="text-gray-200" />
                    <p className="text-sm text-gray-400">Chưa có đơn nào</p>
                  </div>
                )
              )}
            </div>

            {cartTab === 'current' && cartItems.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {submitError && (
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50">
                    <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-red-600">{submitError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Tổng</span>
                  <span className="text-base font-bold text-amber-600 tabular-nums">{fmt(subtotal)}</span>
                </div>
                <button
                  onClick={handleOrder}
                  type="button"
                  disabled={isSubmitting || !sessionId}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Đang gửi...</>
                  ) : (
                    <>Gửi món ({totalItems})</>
                  )}
                </button>
              </div>
            )}

            {cartTab === 'history' && lastOrder && lastOrder.length > 0 && (
              <button onClick={() => setMobileCartOpen(false)} type="button" className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium transition-colors cursor-pointer">
                Tiếp tục đặt món
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] max-w-xs w-[90%] flex items-start gap-2 p-3 rounded-xl shadow-lg text-white text-xs font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          {toast.type === 'success' ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span className="leading-snug flex-1">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Đóng">
            <X size={12} />
          </button>
        </div>
      )}
      {/* Màn hình Cảm ơn & Thanh toán thành công (Bàn trống) */}
      {isSessionClosed && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 animate-bounce">
            <CheckCircle size={40} />
          </div>
          {sessionClosedStatus === 'PAID' ? (
            <>
              <h2 className="text-xl font-black text-gray-900 mb-2">Thanh toán thành công!</h2>
              <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
                Hóa đơn cho bàn của bạn đã được thanh toán hoàn tất. Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của HiAI-MenuGo!
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Chúc quý khách một ngày tốt lành và hẹn gặp lại!
              </div>
            </>
          ) : sessionClosedStatus === 'CANCELLED' ? (
            <>
              <h2 className="text-xl font-black text-gray-900 mb-2">Đơn đã bị huỷ</h2>
              <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
                Đơn của bàn bạn đã bị huỷ do hết món. Vui lòng liên hệ nhân viên để được hỗ trợ thêm.
              </p>
              <div className="text-xs text-gray-400 font-medium">
                HiAI-MenuGo luôn sẵn sàng phục vụ quý khách.
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-gray-900 mb-2">Phiên đặt món đã kết thúc</h2>
              <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
                Phiên đặt món của bàn bạn đã đóng. Vui lòng liên hệ nhân viên nếu cần hỗ trợ thêm.
              </p>
              <div className="text-xs text-gray-400 font-medium">
                Cảm ơn quý khách đã sử dụng dịch vụ.
              </div>
            </>
          )}
        </div>
      )}
      {/* Màn hình Bàn đã có người đặt tại quầy */}
      {isOccupiedByPos && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 animate-pulse">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Bàn đã được đặt chỗ</h2>
          <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
            Bàn này hiện tại đã có người đặt hoặc đang được gọi món tại quầy. Vui lòng liên hệ nhân viên tại quầy thu ngân để được hỗ trợ.
          </p>
          <div className="text-xs text-gray-400 font-medium">
            Xin lỗi quý khách vì sự bất tiện này!
          </div>
        </div>
      )}
    </>
  );
}
