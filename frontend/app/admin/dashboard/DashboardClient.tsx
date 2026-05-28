'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const fmtCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

export default function DashboardClient() {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Format date string for display
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

  // Transform Peak Hours data for ScatterChart (Heatmap)
  // X = hourOfDay (0-23)
  // Y = dayOfWeek (1=Mon ... 7=Sun)
  // Z = orderCount or revenue (determines size/color)
  const heatmapData = useMemo(() => {
    if (!peakHoursData.length) return [];
    
    // Day mapping for Y axis
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    
    return peakHoursData.map(d => ({
      hour: d.hourOfDay,
      dayIndex: d.dayOfWeek === 0 ? 6 : d.dayOfWeek - 1, // ISODOW (1-7), mapping to 0-6 array index
      dayName: days[d.dayOfWeek - 1] || 'CN', // fallback
      orderCount: d.orderCount,
      revenue: d.revenue
    }));
  }, [peakHoursData]);

  // Get max values for Z-axis scaling
  const maxOrders = Math.max(...heatmapData.map(d => d.orderCount), 1);

  if (loading && !revenueData.length) {
    return <div className="py-20 text-center text-gray-500">Đang tải dữ liệu phân tích...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Thời gian:</label>
          <select 
            value={dateRange} 
            onChange={e => setDateRange(e.target.value as any)}
            className="border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="thisMonth">Tháng này</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Nhóm theo:</label>
          <select 
            value={groupBy} 
            onChange={e => setGroupBy(e.target.value as any)}
            className="border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="day">Ngày</option>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doanh thu BarChart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Biểu đồ Doanh Thu</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="displayDate" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis 
                  tickFormatter={(val) => `${val / 1000}k`} 
                  tick={{fontSize: 12}} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <RechartsTooltip 
                  formatter={(val: any) => [fmtCurrency(Number(val) || 0), 'Doanh thu']}
                  labelStyle={{color: '#374151', fontWeight: 'bold'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend />
                <Bar dataKey="revenue" name="Doanh thu (VNĐ)" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Số lượng đơn LineChart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Lưu lượng Đơn hàng</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="displayDate" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  formatter={(val: any) => [val, 'Đơn hàng']}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend />
                <Line type="monotone" dataKey="orderCount" name="Số đơn hàng" stroke="#10B981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Peak Hour Heatmap (ScatterChart) */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Bản đồ Giờ cao điểm (Heatmap)</h2>
        <p className="text-sm text-gray-500 mb-6">Độ lớn của chấm tròn thể hiện số lượng đơn hàng tập trung vào khung giờ đó.</p>
        
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis 
                type="number" 
                dataKey="hour" 
                name="Giờ" 
                domain={[0, 23]} 
                tickCount={24}
                tick={{fontSize: 12}} 
                tickFormatter={(val) => `${val}h`}
              />
              <YAxis 
                type="category" 
                dataKey="dayName" 
                name="Thứ" 
                allowDuplicatedCategory={false} 
                tick={{fontSize: 12, fontWeight: 500}} 
                reversed // Thứ 2 ở trên cùng
              />
              <ZAxis type="number" dataKey="orderCount" range={[50, 800]} domain={[0, maxOrders]} />
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100 text-sm">
                        <p className="font-bold text-gray-800">{data.dayName}, {data.hour}:00 - {data.hour}:59</p>
                        <p className="text-emerald-600 mt-1">Số đơn: <span className="font-bold">{data.orderCount}</span></p>
                        <p className="text-blue-600">Doanh thu: <span className="font-bold">{fmtCurrency(data.revenue)}</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={heatmapData} fill="#F43F5E">
                {heatmapData.map((entry, index) => {
                  // Heatmap color logic based on intensity
                  const intensity = entry.orderCount / maxOrders;
                  let color = '#FECDD3'; // rose-200
                  if (intensity > 0.3) color = '#FB7185'; // rose-400
                  if (intensity > 0.6) color = '#E11D48'; // rose-600
                  if (intensity > 0.8) color = '#9F1239'; // rose-800
                  
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
