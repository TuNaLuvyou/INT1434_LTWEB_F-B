'use client';
import { useState, useEffect } from 'react';
import { getAccessTokenFromCookie } from '../../../lib/auth/client';
import { CreditCard, Save, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BankAccount {
  id: string;
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BankAccountTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    bankId: 'MB',
    bankName: 'MBBank',
    accountNumber: '',
    accountName: '',
    isDefault: true,
  });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/banks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountNumber || !formData.accountName || !formData.bankId) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }

    try {
      setSaving(true);
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/banks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã thêm tài khoản ngân hàng');
        setFormData({ ...formData, accountNumber: '', accountName: '' });
        fetchAccounts();
      } else {
        toast.error(data.message || 'Lỗi thêm tài khoản');
      }
    } catch (err: any) {
      toast.error('Lỗi thêm tài khoản');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/banks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã xóa tài khoản');
        fetchAccounts();
      }
    } catch (err) {
      toast.error('Lỗi khi xóa tài khoản');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/banks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDefault: true })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã thiết lập tài khoản mặc định');
        fetchAccounts();
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật tài khoản');
    }
  };

  if (loading) return <div className="text-zinc-400 p-8 text-center animate-pulse">Đang tải...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSave} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
          <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Thêm tài khoản thanh toán</h3>
            <p className="text-sm text-zinc-500">Dùng cho VietQR & Chuyển khoản</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Ngân hàng</label>
            <input
              type="text"
              value={formData.bankId}
              onChange={e => setFormData({ ...formData, bankId: e.target.value, bankName: e.target.value })}
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl px-5 py-3.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-medium"
              placeholder="Ví dụ: MB, VCB, TCB..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Số tài khoản</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl px-5 py-3.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-medium"
              placeholder="Nhập số tài khoản"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Tên chủ tài khoản</label>
            <input
              type="text"
              value={formData.accountName}
              onChange={e => setFormData({ ...formData, accountName: e.target.value })}
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl px-5 py-3.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-medium uppercase"
              placeholder="VD: NGUYEN VAN A"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <AlertCircle className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Thêm tài khoản
          </button>
        </div>
      </form>

      {/* Danh sách */}
      <div className="space-y-4">
        {accounts.map(acc => (
          <div key={acc.id} className={`p-5 rounded-2xl border ${acc.isDefault ? 'bg-violet-500/5 border-violet-500/30' : 'bg-zinc-900/40 border-zinc-800'} flex flex-col sm:flex-row gap-4 justify-between items-center transition-all`}>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-bold text-lg text-zinc-100 tracking-wide">{acc.bankId}</span>
                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-sm font-mono">{acc.accountNumber}</span>
                {acc.isDefault && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> MẶC ĐỊNH
                  </span>
                )}
              </div>
              <p className="text-zinc-400 font-semibold uppercase">{acc.accountName}</p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {!acc.isDefault && (
                <button
                  onClick={() => handleSetDefault(acc.id)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-all"
                >
                  Đặt mặc định
                </button>
              )}
              <button
                onClick={() => handleDelete(acc.id)}
                className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 transition-all flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="text-center p-10 bg-zinc-900/20 border border-zinc-800/50 rounded-3xl border-dashed">
            <CreditCard className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-500">Chưa có tài khoản ngân hàng nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
