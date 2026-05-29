'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { format, subDays, isValid, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, Calendar, Download } from 'lucide-react';
import { RoleGate } from '@/components/auth';
import { useAuthStore } from '@/stores/auth.store';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import BestSellerCard, { TopSellingItem } from '@/components/dashboard/BestSellerCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const fmtCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

export default function DashboardClient({
  initialData,
  initialRole
}: {
  initialData?: any;
  initialRole?: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CASHIER';
}) {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const [revenueData, setRevenueData] = useState<any[]>(initialData?.revenueData || []);
  const [peakHoursData, setPeakHoursData] = useState<any[]>(initialData?.peakHoursData || []);
  const [topSellingData, setTopSellingData] = useState<{ period: any, items: TopSellingItem[] } | null>(initialData?.topSellingData || null);
  const [loading, setLoading] = useState(!initialData?.revenueData);
  const [isExporting, setIsExporting] = useState(false);

  // RBAC hydration: hydrate Zustand store từ Server-side role để tránh flash nội dung
  const setUser = useAuthStore(state => state.setUser);
  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    if (initialRole && !currentUser) {
      setUser({ id: '', email: '', name: '', role: initialRole });
    }
  }, [initialRole, currentUser, setUser]);

  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let fromStr = fromParam;
      let toStr = toParam;

      if (!fromStr || !isValid(parseISO(fromStr))) {
        fromStr = subDays(now, 30).toISOString();
      }
      if (!toStr || !isValid(parseISO(toStr))) {
        toStr = now.toISOString();
      }

      const [revRes, peakRes, topRes] = await Promise.all([
        fetch(`${API}/api/analytics/revenue?from=${fromStr}&to=${toStr}&groupBy=${groupBy}`, { credentials: 'include' }),
        fetch(`${API}/api/analytics/peak-hours?from=${fromStr}&to=${toStr}`, { credentials: 'include' }),
        fetch(`${API}/api/analytics/top-selling?from=${fromStr}&to=${toStr}&limit=5`, { credentials: 'include' })
      ]);

      if (revRes.ok) {
        const d = await revRes.json();
        const formatted = d.data.map((item: any) => ({
          ...item,
          displayDate: format(new Date(item.date), groupBy === 'month' ? 'MM/yyyy' : 'dd/MM/yyyy', { locale: vi })
        }));
        setRevenueData(formatted);
      }

      if (peakRes.ok) {
        const d = await peakRes.json();
        setPeakHoursData(d.data);
      }

      if (topRes.ok) {
        const d = await topRes.json();
        setTopSellingData(d.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  }, [fromParam, toParam, groupBy]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export Excel — dùng fromParam/toParam từ URL (DateRangePicker set)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(now, 30);
      const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : now;

      const params = new URLSearchParams({
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
        type: 'full'
      });

      const res = await fetch(`${API}/api/analytics/export?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `restoflow-report-${params.get('from')}-${params.get('to')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const heatmapData = useMemo(() => {
    if (!peakHoursData.length) return [];
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    return peakHoursData.map(d => ({
      hour: d.hourOfDay,
      dayIndex: d.dayOfWeek === 0 ? 6 : d.dayOfWeek - 1,
      dayName: days[d.dayOfWeek - 1] || 'CN',
      orderCount: d.orderCount,
      revenue: d.revenue
    }));
  }, [peakHoursData]);

  const maxOrders = Math.max(...heatmapData.map(d => d.orderCount), 1);

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm shrink-0 items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-400" />
            <DateRangePicker />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nhóm theo:</label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-semibold cursor-pointer"
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
          </div>
        </div>

        {/* Export button — ADMIN/MANAGER only */}
        <RoleGate allowedRoles={['ADMIN', 'MANAGER']}>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </RoleGate>
      </div>

      {loading && (!revenueData || revenueData.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-900/20 border border-zinc-900/80 rounded-2xl">
          <Loader2 className="animate-spin text-violet-500" size={32} />
          <p className="text-xs font-bold text-zinc-400">Đang phân tích dữ liệu hiệu suất...</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-10">

          {/* Quick Stats — ADMIN/MANAGER only */}
          <RoleGate allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Tổng đơn hàng</p>
                <p className="text-3xl font-black text-white mt-2">
                  {revenueData.reduce((acc, d) => acc + d.orderCount, 0).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Tổng doanh thu</p>
                <p className="text-3xl font-black text-emerald-400 mt-2">
                  {fmtCurrency(revenueData.reduce((acc, d) => acc + d.revenue, 0))}
                </p>
              </div>
              <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Top món bán chạy</p>
                <p className="text-3xl font-black text-violet-400 mt-2">
                  {topSellingData?.items?.[0]?.name || '—'}
                </p>
              </div>
            </div>
          </RoleGate>

          {/* System Alerts — ADMIN only */}
          <RoleGate allowedRoles={['ADMIN']}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl shadow-xl">
                <h3 className="text-rose-400 font-bold mb-2 uppercase text-xs tracking-wider">System Alerts</h3>
                <p className="text-sm text-rose-300">Kiểm tra hệ thống định kỳ để đảm bảo hoạt động ổn định.</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl shadow-xl">
                <h3 className="text-amber-400 font-bold mb-2 uppercase text-xs tracking-wider">License Info</h3>
                <p className="text-sm text-amber-300">RestoFlow Enterprise License. Xem chi tiết tại Cài đặt.</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl shadow-xl flex flex-col items-start justify-between">
                <div>
                  <h3 className="text-blue-400 font-bold mb-2 uppercase text-xs tracking-wider">User Management</h3>
                  <p className="text-sm text-blue-300 mb-3">Tạo và phân quyền quản trị.</p>
                </div>
                <a href="/admin/settings" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">
                  Quản lý tài khoản
                </a>
              </div>
            </div>
          </RoleGate>

          {/* Row 1: Bar Chart Doanh thu & Line Chart Order */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Biểu đồ Doanh Thu</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="displayDate" tick={{fontSize: 10, fill: '#71717a'}} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(val) => `${val / 1000}k`}
                      tick={{fontSize: 10, fill: '#71717a'}}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [fmtCurrency(Number(val) || 0), 'Doanh thu']}
                      labelStyle={{color: '#ffffff', fontWeight: 'bold'}}
                      contentStyle={{backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid #27272a', color: '#fff'}}
                    />
                    <Legend wrapperStyle={{fontSize: 11, color: '#71717a'}} />
                    <Bar dataKey="revenue" name="Doanh thu (VNĐ)" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Lưu lượng Đơn hàng</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="displayDate" tick={{fontSize: 10, fill: '#71717a'}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#71717a'}} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      formatter={(val: any) => [val, 'Đơn hàng']}
                      labelStyle={{color: '#ffffff', fontWeight: 'bold'}}
                      contentStyle={{backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid #27272a', color: '#fff'}}
                    />
                    <Legend wrapperStyle={{fontSize: 11, color: '#71717a'}} />
                    <Line type="monotone" dataKey="orderCount" name="Số đơn hàng" stroke="#10b981" strokeWidth={3} dot={{r: 4, stroke: '#10b981', fill: '#09090b'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: BestSellerCard | Peak-hour Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BestSellerCard
              items={topSellingData?.items || []}
              period={topSellingData?.period || null}
              isLoading={loading}
            />

            <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-xl">
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2">Bản đồ Giờ cao điểm (Heatmap)</h2>
              <p className="text-[11px] text-zinc-500 mb-6">Độ lớn của chấm tròn thể hiện số lượng đơn hàng tập trung vào khung giờ đó.</p>

              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 10, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      type="number"
                      dataKey="hour"
                      name="Giờ"
                      domain={[0, 23]}
                      tickCount={24}
                      tick={{fontSize: 10, fill: '#71717a'}}
                      tickFormatter={(val) => `${val}h`}
                    />
                    <YAxis
                      type="category"
                      dataKey="dayName"
                      name="Thứ"
                      allowDuplicatedCategory={false}
                      tick={{fontSize: 11, fontWeight: 500, fill: '#a1a1aa'}}
                      reversed
                    />
                    <ZAxis type="number" dataKey="orderCount" range={[50, 800]} domain={[0, maxOrders]} />
                    <RechartsTooltip
                      cursor={{ strokeDasharray: '3 3', stroke: '#52525b' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs shadow-2xl">
                              <p className="font-bold text-white">{data.dayName}, {data.hour}:00 - {data.hour}:59</p>
                              <p className="text-emerald-400 font-semibold mt-1">Số đơn: <span className="font-bold">{data.orderCount}</span></p>
                              <p className="text-violet-400 font-semibold">Doanh thu: <span className="font-bold">{fmtCurrency(data.revenue)}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={heatmapData} fill="#f43f5e">
                      {heatmapData.map((entry, index) => {
                        const intensity = entry.orderCount / maxOrders;
                        let color = '#fecdd3';
                        if (intensity > 0.3) color = '#fb7185';
                        if (intensity > 0.6) color = '#e11d48';
                        if (intensity > 0.8) color = '#9f1239';

                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
