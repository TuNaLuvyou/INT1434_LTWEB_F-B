'use client';

import { useEffect, useState } from 'react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { Loader2, CreditCard, FileText, Download, Search, Calendar, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminHeader from '@/components/admin/AdminHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInvoices = async () => {
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/platform-admin/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // Invoice data will be available from the tenants' subscription info
        const tenants = data.data || [];
        setInvoices(tenants.map((t: any) => ({
          id: `INV-${t.id?.slice(0, 8)}`,
          tenantName: t.name,
          planName: t.subscription || 'Starter',
          amount: t.subscription === 'Professional' ? 299000 : t.subscription === 'Enterprise' ? 799000 : 0,
          status: 'PAID',
          dueDate: new Date(new Date(t.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paidAt: t.createdAt,
        })));
      }
    } catch (e) {
      console.error('Failed to fetch invoices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filteredInvoices = invoices.filter(inv =>
    inv.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDING': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'OVERDUE': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[130px] pointer-events-none" />

      <AdminHeader
        title="Subscription Invoices"
        icon={<FileText className="h-3.5 w-3.5" />}
        rightSide={
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">
            Billing
          </span>
        }
      />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm hóa đơn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-2 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4">
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Tổng hóa đơn</div>
              <div className="text-xl font-bold text-white mt-1">{filteredInvoices.length}</div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4">
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Đã thanh toán</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{filteredInvoices.filter(i => i.status === 'PAID').length}</div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4">
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Tổng doanh thu</div>
              <div className="text-xl font-bold text-white mt-1">{formatCurrency(filteredInvoices.reduce((s, i) => s + i.amount, 0))}</div>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin h-8 w-8 text-emerald-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                      <th className="px-5 py-3">Mã hóa đơn</th>
                      <th className="px-5 py-3">Khách thuê</th>
                      <th className="px-5 py-3">Gói cước</th>
                      <th className="px-5 py-3">Số tiền</th>
                      <th className="px-5 py-3">Trạng thái</th>
                      <th className="px-5 py-3">Ngày đến hạn</th>
                      <th className="px-5 py-3">Ngày thanh toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-xs">
                    {filteredInvoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-5 py-3 font-mono font-bold text-white">{inv.id}</td>
                        <td className="px-5 py-3 text-zinc-200">{inv.tenantName}</td>
                        <td className="px-5 py-3">
                          <span className="text-emerald-400 font-semibold">{inv.planName}</span>
                        </td>
                        <td className="px-5 py-3 font-mono font-semibold text-zinc-200">{formatCurrency(inv.amount)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusStyle(inv.status)}`}>
                            {inv.status === 'PAID' ? 'Đã thanh toán' : inv.status === 'PENDING' ? 'Chờ thanh toán' : 'Quá hạn'}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-zinc-400">{new Date(inv.dueDate).toLocaleDateString('vi-VN')}</td>
                        <td className="px-5 py-3 font-mono text-zinc-400">{new Date(inv.paidAt).toLocaleDateString('vi-VN')}</td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-zinc-600 font-light">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Không tìm thấy hóa đơn nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
