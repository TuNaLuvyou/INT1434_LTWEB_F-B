'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Laptop, 
  User, 
  Clock, 
  Trash2, 
  Copy, 
  Check, 
  AlertTriangle, 
  KeyRound, 
  Cpu, 
  PlusCircle, 
  Search 
} from 'lucide-react';

import { getAccessTokenFromCookie } from '@/lib/auth/client';

export default function DevicesClient() {
  const [devices, setDevices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ userId: '', label: '' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getHeaders = (extraHeaders = {}) => {
    const token = getAccessTokenFromCookie();
    return {
      ...extraHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, { 
        headers: getHeaders(),
        credentials: 'include' 
      });
      const data = await res.json();
      if (res.ok) setDevices(data.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices/users`, { 
        headers: getHeaders(),
        credentials: 'include' 
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, userId: data.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchDevices();
    fetchUsers();
  }, [fetchDevices, fetchUsers]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) {
      alert('Vui lòng chọn người dùng');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/devices/register`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setNewToken(data.data.device.token);
        setFormData(prev => ({ ...prev, label: '' }));
        setIsCopied(false);
        fetchDevices();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const handleRevoke = async (id: string, label: string) => {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi thiết bị "${label}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        fetchDevices();
      } else {
        alert('Lỗi khi thu hồi');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const filteredDevices = devices.filter(d => 
    d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        <span className="text-zinc-400 text-sm font-light">Đang tải cấu hình bảo mật...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative z-10">
      
      {/* SUCCESS TOKEN SHOWCASE */}
      {newToken && (
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          
          <div className="flex gap-4">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <KeyRound className="h-5 w-5 animate-bounce" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Đăng ký thiết bị thành công!
                </h3>
                <p className="text-zinc-400 text-xs mt-1">
                  Hãy sao chép token bảo mật dưới đây để thiết lập chấm công trên trình duyệt nhân viên. <span className="text-amber-400 font-semibold">Lưu ý: Nó chỉ hiển thị một lần duy nhất này.</span>
                </p>
              </div>

              <div className="flex gap-2">
                <code className="flex-1 bg-zinc-950/80 border border-zinc-900 px-4 py-2.5 rounded-xl font-mono text-xs text-emerald-300 break-all select-all flex items-center">
                  {newToken}
                </code>
                <button
                  onClick={copyToken}
                  className={`px-4 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg ${
                    isCopied 
                      ? 'bg-emerald-500 text-zinc-950 shadow-emerald-500/20' 
                      : 'bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Đã Copy!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setNewToken(null)}
                  className="px-4 py-1.5 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/60 transition-all"
                >
                  Tôi đã lưu, đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* REGISTER FORM */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6 lg:sticky lg:top-24">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-violet-400" />
              Đăng ký thiết bị mới
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-light">
              Thiết lập thiết bị được phép chấm công cho nhân sự cụ thể.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Nhân viên sở hữu</label>
              <select
                required
                value={formData.userId}
                onChange={e => setFormData({ ...formData, userId: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-zinc-950">
                    {u.name} ({u.role})
                  </option>
                ))}
                {users.length === 0 && (
                  <option value="" disabled className="bg-zinc-950">
                    Không có nhân sự nào khả dụng
                  </option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Tên thiết bị (Label)</label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                placeholder="VD: iPad Quầy Phục Vụ 1"
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(124,58,237,0.25)] flex items-center justify-center gap-1.5"
            >
              <Cpu className="h-4 w-4" />
              Đăng ký thiết bị
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-4 space-y-2">
            <div className="flex gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Thông báo bảo mật</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed font-light">
              Mỗi trình duyệt web/iPad cần có 1 Token duy nhất để xác thực. Nhân viên KHÔNG THỂ chấm công trên các thiết bị cá nhân ngoài luồng trừ khi được duyệt tại đây.
            </p>
          </div>
        </div>

        {/* REGISTERED LIST */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Laptop className="h-4.5 w-4.5 text-indigo-400" />
                Danh sách thiết bị
              </h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">
                Các máy đã được gắn token hợp lệ để chấm công.
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm kiếm thiết bị, người dùng..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3">Thiết bị</th>
                  <th className="px-5 py-3">Người dùng sở hữu</th>
                  <th className="px-5 py-3">Token (Để Copy)</th>
                  <th className="px-5 py-3">Hoạt động gần nhất</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {filteredDevices.map(device => (
                  <tr key={device.id} className="hover:bg-zinc-900/20 transition-all group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                          <Laptop className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-200">{device.label}</div>
                          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">ID: {device.id.substring(0,8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                          <User className="h-3 w-3" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-300">{device.user?.name}</div>
                          <div className="text-[10px] text-zinc-500">{device.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {device.token ? (
                        <div className="flex items-center gap-2 font-mono bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 w-fit group-hover:border-violet-500/40 hover:bg-zinc-900 transition-all shadow-inner">
                          <span className="text-[11px] text-violet-300 font-bold select-all tracking-wider">
                            {device.token}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(device.token);
                              alert(`Đã sao chép token cho thiết bị "${device.label}"!`);
                            }}
                            className="p-1 rounded-lg bg-zinc-950 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 border border-zinc-800 hover:border-violet-500/30 transition-all ml-1.5"
                            title="Sao chép Token"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-500 font-light italic">Không có token</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-400">
                      {device.lastUsed ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{new Date(device.lastUsed).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-light italic">Chưa hoạt động</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleRevoke(device.id, device.label)}
                        className="text-rose-400 hover:text-rose-300 font-medium transition-colors hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Thu hồi</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-zinc-600 font-light">
                      Chưa có thiết bị nào được thiết lập hoặc khớp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
