'use client';

import { useState } from 'react';
import { Users, Ticket, Settings, RefreshCw, Plus, Edit, Lock, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import AccountModal from '@/components/admin/settings/AccountModal';
import VoucherModal from '@/components/admin/settings/VoucherModal';
import ResetPasswordModal from '@/components/admin/settings/ResetPasswordModal';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SettingsClient({ initialUsers, initialVouchers, initialConfig }: { initialUsers: any[], initialVouchers: any[], initialConfig: any }) {
  const [activeTab, setActiveTab] = useState('accounts');
  
  const [users, setUsers] = useState(initialUsers);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [config, setConfig] = useState(initialConfig);

  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [isVoucherModalOpen, setVoucherModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [userFilter, setUserFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const filteredUsers = users.filter(u => {
    if (userFilter === 'ACTIVE') return u.isActive;
    if (userFilter === 'INACTIVE') return !u.isActive;
    return true;
  });

  const handleSyncMenu = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API}/api/admin/menu/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
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
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          restaurantName: formData.get('restaurantName'),
          managerEmail: formData.get('managerEmail')
        })
      });
      if (res.ok) {
        toast.success('Đã lưu cấu hình hệ thống');
      } else {
        toast.error('Lỗi lưu cấu hình');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const deactivateUser = async (id: string, name: string) => {
    if (!confirm(`Vô hiệu hóa ${name}? Họ sẽ không thể đăng nhập.`)) return;
    
    try {
      const res = await fetch(`${API}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) {
        toast.success('Đã vô hiệu hóa tài khoản');
        setUsers(users.map(u => u.id === id ? { ...u, isActive: false } : u));
      } else {
        const d = await res.json();
        toast.error(d.message || 'Lỗi vô hiệu hóa');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm(`Vô hiệu hóa voucher này?`)) return;
    
    try {
      const res = await fetch(`${API}/api/vouchers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) {
        toast.success('Đã vô hiệu hóa voucher');
        setVouchers(vouchers.map(v => v.id === id ? { ...v, isActive: false } : v));
      } else {
        toast.error('Lỗi vô hiệu hóa voucher');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'MANAGER': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'KITCHEN': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'; // STAFF, CASHIER
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 p-4 shrink-0 overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'accounts' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
        >
          <Users size={16} /> Tài khoản
        </button>
        <button 
          onClick={() => setActiveTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'vouchers' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
        >
          <Ticket size={16} /> Mã khuyến mãi
        </button>
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
        
        {/* TAB 1: ACCOUNTS */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {['ALL', 'ACTIVE', 'INACTIVE'].map(f => (
                  <button key={f} onClick={() => setUserFilter(f as any)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${userFilter === f ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {f === 'ALL' ? 'Tất cả' : f === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => { setSelectedUser(null); setAccountModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors"
              >
                <Plus size={16} /> Thêm tài khoản
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-bold">Người dùng</th>
                    <th className="px-6 py-4 font-bold">Email</th>
                    <th className="px-6 py-4 font-bold">Vai trò</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                    <th className="px-6 py-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id || i} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white shrink-0">
                            {u.name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="font-semibold text-zinc-100">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-400">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.isActive ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400"><CheckCircle2 size={14} /> Hoạt động</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500"><Lock size={14} /> Đã khóa</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedUser(u); setAccountModalOpen(true); }} className="p-1.5 text-zinc-400 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors" title="Sửa">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => { setSelectedUser(u); setResetPasswordModalOpen(true); }} className="p-1.5 text-zinc-400 hover:text-amber-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors" title="Reset Mật khẩu">
                            <Lock size={14} />
                          </button>
                          <button onClick={() => deactivateUser(u.id, u.name)} disabled={!u.isActive} className="p-1.5 text-zinc-400 hover:text-rose-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Vô hiệu hóa">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-medium">Không có dữ liệu</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: VOUCHERS */}
        {activeTab === 'vouchers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={() => { setSelectedVoucher(null); setVoucherModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-colors"
              >
                <Plus size={16} /> Tạo Voucher mới
              </button>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-bold">Mã Voucher</th>
                    <th className="px-6 py-4 font-bold">Loại & Giá trị</th>
                    <th className="px-6 py-4 font-bold">Đã dùng/Giới hạn</th>
                    <th className="px-6 py-4 font-bold">Hết hạn</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                    <th className="px-6 py-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {vouchers.map((v, i) => {
                    const isExpired = v.expiredAt && new Date(v.expiredAt) < new Date();
                    const isMaxed = v.maxUsage !== null && v.usedCount >= v.maxUsage;
                    return (
                      <tr key={v.id || i} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-black text-emerald-400 tracking-widest">{v.code}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-100">
                          {v.discountType === 'PERCENT' ? `${v.discountValue}%` : `${new Intl.NumberFormat('vi-VN').format(v.discountValue)} ₫`}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-400">
                          {v.usedCount} / {v.maxUsage === null ? '∞' : v.maxUsage}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-400">
                          {v.expiredAt ? format(new Date(v.expiredAt), 'dd/MM/yyyy HH:mm', { locale: vi }) : 'Không giới hạn'}
                        </td>
                        <td className="px-6 py-4">
                          {v.isActive && !isExpired && !isMaxed && <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-md">Khả dụng</span>}
                          {!v.isActive && <span className="text-rose-500 text-xs font-bold bg-rose-500/10 px-2 py-1 rounded-md">Vô hiệu hóa</span>}
                          {v.isActive && isExpired && <span className="text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded-md">Hết hạn</span>}
                          {v.isActive && !isExpired && isMaxed && <span className="text-zinc-500 text-xs font-bold bg-zinc-500/10 px-2 py-1 rounded-md">Hết lượt</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setSelectedVoucher(v); setVoucherModalOpen(true); }} className="p-1.5 text-zinc-400 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => deleteVoucher(v.id)} disabled={!v.isActive} className="p-1.5 text-zinc-400 hover:text-rose-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {vouchers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-medium">Chưa có mã khuyến mãi nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM CONFIG */}
        {activeTab === 'system' && config && (
          <form onSubmit={handleSaveConfig} className="max-w-2xl mx-auto space-y-6">
            <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-xl space-y-6">
              <h2 className="text-lg font-bold text-white tracking-tight">Cấu hình thông tin nhà hàng</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên nhà hàng / Thương hiệu</label>
                  <input name="restaurantName" type="text" defaultValue={config.restaurantName} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors" required />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email Quản lý (Nhận báo cáo)</label>
                  <input name="managerEmail" type="email" defaultValue={config.managerEmail} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors" required />
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800/50 space-y-4">
                <h3 className="text-sm font-bold text-zinc-300">Thông tin License (Read-only)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">License Key</p>
                    <p className="font-mono text-zinc-300 text-sm">{config.licenseKey}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Ngày hết hạn</p>
                    <p className="font-semibold text-zinc-300 text-sm">
                      {config.licenseExpiredAt ? format(new Date(config.licenseExpiredAt), 'dd/MM/yyyy', { locale: vi }) : 'Vô thời hạn'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isSavingConfig} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                  {isSavingConfig ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 4: MENU SYNC */}
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

      {/* Modals placeholders */}
      <AccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setAccountModalOpen(false)} 
        user={selectedUser}
        onSuccess={(newUser) => {
          if (selectedUser) setUsers(users.map(u => u.id === newUser.id ? newUser : u));
          else setUsers([newUser, ...users]);
        }}
      />

      <VoucherModal 
        isOpen={isVoucherModalOpen} 
        onClose={() => setVoucherModalOpen(false)} 
        voucher={selectedVoucher}
        onSuccess={(newV) => {
          if (selectedVoucher) setVouchers(vouchers.map(v => v.id === newV.id ? newV : v));
          else setVouchers([newV, ...vouchers]);
        }}
      />

      <ResetPasswordModal 
        isOpen={isResetPasswordModalOpen} 
        onClose={() => setResetPasswordModalOpen(false)} 
        userId={selectedUser?.id}
      />
    </div>
  );
}
