'use client';

import { useState, useEffect } from 'react';
import { getAccessTokenFromCookie } from '../../../lib/auth/client';
import { 
  CreditCard, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Wallet, 
  QrCode, 
  Printer, 
  Percent, 
  Building2,
  DollarSign,
  Check,
  Loader2
} from 'lucide-react';
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

const POPULAR_BANKS = [
  { id: 'MB', name: 'MBBank (Ngân hàng Quân Đội)' },
  { id: 'VCB', name: 'Vietcombank (Ngoại thương Việt Nam)' },
  { id: 'TCB', name: 'Techcombank (Kỹ thương Việt Nam)' },
  { id: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { id: 'BIDV', name: 'BIDV (Đầu tư và Phát triển Việt Nam)' },
  { id: 'CTG', name: 'VietinBank (Công Thương Việt Nam)' },
  { id: 'ACB', name: 'ACB (Á Châu)' },
  { id: 'TPB', name: 'TPBank (Tiên Phong)' },
  { id: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
];

export default function BankAccountTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  
  // Bank Form State
  const [formData, setFormData] = useState({
    bankId: 'MB',
    bankName: 'MBBank (Ngân hàng Quân Đội)',
    accountNumber: '',
    accountName: '',
    isDefault: true,
  });

  // Payment Method Policy & Tax Settings
  const [paymentPolicies, setPaymentPolicies] = useState({
    enableCash: true,
    enableVietQR: true,
    enableCard: false,
    autoPrintReceipt: true,
    vatRate: 0,
    serviceFee: 0,
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
    // Load local policy settings if stored
    const savedPolicy = localStorage.getItem('hiai_payment_policy');
    if (savedPolicy) {
      try {
        setPaymentPolicies(JSON.parse(savedPolicy));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountNumber || !formData.accountName || !formData.bankId) {
      toast.error('Vui lòng điền đủ thông tin tài khoản');
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
        toast.success('Đã thêm tài khoản ngân hàng thành công!');
        setFormData({
          bankId: 'MB',
          bankName: 'MBBank (Ngân hàng Quân Đội)',
          accountNumber: '',
          accountName: '',
          isDefault: accounts.length === 0,
        });
        fetchAccounts();
      } else {
        toast.error(data.message || 'Thêm thất bại');
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
        toast.success('Đã thiết lập tài khoản mặc định VietQR!');
        fetchAccounts();
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật tài khoản');
    }
  };

  const handleSavePolicies = () => {
    setSavingPolicy(true);
    setTimeout(() => {
      localStorage.setItem('hiai_payment_policy', JSON.stringify(paymentPolicies));
      toast.success('Đã cập nhật cấu hình thanh toán & hóa đơn thành công!');
      setSavingPolicy(false);
    }, 400);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        <span className="text-xs font-medium">Đang tải cấu hình thanh toán...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      
      {/* SECTION 1: Cấu hình Phương Thức Thanh Toán (Payment Policy & VAT) */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800/60 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 rounded-2xl text-violet-400 border border-violet-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Phương Thức Thanh Toán & Quy Tắc</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Bật/tắt phương thức chấp nhận thanh toán tại bàn và quầy POS.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSavePolicies}
            disabled={savingPolicy}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Lưu cấu hình</span>
          </button>
        </div>

        {/* Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Tiền mặt */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Tiền Mặt</div>
                <div className="text-[10px] text-zinc-500">Thanh toán tại quầy</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentPolicies({ ...paymentPolicies, enableCash: !paymentPolicies.enableCash })}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                paymentPolicies.enableCash ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                paymentPolicies.enableCash ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Chuyển khoản VietQR */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">VietQR Tự Động</div>
                <div className="text-[10px] text-zinc-500">Mã QR động theo đơn</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentPolicies({ ...paymentPolicies, enableVietQR: !paymentPolicies.enableVietQR })}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                paymentPolicies.enableVietQR ? 'bg-violet-600' : 'bg-zinc-800'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                paymentPolicies.enableVietQR ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Cà thẻ POS */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Thẻ Ngân Hàng</div>
                <div className="text-[10px] text-zinc-500">Máy cà thẻ POS</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentPolicies({ ...paymentPolicies, enableCard: !paymentPolicies.enableCard })}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                paymentPolicies.enableCard ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                paymentPolicies.enableCard ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

        </div>

        {/* VAT & Service Charge Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/60">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-violet-400" />
              Thuế VAT (%)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={paymentPolicies.vatRate}
              onChange={e => setPaymentPolicies({ ...paymentPolicies, vatRate: Number(e.target.value) })}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              Phí Phục Vụ / Tip (%)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={paymentPolicies.serviceFee}
              onChange={e => setPaymentPolicies({ ...paymentPolicies, serviceFee: Number(e.target.value) })}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800/60 rounded-xl px-4 py-2 mt-auto">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              Tự động in bill
            </span>
            <button
              type="button"
              onClick={() => setPaymentPolicies({ ...paymentPolicies, autoPrintReceipt: !paymentPolicies.autoPrintReceipt })}
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                paymentPolicies.autoPrintReceipt ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${
                paymentPolicies.autoPrintReceipt ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Thêm Tài Khoản Ngân Hàng VietQR */}
      <form onSubmit={handleSaveBank} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
          <div className="p-2.5 bg-violet-500/10 rounded-2xl text-violet-400 border border-violet-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Thêm Tài Khoản Ngân Hàng Nhận Tiền</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Tạo mã VietQR tự động để nhận tiền chuyển khoản trực tiếp từ khách hàng.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Chọn Ngân Hàng</label>
            <select
              value={formData.bankId}
              onChange={e => {
                const found = POPULAR_BANKS.find(b => b.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  bankId: e.target.value, 
                  bankName: found ? found.name : e.target.value 
                });
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 font-medium cursor-pointer"
            >
              {POPULAR_BANKS.map(b => (
                <option key={b.id} value={b.id} className="bg-zinc-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Số Tài Khoản</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 font-mono font-bold"
              placeholder="Nhập số tài khoản ngân hàng"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Tên Chủ Tài Khoản (Viết Hoa Không Dấu)</label>
            <input
              type="text"
              value={formData.accountName}
              onChange={e => setFormData({ ...formData, accountName: e.target.value.toUpperCase() })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 font-bold uppercase tracking-wider"
              placeholder="VD: NGUYEN VAN A"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-violet-600/30 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Thêm Tài Khoản</span>
          </button>
        </div>
      </form>

      {/* SECTION 3: Danh Sách Tài Khoản Đã Kết Nối */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">Danh Sách Tài Khoản VietQR Đã Kết Nối</h4>
        
        {accounts.map(acc => (
          <div key={acc.id} className={`p-5 rounded-2xl border ${acc.isDefault ? 'bg-violet-500/10 border-violet-500/30' : 'bg-zinc-900/40 border-zinc-800'} flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center transition-all`}>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-black text-base text-white">{acc.bankId}</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-violet-400 font-mono text-xs font-bold">
                  {acc.accountNumber}
                </span>
                {acc.isDefault && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-3 h-3" /> MẶC ĐỊNH VIETQR
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 font-semibold uppercase">{acc.accountName}</p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {!acc.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(acc.id)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Đặt mặc định
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(acc.id)}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl border border-rose-500/20 transition-all flex items-center justify-center cursor-pointer"
                title="Xóa tài khoản"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="text-center p-10 bg-zinc-900/20 border border-zinc-800/60 rounded-3xl border-dashed space-y-2">
            <CreditCard className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-xs text-zinc-500 font-medium">Chưa có tài khoản ngân hàng nào. Vui lòng thêm tài khoản ở trên để kích hoạt thanh toán VietQR.</p>
          </div>
        )}
      </div>
    </div>
  );
}
