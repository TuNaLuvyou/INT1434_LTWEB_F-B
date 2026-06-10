'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SettingsClient() {
  const [isSyncing, setIsSyncing] = useState(false);

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

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full text-center space-y-6 py-12">
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
      </div>
    </div>
  );
}
