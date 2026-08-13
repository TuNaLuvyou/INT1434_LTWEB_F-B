'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, Receipt, X, Loader2, CheckCircle, AlertTriangle, CreditCard, Store, QrCode, Banknote, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

import MenuCard, { MenuCardItem, getCleanEnglishName } from '@/components/MenuCard';
import CategoryFilter from '@/components/CategoryFilter';
import { useMenuSoldOut } from '../hooks/useMenuSoldOut';
import { useCartStore, CartItem } from '@/stores/cart.store';
import { submitOrder, requestPayment, cancelPaymentRequest, VietQRData } from '@/app/actions/order.actions';
import { useCartSync } from '@/hooks/useCartSync';
import CustomerItemOptionsModal from './CustomerItemOptionsModal';


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
  englishName?: string | null;
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
  branding?: {
    displayName?: string | null;
    foodType?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
  } | null;
  tableDisplay?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (price: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

// ─── Component ────────────────────────────────────────────────────────────────

export default function MenuItemList({ initialItems, categories, branding, tableDisplay }: MenuItemListProps) {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params?.tableId as string;
  const primaryColor = branding?.primaryColor || '#7c3aed';
  const secondaryColor = branding?.secondaryColor || branding?.primaryColor || '#7c3aed';

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
  const storeIsLocked = useCartStore((s) => s.isLocked);
  const [isApprovedByPos, setIsApprovedByPos] = useState(false);
  const [latestBatchStage, setLatestBatchStage] = useState<'SUBMITTED' | 'APPROVED' | 'PREPARING' | 'DONE' | null>(null);
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
  const lastOrder = useCartStore((s) => s.lastOrder);
  const isSessionClosed = useCartStore((s) => s.isSessionClosed);
  const sessionClosedStatus = useCartStore((s) => s.sessionClosedStatus);
  const setLastOrder = useCartStore((s) => s.setLastOrder);
  const setSessionClosed = useCartStore((s) => s.setSessionClosed);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totalItems = mounted ? getTotalItems() : 0;
  const subtotal = mounted ? getTotalPrice() : 0;
  const safeCartItems = mounted ? cartItems : [];

  // ── UI state ──
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'current' | 'history'>('current');
  type CartItemEntry = CartItem & { status?: string };

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeoLocation = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [loadingItemIds, setLoadingItemIds] = useState<Record<string, boolean>>({});
  const [dbOrderItems, setDbOrderItems] = useState<any[]>([]);
  const [isOccupiedByPos, setIsOccupiedByPos] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedOptionsItem, setSelectedOptionsItem] = useState<any | null>(null);

  // ── Toast helper ──
  const showToast = (t: { type: 'success' | 'error'; message: string }) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Payment modal state ──
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  type PaymentStep = 'choose' | 'counter' | 'vietqr' | 'completed';
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('choose');
  const [vietqrData, setVietqrData] = useState<VietQRData | null>(null);
  const [requestingMethod, setRequestingMethod] = useState<'COUNTER' | 'VIETQR' | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // ── Loyalty / Customer states ──
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerData, setCustomerData] = useState<{
    id: string;
    phone: string;
    name?: string;
    points: number;
    membershipTier?: {
      id: string;
      name: string;
      discountPercent: number;
      color?: string;
    } | null;
    redeemValue: number;
    pointRedeemRate?: number;
  } | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUseInput, setPointsToUseInput] = useState<number | ''>('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Lock body scroll when payment modal or session closed screen is active
  useEffect(() => {
    const closed = isSessionClosed;
    if (paymentModalOpen || closed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [paymentModalOpen, isSessionClosed]);


  const fetchSessionDetails = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sid}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          if (result.data.session?.lockedAt || result.data.lockedAt) {
            setIsApprovedByPos(true);
          }
          const dbItems = result.data.orderItems || [];
          setDbOrderItems(dbItems);
          
          // Phân loại và đồng bộ giỏ hàng (CART) từ server
          const cartItems = dbItems.filter((oi: any) => oi.status === 'CART');
          useCartStore.getState().syncCartFromServer(cartItems);

          const placedItems = dbItems.filter((oi: any) => oi.status !== 'CART');

          if (placedItems.length > 0) {
            const mapped = placedItems.map((oi: any) => ({
              menuItemId: oi.menuItemId,
              name: oi.menuItem?.name || oi.menuItemName || '',
              englishName: oi.menuItem?.englishName || null,
              price: Number(oi.unitPrice),
              imageUrl: oi.menuItem?.imageUrl || null,
              qty: oi.qty,
              note: oi.note || '',
              status: oi.status,
            }));
            setLastOrder(mapped);
            setHasSubmitted(true);
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
    }, [showToast]),
    useCallback((event: { sessionId: string; status?: string }) => {
      if (event?.status === 'CANCELLED') {
        showToast({ type: 'error', message: 'Đơn đã bị huỷ do hết món. Bạn có thể gọi món mới.' });
        return;
      }
      clearCart();
      setLastOrder(null);
      setDbOrderItems([]);
      setIsApprovedByPos(false);
      setHasSubmitted(false);
      setLatestBatchStage(null);
      setSessionClosed((event?.status as any) || 'UNKNOWN');
    }, [clearCart, setLastOrder, setSessionClosed]),
    // onOrderStatusChanged: khi 1 món đổi status (vd: PREPARING, DONE, VOID)
    useCallback((event: any) => {
      if (sessionId) {
        setDbOrderItems(prev => {
          const targetId = event.orderItemId || '';
          const targetMenuId = event.menuItemId || '';
          const updated = prev.map(item => {
            if (item.id === targetId || item.orderItemId === targetId || item.menuItemId === targetMenuId) {
              return { ...item, status: event.status };
            }
            return item;
          });

          if (event.status === 'PREPARING') {
            setLatestBatchStage('PREPARING');
          } else {
            const placed = updated.filter((i: any) => i.status !== 'CART');
            if (placed.length > 0 && placed.every((i: any) => i.status === 'DONE' || i.status === 'DELIVERED' || i.status === 'SERVED' || i.status === 'VOID')) {
              setLatestBatchStage('DONE');
            }
          }
          return updated;
        });
        // Cập nhật lastOrder trong store nếu event có menuItemId
        if (event.menuItemId) {
          const store = useCartStore.getState();
          if (store.lastOrder) {
            const updatedLastOrder = store.lastOrder.map((item: any) =>
              item.menuItemId === event.menuItemId ? { ...item, status: event.status } : item
            );
            useCartStore.setState({ lastOrder: updatedLastOrder });
          }
        }
      }
    }, [sessionId]),
    // onCartUpdated: đồng bộ dbOrderItems từ sự kiện cart:updated (vd: thu ngân duyệt → PREPARING)
    useCallback((event: any) => {
      if (event.sessionId === sessionId && event.orderItems) {
        setDbOrderItems(event.orderItems);
        if (event.isLocked) {
          setIsApprovedByPos(true);
          setLatestBatchStage((prevStage) => {
            if (prevStage === 'SUBMITTED' || !prevStage) {
              return 'APPROVED';
            }
            return prevStage;
          });
        }
      }
    }, [sessionId]),
    // onPaymentPending: khách trên thiết bị khác cũng thấy QR (nếu cùng bàn)
    useCallback((event: any) => {
      if (event.sessionId === sessionId) {
        setVietqrData({
          paymentId: event.paymentId,
          paymentCode: event.paymentCode,
          qrUrl: event.qrUrl,
          total: event.total,
          bankName: event.bankName,
          accountNumber: event.accountNumber,
          accountName: event.accountName,
        });
        setPaymentStep('vietqr');
        setPaymentModalOpen(true);
      }
    }, [sessionId]),
    // onPaymentCompleted: đóng modal thanh toán và chuyển sang màn hình Cảm ơn ngoài (full screen)
    useCallback((event: any) => {
      if (event.sessionId === sessionId) {
        setPaymentModalOpen(false);
        setPaymentStep('choose');
        clearCart();
        setLastOrder(null);
        setDbOrderItems([]);
        setHasSubmitted(false);
        setSessionClosed('PAID');
      }
    }, [sessionId, clearCart, setLastOrder, setSessionClosed]),
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
  const storedTableId = useCartStore((s) => s.tableId);
  const clearCartRef = useRef(false);

  useEffect(() => {
    if (tableNumber) {
      setIsInitializing(true);
      if (storedTableId && storedTableId !== tableNumber && !clearCartRef.current) {
        clearCartRef.current = true;
        clearCart();
      }
      initSession(tableNumber).then(({ sessionId }) => {
        return fetchSessionDetails(sessionId);
      }).then(() => {
        setIsInitializing(false);
      }).catch((err) => {
        setIsInitializing(false);
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
    } else {
      setIsInitializing(false);
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
      setSessionClosed((detail?.status as any) || 'UNKNOWN');
    };
    window.addEventListener('session-closed', handleSessionClosed);
    return () => {
      window.removeEventListener('session-closed', handleSessionClosed);
    };
  }, [setSessionClosed]);

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

  // ── Phone / Loyalty handlers ──
  const handleSkipPhoneModal = () => {
    setPhoneModalOpen(false);
    setCustomerData(null);
    setPaymentStep('choose');
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handleConfirmPhone = async () => {
    const cleanPhone = customerPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      setPhoneError('Vui lòng nhập số điện thoại hợp lệ (9-12 chữ số).');
      return;
    }
    setIsCheckingPhone(true);
    setPhoneError(null);
    try {
      const res = await fetch(`${API_URL}/api/customer/lookup-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, sessionId }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setCustomerData(result.data);
        if (result.data.points > 0) {
          setUsePoints(true);
          setPointsToUseInput(result.data.points);
        }
      }
    } catch (err) {
      console.error('[handleConfirmPhone] error:', err);
    } finally {
      setIsCheckingPhone(false);
      setPhoneModalOpen(false);
      setPaymentStep('choose');
      setPaymentError(null);
      setPaymentModalOpen(true);
    }
  };

  // ── Payment handler ──
  const handleBackToChoose = useCallback(async () => {
    if (sessionId && vietqrData) {
      cancelPaymentRequest({ sessionId });
    }
    setVietqrData(null);
    setPaymentStep('choose');
  }, [sessionId, vietqrData]);

  const handleCancelPayment = useCallback(async () => {
    if (sessionId && vietqrData) {
      cancelPaymentRequest({ sessionId });
    }
    setVietqrData(null);
    setPaymentStep('choose');
    setPaymentModalOpen(false);
  }, [sessionId, vietqrData]);

  const handleRequestPayment = async (method: 'COUNTER' | 'VIETQR') => {
    if (!sessionId) return;
    setRequestingMethod(method);
    setPaymentError(null);
    try {
      if (method === 'COUNTER' && vietqrData) {
        cancelPaymentRequest({ sessionId });
        setVietqrData(null);
      }
      const pointsToUse = typeof pointsToUseInput === 'number' ? pointsToUseInput : undefined;
      const result = await requestPayment({
        sessionId,
        method,
        customerPhone: customerData?.phone,
        usePoints: customerData && usePoints ? true : false,
        pointsToUse,
      });
      if (!result.success) {
        setPaymentError(result.message);
        return;
      }
      if (result.method === 'COUNTER') {
        setPaymentStep('counter');
      } else {
        setVietqrData(result.data);
        setPaymentStep('vietqr');
      }
    } catch {
      setPaymentError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setRequestingMethod(null);
    }
  };


  // ── Cart actions bridge ──
  const addToCart = useCallback((itemId: string) => {
    if (isLocked) {
      showToast({ type: 'error', message: 'Order đang được chuẩn bị bởi nhà hàng — không thể thêm món mới.' });
      return;
    }
    const found = items.find((i) => i.id === itemId);
    if (!found || found.isSoldOut) return;
    registerActivity();
    setSelectedOptionsItem(found);
  }, [items, registerActivity, isLocked]);

  const handleConfirmAddToCartWithOptions = useCallback(async (payload: any) => {
    if (isLocked) {
      showToast({ type: 'error', message: 'Order đang được chuẩn bị bởi nhà hàng — không thể thêm món mới.' });
      return;
    }
    setLoadingItemIds((prev) => ({ ...prev, [payload.menuItemId]: true }));
    try {
      await addItem({
        menuItemId: payload.menuItemId,
        name: payload.name,
        englishName: payload.englishName,
        price: payload.price,
        imageUrl: payload.imageUrl,
        qty: payload.quantity,
        note: payload.optionsNote,
      });
      showToast({ type: 'success', message: `Đã thêm ${payload.name} vào đơn!` });
    } finally {
      setLoadingItemIds((prev) => ({ ...prev, [payload.menuItemId]: false }));
    }
  }, [addItem, isLocked]);

  const visibleCategories = categories.filter((cat) => {
    if (activeCategoryId !== null && cat.id !== activeCategoryId) return false;
    return items.some((i) => i.categoryId === cat.id);
  });

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
          setCartTab('history');
          setHasSubmitted(true);
          setLatestBatchStage('SUBMITTED');
          setIsApprovedByPos(false);
          setMobileCartOpen(true); // Tiếp tục mở để khách tiện quan sát các món đã gọi
          // Cập nhật dbOrderItems ngay lập tức để hiện tiến độ mà không cần đợi thu ngân duyệt
          fetchSessionDetails(sessionId);
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
      {entries.map((item, idx) => (
        <div key={(item as any).id || `${item.menuItemId}-${idx}`} className="bg-gray-50 rounded-xl px-3 py-2 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="40px" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">R</div>
              )}
            </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">
              {item.name}
              {getCleanEnglishName(item.name, (item as any).englishName) && (
                <span className="ml-1 text-[10px] font-normal text-gray-400">
                  ({getCleanEnglishName(item.name, (item as any).englishName)})
                </span>
              )}
            </p>
            <p className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>{fmt(item.price * item.qty)}</p>
          </div>

          {showActions ? (
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => handleUpdateQty(item.menuItemId, item.qty - 1)} disabled={loadingItemIds[item.menuItemId]} aria-label="Giảm" className="h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 cursor-pointer disabled:opacity-50">
                <Minus size={10} />
              </button>
              {loadingItemIds[item.menuItemId] ? (
                <Loader2 size={10} className="animate-spin w-4 text-center" style={{ color: 'var(--color-primary)' }} />
              ) : (
                <span className="text-xs font-bold text-gray-900 w-4 text-center tabular-nums">{item.qty}</span>
              )}
              <button type="button" onClick={() => handleUpdateQty(item.menuItemId, item.qty + 1)} disabled={loadingItemIds[item.menuItemId]} aria-label="Tăng" className="h-6 w-6 rounded-full text-white flex items-center justify-center cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90 active:opacity-80" style={{ backgroundColor: 'var(--color-primary)' }}>
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
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={item.status === 'VOID' ? { backgroundColor: '#fef2f2', color: '#dc2626' } : { backgroundColor: `${primaryColor}18`, color: primaryColor }}>
                  {item.status === 'VOID' ? 'Huỷ' : item.status === 'DONE' ? 'Xong' : item.status === 'PREPARING' ? 'Nấu' : 'Chờ'}
                </span>
              )}
            </div>
          )}
          </div>
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
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-600 placeholder-gray-400 focus:outline-none disabled:opacity-50"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderProgressTracker = () => {
    // Chỉ lấy các món đã gửi đặt (loại bỏ món nháp trong giỏ CART)
    const placedItems = dbOrderItems.filter(item => item.status !== 'CART');
    if (placedItems.length === 0) return null;

    const hasPending = placedItems.some(item => item.status === 'PENDING');
    const hasPreparing = placedItems.some(item => item.status === 'PREPARING');
    const isAllDone = placedItems.length > 0 && placedItems.every(item => item.status === 'DONE' || item.status === 'DELIVERED' || item.status === 'SERVED' || item.status === 'VOID');

    // Xác định stage của đợt món mới nhất
    let stage = latestBatchStage;
    if (!stage) {
      if (hasPending) {
        stage = (isApprovedByPos || storeIsLocked) ? 'APPROVED' : 'SUBMITTED';
      } else if (hasPreparing) {
        stage = 'PREPARING';
      } else if (isAllDone) {
        stage = 'DONE';
      } else if (isApprovedByPos || storeIsLocked) {
        stage = 'APPROVED';
      } else {
        stage = 'SUBMITTED';
      }
    }

    const isStep2Done = stage === 'APPROVED' || stage === 'PREPARING' || stage === 'DONE';
    const isStep3Done = stage === 'PREPARING' || stage === 'DONE';
    const isStep4Done = stage === 'DONE';

    const steps = [
      { id: 1, label: 'Gửi món', done: true },
      { id: 2, label: 'Duyệt đơn', done: isStep2Done },
      { id: 3, label: 'Chế biến', done: isStep3Done },
      { id: 4, label: 'Hoàn thành', done: isStep4Done }
    ];

    return (
      <div className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs p-3.5 sm:p-4 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-800">Tiến độ đợt món</h3>
          <span className="text-[11px] text-gray-400 font-medium">Bàn {tableDisplay || tableNumber}</span>
        </div>

        <div className="flex items-center w-full">
          {steps.map((step, idx) => {
            const done = step.done;
            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  <div className={`flex-1 ${idx === 0 ? 'invisible' : ''}`}>
                    {idx > 0 && <div className="h-px" style={{ backgroundColor: step.done ? primaryColor : '#e5e7eb', opacity: step.done ? 0.5 : 1 }} />}
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors shrink-0 ${done ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                    style={done ? { backgroundColor: primaryColor } : {}}>
                    {done ? '✓' : step.id}
                  </div>
                  <div className={`flex-1 ${idx === steps.length - 1 ? 'invisible' : ''}`}>
                    {idx < steps.length - 1 && <div className="h-px" style={{ backgroundColor: steps[idx + 1]?.done ? primaryColor : '#e5e7eb', opacity: steps[idx + 1]?.done ? 0.5 : 1 }} />}
                  </div>
                </div>
                <span className={`text-[10px] font-medium mt-1 text-center ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.label}
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
      <style>{`
        .payment-method-card:hover {
          border-color: var(--card-color) !important;
          background-color: color-mix(in srgb, var(--card-color) 10%, transparent) !important;
        }
        .payment-method-card:hover .payment-method-icon,
        .payment-method-card:hover .payment-method-title {
          color: var(--card-color) !important;
        }
      `}</style>
      {!isConnected && (
        <div role="status" aria-live="polite" className="fixed top-20 right-4 z-50 flex items-center gap-1.5 bg-gray-900/90 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
      <main className="max-w-2xl mx-auto w-full px-3.5 py-3 sm:px-4 sm:py-4 flex-1 space-y-4 sm:space-y-6 pb-4 sm:pb-6">
        {isInitializing ? (
          <div className="space-y-6 animate-pulse pt-2">
            {/* Items Skeleton */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex gap-3.5 items-center">
                  <div className="w-20 h-20 bg-gray-200/80 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200/80 rounded-md w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-md w-1/2" />
                    <div className="h-4 rounded-md w-1/4 mt-2" style={{ backgroundColor: `${primaryColor}25` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
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
        {dbOrderItems.some(item => item.status !== 'CART') && renderProgressTracker()}

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
                    englishName: item.englishName,
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
          </>
        )}
      </main>

      {/* ── Floating Cart ── */}
      <button
        onClick={() => setMobileCartOpen(true)}
        type="button"
        aria-label="Xem giỏ hàng"
        className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 text-white rounded-full px-4 py-3 flex items-center gap-2.5 transition-all duration-300 ease-out active:scale-95 cursor-pointer backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          boxShadow: `0 8px 25px -4px color-mix(in srgb, ${primaryColor} 50%, transparent)`,
        }}
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          {totalItems > 0 ? (
            <span className="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm">
              {totalItems}
            </span>
          ) : lastOrder && lastOrder.length > 0 ? (
            <span className="absolute -top-2.5 -right-2.5 bg-blue-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm">
              {lastOrder.reduce((s, i) => s + i.qty, 0)}
            </span>
          ) : null}
        </div>
        {totalItems > 0 ? (
          <span className="font-bold text-sm tabular-nums">{fmt(subtotal)}</span>
        ) : lastOrder && lastOrder.length > 0 ? (
          <span className="font-bold text-sm tabular-nums">{fmt(lastOrder.reduce((s, i) => s + Number(i.price) * i.qty, 0))}</span>
        ) : null}
      </button>



      {/* ── Cart Drawer ── */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50">
          <div onClick={() => setMobileCartOpen(false)} className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto bg-white rounded-t-2xl shadow-xl p-3 sm:p-4 pb-6 flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setCartTab('current')} type="button" className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${cartTab === 'current' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Đang gọi
                  {safeCartItems.length > 0 && <span className="ml-1 text-[10px] text-white rounded-full h-3.5 min-w-[14px] px-1 inline-flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>{totalItems}</span>}
                </button>
                <button onClick={() => setCartTab('history')} type="button" className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${cartTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Đã gọi
                  {lastOrder && lastOrder.length > 0 && <span className="ml-1 text-[10px] bg-blue-500 text-white rounded-full h-3.5 min-w-[14px] px-1 inline-flex items-center justify-center">{lastOrder.reduce((s, i) => s + i.qty, 0)}</span>}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {safeCartItems.length > 0 && cartTab === 'current' && (
                  <button onClick={clearCart} type="button" className="text-[11px] font-medium text-red-500 px-2 py-1 cursor-pointer">Xoá</button>
                )}
                <button onClick={() => setMobileCartOpen(false)} type="button" aria-label="Đóng" className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 mb-4 space-y-4">
              {cartTab === 'current' ? (
                safeCartItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase">{totalItems} món</div>
                    {renderCartItems(safeCartItems, true)}
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

            {cartTab === 'current' && safeCartItems.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {submitError && (
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50">
                    <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-red-600">{submitError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Tổng</span>
                  <span className="text-base font-bold tabular-nums" style={{ color: 'var(--color-secondary)' }}>{fmt(subtotal)}</span>
                </div>
                <button
                  onClick={handleOrder}
                  type="button"
                  disabled={isSubmitting || !sessionId}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  style={{ background: isSubmitting ? secondaryColor : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  {isSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Đang gửi...</>
                  ) : (
                    <>Gửi món ({totalItems})</>
                  )}
                </button>
              </div>
            )}

            {cartTab === 'history' && !isInitializing && lastOrder && lastOrder.length > 0 && (
              <div className="space-y-2">
                {!lastOrder.some((item) => item.status === 'PENDING') && lastOrder.some((item) => item.status !== 'VOID') && (
                  <button
                    onClick={() => {
                      setCustomerPhone('');
                      setPhoneError(null);
                      setPhoneModalOpen(true);
                      setMobileCartOpen(false);
                    }}
                    type="button"
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer shadow-md active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                  >
                    <CreditCard size={16} />
                    Thanh toán
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Loyalty Phone Input Modal ── */}
      {phoneModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 overflow-hidden">
          <div onClick={handleSkipPhoneModal} className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative z-[75] w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Tích điểm & Ưu đãi</h2>
                <p className="text-xs text-gray-500">Nhập SĐT để tích điểm cho đơn hàng này</p>
              </div>
              <button
                onClick={handleSkipPhoneModal}
                type="button"
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                title="Bỏ qua"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 my-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Số điện thoại của bạn
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setPhoneError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmPhone();
                  }}
                  placeholder="Số điện thoại"
                  className="w-full px-4 py-3.5 text-base font-semibold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-2xl placeholder:text-gray-400 placeholder:font-normal focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-200 outline-none transition-all"
                  autoFocus
                />
                {phoneError && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{phoneError}</p>
                )}
              </div>

              <button
                onClick={handleConfirmPhone}
                disabled={isCheckingPhone}
                type="button"
                className="w-full py-3.5 px-4 text-white rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, boxShadow: `0 4px 14px ${primaryColor}33` }}
              >
                {isCheckingPhone ? <Loader2 size={18} className="animate-spin" /> : null}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Method Modal ── */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div onClick={handleCancelPayment} className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative z-[70] w-full max-w-md sm:max-w-lg mx-auto bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-4 sm:p-7 flex flex-col max-h-[96vh] overflow-y-auto scrollbar-none">

            {/* ── Step: choose ── */}
            {paymentStep === 'choose' && (
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Chọn phương thức thanh toán</h2>
                  <button onClick={handleCancelPayment} type="button" className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer">
                    <X size={16} />
                  </button>
                </div>

                {paymentError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 mb-4">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">{paymentError}</p>
                  </div>
                )}

                {customerData && (
                  <div
                    className="rounded-2xl p-3.5 sm:p-4 mb-4 space-y-3 shadow-xs border transition-all duration-300"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${primaryColor} 6%, #ffffff)`,
                      borderColor: `color-mix(in srgb, ${primaryColor} 20%, #e5e7eb)`,
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <span className="font-medium">SĐT tích điểm:</span>
                        <strong className="text-gray-900 font-mono text-xs sm:text-sm">{customerData.phone}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        {customerData.membershipTier && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-900 shadow-xs inline-flex items-center shrink-0"
                            style={{ backgroundColor: customerData.membershipTier.color || '#ffd700' }}
                          >
                            Hạng {customerData.membershipTier.name} (-{customerData.membershipTier.discountPercent}%)
                          </span>
                        )}
                        <span
                          className="text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs inline-flex items-center shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {customerData.points} điểm
                        </span>
                      </div>
                    </div>

                    {customerData.points > 0 ? (
                      <div
                        className="pt-2.5 border-t space-y-2.5"
                        style={{ borderColor: `color-mix(in srgb, ${primaryColor} 20%, #e5e7eb)` }}
                      >
                        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                          <span className="text-xs font-bold text-gray-900">
                            Dùng điểm giảm giá
                          </span>
                          <input
                            type="checkbox"
                            checked={usePoints}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setUsePoints(isChecked);
                              if (isChecked) {
                                setPointsToUseInput(customerData.points);
                              } else {
                                setPointsToUseInput(0);
                              }
                            }}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: primaryColor }}
                          />
                        </label>

                        {usePoints && (
                          <div
                            className="bg-white rounded-xl p-3 border space-y-3 shadow-xs"
                            style={{ borderColor: `color-mix(in srgb, ${primaryColor} 25%, #e5e7eb)` }}
                          >
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-gray-600 font-medium">Số điểm muốn dùng:</span>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1 flex items-center">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    enterKeyHint="done"
                                    min={0}
                                    max={customerData.points}
                                    value={pointsToUseInput}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? '' : Math.max(0, Math.min(customerData.points, Number(e.target.value)));
                                      setPointsToUseInput(val);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLElement).blur();
                                      }
                                    }}
                                    placeholder="0"
                                    className="w-full pl-3 pr-11 py-2 border rounded-xl text-right font-mono text-sm font-bold text-gray-900 focus:outline-none bg-white"
                                    style={{ borderColor: `color-mix(in srgb, ${primaryColor} 40%, #d1d5db)` }}
                                  />
                                  <span className="absolute right-3 text-xs text-gray-400 font-medium pointer-events-none">điểm</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const activeEl = document.activeElement as HTMLElement;
                                    if (activeEl && typeof activeEl.blur === 'function') {
                                      activeEl.blur();
                                    }
                                  }}
                                  className="px-3.5 py-2 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                                >
                                  Xác nhận
                                </button>
                              </div>
                            </div>

                            {/* Calculated Discount Preview */}
                            <div className="flex items-center justify-between text-xs pt-2.5 border-t border-gray-100">
                              <span className="font-semibold text-gray-600">Số tiền giảm:</span>
                              <span className="text-sm font-extrabold font-mono text-emerald-600">
                                -{((typeof pointsToUseInput === 'number' ? pointsToUseInput : 0) * (customerData.pointRedeemRate || 100)).toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 pt-1">
                        ✨ Đơn hàng này sẽ tự động tích điểm cho bạn sau khi thanh toán thành công!
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 my-4">
                  {/* Card: Thanh toán tại quầy */}
                  <button
                    onClick={() => handleRequestPayment('COUNTER')}
                    disabled={requestingMethod !== null}
                    type="button"
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed payment-method-card"
                    style={{ '--card-color': primaryColor } as React.CSSProperties}
                  >
                    {requestingMethod === 'COUNTER' ? <Loader2 size={32} className="animate-spin text-gray-400" /> : <Store size={32} className="text-gray-500 payment-method-icon" />}
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-800 payment-method-title">Tại quầy</p>
                      <p className="text-xs text-gray-400 mt-1">Ra quầy thu ngân</p>
                    </div>
                  </button>

                  {/* Card: VietQR */}
                  <button
                    onClick={() => handleRequestPayment('VIETQR')}
                    disabled={requestingMethod !== null}
                    type="button"
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed payment-method-card"
                    style={{ '--card-color': primaryColor } as React.CSSProperties}
                  >
                    {requestingMethod === 'VIETQR' ? <Loader2 size={32} className="animate-spin text-gray-400" /> : <QrCode size={32} className="text-gray-500 payment-method-icon" />}
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-800 payment-method-title">Chuyển khoản</p>
                      <p className="text-xs text-gray-400 mt-1">Chuyển khoản tại bàn</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: counter ── */}
            {paymentStep === 'counter' && (
              <div className="flex flex-col items-center justify-center flex-1 py-8 gap-5 text-center my-auto">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}18` }}>
                  <Store size={40} style={{ color: primaryColor }} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Vui lòng ra quầy thu ngân</h2>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                  Hãy di chuyển đến quầy thu ngân của nhà hàng để thanh toán. Nhân viên sẽ hỗ trợ bạn ngay.
                </p>
                <button
                  onClick={() => { setPaymentModalOpen(false); setPaymentStep('choose'); }}
                  type="button"
                  className="mt-3 px-8 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* ── Step: vietqr ── */}
            {paymentStep === 'vietqr' && vietqrData && (
              <div className="flex flex-col items-center w-full space-y-3">
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={handleBackToChoose}
                    type="button"
                    className="h-8 px-3 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 transition-colors cursor-pointer font-semibold"
                  >
                    <ArrowLeft size={16} /> Quay lại
                  </button>
                  <button
                    onClick={handleCancelPayment}
                    type="button"
                    className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="text-center pt-1">
                  <h2 className="text-lg font-bold text-gray-900">Quét mã để thanh toán</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Sử dụng ứng dụng ngân hàng để quét mã QR bên dưới</p>
                </div>

                {/* QR Code */}
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-4 shadow-md shrink-0 my-1"
                  style={{ borderColor: `${primaryColor}30` }}>
                  <Image src={vietqrData.qrUrl} alt="VietQR Code" fill className="object-contain" sizes="224px" />
                </div>

                {/* Thông tin chuyển khoản */}
                <div className="w-full bg-gray-50 rounded-2xl p-4 sm:p-5 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Tạm tính (Tiền món)</span>
                    <span className="font-semibold text-gray-800">{fmt(vietqrData.subtotal ?? Math.round(vietqrData.total / 1.1))}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Thuế VAT (10%)</span>
                    <span className="font-semibold text-gray-800">{fmt(vietqrData.tax ?? (vietqrData.total - Math.round(vietqrData.total / 1.1)))}</span>
                  </div>
                  {(vietqrData.discountAmount ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-amber-700 font-medium">
                      <span>Giảm giá {vietqrData.pointsRedeemed ? `(Tích điểm ${vietqrData.pointsRedeemed} điểm)` : '(Giảm giá)'}</span>
                      <span className="font-bold text-emerald-600">-{fmt(vietqrData.discountAmount!)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-gray-900 font-bold">
                    <span>Tổng thanh toán</span>
                    <span className="text-base sm:text-lg font-extrabold" style={{ color: primaryColor }}>{fmt(vietqrData.total)}</span>
                  </div>
                  {vietqrData.bankName && (
                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-2">
                      <span className="text-gray-500">Ngân hàng</span>
                      <span className="font-semibold text-gray-800">{vietqrData.bankName}</span>
                    </div>
                  )}
                  {vietqrData.accountNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Số tài khoản</span>
                      <span className="font-bold text-gray-900 tracking-wide">{vietqrData.accountNumber}</span>
                    </div>
                  )}
                  {vietqrData.accountName && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Chủ tài khoản</span>
                      <span className="font-semibold text-gray-800">{vietqrData.accountName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-200/60 pt-2">
                    <span className="text-gray-500">Nội dung CK</span>
                    <span className="font-bold px-2.5 py-0.5 rounded-md text-xs sm:text-sm"
  style={{ color: primaryColor, backgroundColor: `${primaryColor}18` }}>{vietqrData.paymentCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <Loader2 size={14} className="animate-spin" style={{ color: primaryColor }} />
                  Đang chờ xác nhận từ nhà hàng...
                </div>
              </div>
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
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 touch-none overscroll-none">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 animate-bounce">
            <CheckCircle size={40} />
          </div>
          {sessionClosedStatus === 'PAID' ? (
            <>
              <h2 className="text-xl font-black text-gray-900 mb-2">Thanh toán thành công!</h2>
              <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                Hóa đơn cho bàn của bạn đã được thanh toán hoàn tất. Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của HiAI-MenuGo!
              </p>
              {sessionId && (
                <a
                  href={`/receipt/${sessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mb-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Receipt size={18} />
                  <span>Xem hoá đơn (E-Receipt)</span>
                </a>
              )}
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

      {/* Modal Tùy chỉnh món ăn / Đồ uống cho Khách hàng QR */}
      <CustomerItemOptionsModal
        isOpen={!!selectedOptionsItem}
        item={selectedOptionsItem}
        onClose={() => setSelectedOptionsItem(null)}
        onAddToCart={handleConfirmAddToCartWithOptions}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
      />
    </>
  );
}
