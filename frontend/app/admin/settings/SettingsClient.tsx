'use client';

import { useState } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SettingsClient({ initialConfig }: { initialConfig: any }) {
  const [activeTab, setActiveTab] = useState('system');
  const [config, setConfig] = useState(initialConfig);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const handleSyncMenu = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API}/api/admin/menu/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAccessTokenFromCookie()}` }
      });
      if (res.ok) {
        toast.success('Thực đơn đã được cập nhật cho tất cả bàn!');
      } else {
        toast.error('Đồng bộ thất bại');
      }
    } catch (e) {
      toast.error('Đồng bộ thất bại');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingConfig(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API}/api/system/config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessTokenFromCookie()}`
        },
        body: JSON.stringify({
          restaurantName: formData.get('restaurantName'),
          managerEmail: formData.get('managerEmail')
        })
      });
      if (res.ok) {
        const result = await res.json();
        toast.success('Đã lưu cấu hình hệ thống');
        if (result.success && result.data) {
          setConfig(result.data);
        }
      } else {
        toast.error('Lỗi lưu cấu hình');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 p-4 shrink-0 overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'system' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
        >
          <Settings size={16} /> Cấu hình hệ thống
        </button>
        <button 
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sync' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
        >
          <RefreshCw size={16} /> Đồng bộ thực đơn
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent p-6">
        
        {/* TAB 1: SYSTEM CONFIG */}
        {activeTab === 'system' && config && (
          <form onSubmit={handleSaveConfig} className="max-w-2xl mx-auto w-full pt-4 space-y-6">
            <div className="flex flex-col gap-10 items-start">
              {/* Restaurant Info */}
              <div className="space-y-6 w-full">
                <div>
                  <h2 className="text-base font-extrabold text-white tracking-tight">Cấu hình Nhà hàng</h2>
                  <p className="text-xs text-zinc-500 font-light mt-0.5">Thay đổi tên thương hiệu hiển thị trên Menu và Email liên hệ.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tên nhà hàng / Thương hiệu</label>
                    <input name="restaurantName" type="text" defaultValue={config.restaurantName} className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all font-semibold" required />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Email liên hệ hệ thống (Quản trị viên)</label>
                    <input name="managerEmail" type="email" defaultValue={config.managerEmail} className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all font-semibold" required />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSavingConfig} className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-95 disabled:opacity-50">
                    {isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình nhà hàng'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: MENU SYNC */}
        {activeTab === 'sync' && (
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
            <div className="w-24 h-24 mx-auto bg-violet-500/10 rounded-full flex items-center justify-center border border-violet-500/20 mb-6">
              <RefreshCw className={`w-10 h-10 text-violet-400 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tight">Đồng bộ Thực đơn (Menu QR)</h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed font-medium">
              Menu QR của khách hàng được cấu hình tự động cập nhật cache mỗi 5 phút (ISR).<br /> 
              Nếu bạn vừa thay đổi món ăn và muốn khách hàng thấy ngay lập tức, hãy bấm nút đồng bộ bên dưới.
            </p>

            <button 
              onClick={handleSyncMenu}
              disabled={isSyncing}
              className="mt-8 px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)] disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ thực đơn ngay lập tức'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
