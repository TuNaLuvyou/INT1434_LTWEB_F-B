'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, Calendar } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const fmtCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

export default function DashboardClient() {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'thisMonth'>('7days');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let from: Date, to: Date = now;

      if (dateRange === '7days') {
        from = subDays(now, 7);
      } else if (dateRange === '30days') {
        from = subDays(now, 30);
      } else {
        from = startOfMonth(now);
        to = endOfMonth(now);
      }

      const fromStr = from.toISOString();
      const toStr = to.toISOString();

      const [revRes, peakRes] = await Promise.all([
        fetch(`${API}/api/analytics/revenue?from=${fromStr}&to=${toStr}&groupBy=${groupBy}`, { credentials: 'include' }),
        fetch(`${API}/api/analytics/peak-hours?from=${fromStr}&to=${toStr}`, { credentials: 'include' })
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
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, groupBy]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      let from: Date, to: Date = now;
      if (dateRange === '7days') {
        from = subDays(now, 7);
      } else if (dateRange === '30days') {
        from = subDays(now, 30);
      } else {
        from = startOfMonth(now);
        to = endOfMonth(now);
      }

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

  const maxOrders = Math.max(...heatmapData.map(d => d.orderCount), 1);

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0">
      {/* Filters (Shrink-0) */}
      <div className="flex flex-wrap gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-400" />
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Thời gian:</label>
          <select 
            value={dateRange} 
            onChange={e => setDateRange(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-semibold cursor-pointer"
          >
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="thisMonth">Tháng này</option>
          </select>
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
        
        <div className="ml-auto">
          <button 
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>📊</span>}
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-900/20 border border-zinc-900/80 rounded-2xl">
          <Loader2 className="animate-spin text-violet-500" size={32} />
          <p className="text-xs font-bold text-zinc-400">Đang phân tích dữ liệu hiệu suất...</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Doanh thu BarChart */}
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

            {/* Số lượng đơn LineChart */}
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

          {/* Peak Hour Heatmap (ScatterChart) */}
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
      )}
    </div>
  );
}
