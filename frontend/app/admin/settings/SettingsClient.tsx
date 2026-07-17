'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, MapPin, Compass, Loader2, Save, Info, Shield, CheckCircle2, CreditCard, Store, Edit3, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';


const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SettingsClient() {
  const [restaurantName, setRestaurantName] = useState('');
  const [activeTab, setActiveTab] = useState<'geofence' | 'sync' | 'info' | 'branches'>('geofence');
  
  // Geofencing states
  const [isGeofenceEnabled, setIsGeofenceEnabled] = useState(false);
  const [restaurantLat, setRestaurantLat] = useState<string>('');
  const [restaurantLng, setRestaurantLng] = useState<string>('');
  const [maxOrderDistance, setMaxOrderDistance] = useState<number>(100);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API}/api/system/config`, {
          headers: { 'Authorization': `Bearer ${getAccessTokenFromCookie()}` }
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            setRestaurantName(result.data.restaurantName || '');
            setIsGeofenceEnabled(result.data.isGeofenceEnabled ?? false);
            setRestaurantLat(result.data.restaurantLat !== null ? String(result.data.restaurantLat) : '');
            setRestaurantLng(result.data.restaurantLng !== null ? String(result.data.restaurantLng) : '');
            setMaxOrderDistance(result.data.maxOrderDistance ?? 100);
          }
        }
        
        // Fetch system info
        const infoRes = await fetch(`${API}/api/system/info`, {
          headers: { 'Authorization': `Bearer ${getAccessTokenFromCookie()}` }
        });
        if (infoRes.ok) {
          const infoResult = await infoRes.json();
          if (infoResult.success && infoResult.data) {
            setSystemInfo(infoResult.data);
          } else {
            setSystemInfo({ error: 'Không thể lấy thông tin bản quyền' });
          }
        } else {
          setSystemInfo({ 
            error: true, 
            tenantName: 'Hệ thống Trung tâm', 
            domain: 'platform.local', 
            planName: 'Bản quyền Nền tảng (Platform)', 
            planDescription: 'Không có giới hạn tính năng',
            features: ['ALL_FEATURES', 'CORE_POS', 'PROMOTION_ENGINE'],
            createdAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Lỗi khi fetch config', err);
        toast.error('Không thể tải cấu hình từ server.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    const toastId = toast.loading('Đang định vị toạ độ thiết bị hiện tại...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestaurantLat(position.coords.latitude.toFixed(8));
        setRestaurantLng(position.coords.longitude.toFixed(8));
        toast.success('Đã lấy toạ độ vị trí hiện tại!', { id: toastId });
      },
      (error) => {
        console.error('Geolocation error:', error);
        let msg = 'Lấy toạ độ thất bại.';
        if (error.code === 1) {
          msg += ' Quyền truy cập GPS bị chặn. Hãy bấm vào biểu tượng khoá trên thanh địa chỉ để cấp quyền.';
        } else if (error.code === 2) {
          msg += ' Vị trí không khả dụng (hãy kiểm tra mục Sensors trong DevTools có đang tắt vị trí không).';
        } else if (error.code === 3) {
          msg += ' Hết thời gian chờ lấy định vị.';
        }
        toast.error(msg, { id: toastId });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeofenceEnabled) {
      if (!restaurantLat || !restaurantLng) {
        toast.error('Vui lòng điền đầy đủ toạ độ vĩ độ và kinh độ của quán khi bật định vị.');
        return;
      }
      const latNum = Number(restaurantLat);
      const lngNum = Number(restaurantLng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        toast.error('Toạ độ phải là số hợp lệ.');
        return;
      }
      if (latNum < -90 || latNum > 90) {
        toast.error('Vĩ độ (Latitude) phải nằm trong khoảng từ -90 đến 90.');
        return;
      }
      if (lngNum < -180 || lngNum > 180) {
        toast.error('Kinh độ (Longitude) phải nằm trong khoảng từ -180 đến 180.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/system/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessTokenFromCookie()}`
        },
        body: JSON.stringify({
          restaurantName,
          isGeofenceEnabled,
          restaurantLat: restaurantLat === '' ? null : Number(restaurantLat),
          restaurantLng: restaurantLng === '' ? null : Number(restaurantLng),
          maxOrderDistance: Number(maxOrderDistance)
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          toast.success('Lưu cấu hình hệ thống thành công!');
          setRestaurantName(result.data.restaurantName || '');
          setIsGeofenceEnabled(result.data.isGeofenceEnabled ?? false);
          setRestaurantLat(result.data.restaurantLat !== null ? String(result.data.restaurantLat) : '');
          setRestaurantLng(result.data.restaurantLng !== null ? String(result.data.restaurantLng) : '');
          setMaxOrderDistance(result.data.maxOrderDistance ?? 100);
        } else {
          toast.error(result.message || 'Lưu cấu hình thất bại');
        }
      } else {
        if (res.status === 401 || res.status === 403) {
          toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          setTimeout(() => {
            window.location.href = '/login?reason=expired';
          }, 1500);
        } else {
          toast.error('Lỗi phản hồi từ máy chủ khi lưu cấu hình.');
        }
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncMenu = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API}/api/admin/menu/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAccessTokenFromCookie()}` }
      });
      if (res.ok) {
        toast.success('Đồng bộ thành công! Menu đã được cập nhật.');
      } else {
        toast.error('Đồng bộ thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi đồng bộ thực đơn');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400">
        <Loader2 className="animate-spin text-violet-500 h-10 w-10 mb-4" />
        <p className="text-sm font-semibold">Đang tải cấu hình hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full px-2 sm:px-4">
      {/* Premium Dark-Theme Responsive Tab Bar */}
      <div className="flex border-b border-zinc-800 overflow-x-auto pb-px gap-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('geofence')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'geofence'
              ? 'border-violet-500 text-violet-400 font-black bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          } rounded-t-xl`}
        >
          <MapPin className="h-4.5 w-4.5 shrink-0" />
          <span>Định vị (Geofencing)</span>
        </button>
        
        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'sync'
              ? 'border-violet-500 text-violet-400 font-black bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          } rounded-t-xl`}
        >
          <RefreshCw className="h-4.5 w-4.5 shrink-0" />
          <span>Đồng bộ thực đơn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'info'
              ? 'border-violet-500 text-violet-400 font-black bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          } rounded-t-xl`}
        >
          <Info className="h-4.5 w-4.5 shrink-0" />
          <span>Thông tin phần mềm</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'branches'
              ? 'border-violet-500 text-violet-400 font-black bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          } rounded-t-xl`}
        >
          <Store className="h-4.5 w-4.5 shrink-0" />
          <span>Chi nhánh</span>
        </button>
      </div>

      {/* Tab content area */}
      <div className="transition-all duration-300">
        {activeTab === 'geofence' && (
            <form onSubmit={handleSaveConfig} className="space-y-6 max-w-2xl mx-auto">
            {/* Card: Cấu hình định vị (Geofencing) */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
                    <MapPin className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">Giới hạn định vị (Geofencing)</h3>
                    <p className="text-[10px] text-zinc-500 font-semibold mt-0.5 leading-relaxed">
                      Yêu cầu khách hàng ở gần vị trí quán mới được phép đặt món
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setIsGeofenceEnabled(!isGeofenceEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isGeofenceEnabled ? 'bg-violet-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isGeofenceEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isGeofenceEnabled ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Vĩ độ quán (Latitude)</label>
                      <input
                        type="text"
                        value={restaurantLat}
                        onChange={(e) => setRestaurantLat(e.target.value)}
                        placeholder="Ví dụ: 21.028511"
                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-violet-500/40 text-sm font-semibold rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Kinh độ quán (Longitude)</label>
                      <input
                        type="text"
                        value={restaurantLng}
                        onChange={(e) => setRestaurantLng(e.target.value)}
                        placeholder="Ví dụ: 105.854167"
                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-violet-500/40 text-sm font-semibold rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-2xl">
                    <div className="text-xs text-zinc-400 font-medium leading-relaxed">
                      💡 Bạn có thể đứng tại tâm của nhà hàng và bấm nút để điền tự động toạ độ GPS chính xác của thiết bị này.
                    </div>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-violet-400 border border-zinc-700 hover:border-violet-500/30 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer w-full md:w-auto"
                    >
                      <Compass className="h-4 w-4 shrink-0" />
                      Lấy GPS hiện tại
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Bán kính cho phép đặt món</label>
                      <span className="font-mono text-xs font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">
                        {maxOrderDistance}m
                      </span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <input
                        type="range"
                        min="30"
                        max="500"
                        step="10"
                        value={maxOrderDistance}
                        onChange={(e) => setMaxOrderDistance(Number(e.target.value))}
                        className="flex-1 accent-violet-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                      />
                      <span className="text-[10px] text-zinc-500 font-bold w-12 text-right shrink-0">Tối đa 500m</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-xs font-medium leading-relaxed">
                  ❌ Chức năng kiểm tra định vị đang TẮT.<br />
                  Khách hàng quét mã QR có thể đặt món bình thường ở bất kỳ khoảng cách nào.
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_40px_-10px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_-5px_rgba(139,92,246,0.6)] active:scale-99 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Đang lưu cấu hình...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Lưu thay đổi cấu hình
                </>
              )}
            </button>
          </form>
        )}

        {activeTab === 'sync' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-violet-500/10 rounded-2xl flex items-center justify-center border border-violet-500/20">
                <RefreshCw className={`w-7 h-7 text-violet-400 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              
              <div>
                <h3 className="text-base font-black text-white">Đồng bộ Thực đơn</h3>
                <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
                  Thực đơn phía khách hàng được lưu bộ nhớ đệm và tự động đồng bộ lại sau mỗi 5 phút (ISR).<br />
                  Nếu bạn vừa thay đổi món ăn hoặc giá bán, hãy bấm nút đồng bộ ngay dưới đây.
                </p>
              </div>

              <button 
                type="button"
                onClick={handleSyncMenu}
                disabled={isSyncing}
                className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_-2px_rgba(139,92,246,0.6)]"
              >
                {isSyncing ? 'Đang đồng bộ thực đơn...' : 'Đồng bộ thực đơn ngay lập tức'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Gói cước & Phần mềm</h3>
                  <p className="text-xs text-zinc-400 mt-1">Thông tin bản quyền và giới hạn tính năng của cửa hàng</p>
                </div>
              </div>

              {systemInfo ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Cửa hàng</div>
                      <div className="text-sm font-bold text-white">{systemInfo.tenantName}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{systemInfo.domain}</div>
                    </div>
                    <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/80 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-20"><Shield className="h-10 w-10 text-violet-500" /></div>
                      <div className="text-[10px] text-violet-400 font-bold uppercase tracking-wider mb-1">Gói cước hiện tại</div>
                      <div className="text-lg font-black text-white">{systemInfo.planName}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{systemInfo.planDescription}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Tính năng khả dụng
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {systemInfo.features?.map((f: string) => (
                        <span key={f} className="px-3 py-1.5 text-xs font-bold text-zinc-300 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                          {f}
                        </span>
                      ))}
                      {(!systemInfo.features || systemInfo.features.length === 0) && (
                        <span className="text-xs text-zinc-500 italic">Không có tính năng đặc quyền nào</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                    <span>Phiên bản: HiAI-MenuGo v1.0.0 (SaaS Edition)</span>
                    <span>Đăng ký: {new Date(systemInfo.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center text-zinc-500">
                  <Loader2 className="animate-spin h-8 w-8 mb-4 text-violet-500/50" />
                  <span className="text-sm font-medium">Đang tải thông tin bản quyền...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <BranchManagement />
        )}
      </div>
    </div>
  );
}

function BranchManagement() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API}/api/branches`, {
        headers: { Authorization: `Bearer ${getAccessTokenFromCookie()}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const startEdit = (b: any) => {
    setEditId(b.id);
    setEditName(b.name);
    setEditAddress(b.address || '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditAddress('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/branches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessTokenFromCookie()}` },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), address: editAddress.trim() || null }),
      });
      if (res.ok) {
        toast.success('Cập nhật chi nhánh thành công');
        cancelEdit();
        fetchBranches();
      } else {
        toast.error('Lỗi cập nhật chi nhánh');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="animate-spin h-6 w-6 text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">Quản lý chi nhánh</h3>
            <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">Chỉnh sửa tên và địa chỉ chi nhánh</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {branches.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Chưa có chi nhánh nào</div>
          ) : (
            branches.map(b => (
              <div key={b.id} className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4">
                {editId === b.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                      placeholder="Tên chi nhánh"
                    />
                    <input
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                      placeholder="Địa chỉ"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">Huỷ</button>
                      <button
                        onClick={() => saveEdit(b.id)}
                        disabled={saving || !editName.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white transition-all"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Store className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-200 truncate">{b.name}</div>
                      {b.address ? (
                        <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{b.address}</div>
                      ) : (
                        <div className="text-[11px] text-zinc-600 mt-0.5 italic">Chưa có địa chỉ</div>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(b)}
                      className="h-8 w-8 rounded-lg border border-zinc-800 hover:border-violet-500/30 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 flex items-center justify-center transition-all shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
