'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  Search,
  Plus
} from 'lucide-react';

export default function HrmDashboard({ currentUser }: { currentUser: any }) {
  const [activeTab, setActiveTab] = useState('attendance'); 

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-zinc-900/40 border border-zinc-900 rounded-3xl overflow-hidden">
      <div className="border-b border-zinc-900 bg-zinc-950/20 shrink-0">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
              activeTab === 'attendance'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            Chấm công hôm nay
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
              activeTab === 'schedule'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            Lịch làm việc
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
              activeTab === 'report'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            Báo cáo tháng
          </button>
        </nav>
      </div>

      <div className="p-5 flex-1 min-h-0 bg-transparent flex flex-col overflow-hidden">
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'report' && <ReportTab />}
      </div>
    </div>
  );
}

// ==============================
// TAB 1: CHẤM CÔNG HÔM NAY
// ==============================
function AttendanceTab() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ userId: '', checkInAt: '', note: '' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchToday = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/api/attendance/history?from=${today}&to=${today}T23:59:59`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAttendances(data.data.history);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const handleApprove = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved }),
        credentials: 'include'
      });
      if (res.ok) {
        alert('Cập nhật trạng thái duyệt thành công!');
        fetchToday();
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/attendance/manual-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Chấm công hộ thành công!');
        setShowManualForm(false);
        setManualForm({ userId: '', checkInAt: '', note: '' });
        fetchToday();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-violet-400" />
            Dữ liệu chấm công hôm nay
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Phê duyệt lịch trình checkin thực tế hoặc chấm công hộ nhân viên vắng mặt.</p>
        </div>
        <button 
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center gap-1.5 bg-violet-650 hover:bg-violet-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.2)] shrink-0"
        >
          {showManualForm ? 'Đóng form' : '+ Chấm công hộ'}
        </button>
      </div>

      {showManualForm && (
        <div className="bg-zinc-950/60 p-4 border border-zinc-900 rounded-2xl shrink-0 space-y-3">
          <h3 className="text-xs font-bold text-white">Form Chấm Công Hộ Nhân Sự</h3>
          <form onSubmit={handleManualCheckIn} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">User ID</label>
              <input 
                required 
                value={manualForm.userId} 
                onChange={e => setManualForm({...manualForm, userId: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono" 
                placeholder="Nhập ID..." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Thời gian Check-in</label>
              <input 
                required 
                type="datetime-local" 
                value={manualForm.checkInAt} 
                onChange={e => setManualForm({...manualForm, checkInAt: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ghi chú</label>
              <input 
                value={manualForm.note} 
                onChange={e => setManualForm({...manualForm, note: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all" 
                placeholder="Quên điện thoại..." 
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold h-9 uppercase tracking-wider transition-all flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              Xác nhận
            </button>
          </form>
          <p className="text-[10px] text-amber-500/80 font-medium">* Chấm công hộ sẽ bỏ qua bước xác thực thiết bị và tự động được Đã Duyệt.</p>
        </div>
      )}

      {loading ? (
        <div className="flex-grow flex items-center justify-center text-zinc-500 font-light text-xs">
          Đang tải dữ liệu chấm công...
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân viên</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Check-in</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Check-out</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thiết bị</th>
                <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Duyệt</th>
                <th className="px-5 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {attendances.map(a => (
                <tr key={a.id} className="hover:bg-zinc-900/10 transition-all">
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {a.user.name} <span className="text-zinc-500 font-mono text-[10px] ml-1">({a.user.role})</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-zinc-400">
                    {new Date(a.checkInAt).toLocaleTimeString('vi-VN')}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-zinc-400">
                    {a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('vi-VN') : 'Chưa out'}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 font-medium">
                    {a.device ? a.device.label : 'Manual'}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {a.isApproved 
                      ? <span className="inline-flex bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">Đã Duyệt</span>
                      : a.approvedBy 
                        ? <span className="inline-flex bg-rose-500/10 text-rose-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-rose-500/20">Từ Chối</span>
                        : <span className="inline-flex bg-amber-500/10 text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-amber-500/20">Chờ Duyệt</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    <div className="flex justify-end gap-2.5">
                      <button 
                        onClick={() => handleApprove(a.id, true)} 
                        className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                      >
                        Duyệt
                      </button>
                      <button 
                        onClick={() => handleApprove(a.id, false)} 
                        className="text-rose-400 hover:text-rose-300 font-bold hover:underline"
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {attendances.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-600 font-light">
                    Chưa có nhân sự nào check-in hôm nay.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==============================
// TAB 2: LỊCH LÀM VIỆC
// ==============================
function ScheduleTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', date: '', shiftStart: '08:00', shiftEnd: '16:00', position: '' });
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/schedules`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.data.schedules);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Xếp ca thành công!');
        setShowForm(false);
        fetchSchedules();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Bạn có muốn xóa ca làm này không?')) return;
    try {
      const res = await fetch(`${API_URL}/api/schedules/${id}`, { method: 'DELETE', credentials: 'include' });
      if(res.ok) fetchSchedules();
      else alert('Không thể xóa ca ngày hôm nay hoặc trong quá khứ.');
    } catch(err) {}
  };

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-violet-400" />
            Lịch làm việc sắp tới
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Quản lý và phân ca làm việc chi tiết cho nhân viên trong tuần.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-violet-650 hover:bg-violet-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.2)] shrink-0"
        >
          {showForm ? 'Đóng form' : '+ Xếp ca'}
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-950/60 p-4 border border-zinc-900 rounded-2xl shrink-0 space-y-3">
          <h3 className="text-xs font-bold text-white">Form Đăng Ký Xếp Ca</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">User ID</label>
              <input 
                required 
                value={form.userId} 
                onChange={e => setForm({...form, userId: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono" 
                placeholder="Nhập ID..." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ngày làm việc</label>
              <input 
                required 
                type="date" 
                value={form.date} 
                onChange={e => setForm({...form, date: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Từ giờ (HH:mm)</label>
              <input 
                required 
                type="time" 
                value={form.shiftStart} 
                onChange={e => setForm({...form, shiftStart: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Đến giờ (HH:mm)</label>
              <input 
                required 
                type="time" 
                value={form.shiftEnd} 
                onChange={e => setForm({...form, shiftEnd: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Vị trí</label>
              <input 
                required 
                value={form.position} 
                onChange={e => setForm({...form, position: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all" 
                placeholder="Bếp / Phục vụ..." 
              />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button 
                type="submit" 
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
              >
                Xác nhận xếp ca
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex-grow flex items-center justify-center text-zinc-500 font-light text-xs">
          Đang tải lịch làm việc...
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ngày</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân viên</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ca làm</th>
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Vị trí</th>
                <th className="px-5 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {schedules.map(s => (
                <tr key={s.id} className="hover:bg-zinc-900/10 transition-all">
                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-200">
                    {new Date(s.date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {s.user.name} <span className="text-zinc-500 font-mono text-[10px] ml-1">({s.user.role})</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-violet-400">
                    {s.shiftStart} - {s.shiftEnd}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 font-medium">
                    {s.position}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button 
                      onClick={() => handleDelete(s.id)} 
                      className="text-rose-400 hover:text-rose-300 font-bold hover:underline"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-600 font-light">
                    Chưa có lịch làm việc nào được xếp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==============================
// TAB 3: BÁO CÁO THÁNG
// ==============================
function ReportTab() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/report?from=${dateRange.from}&to=${dateRange.to}T23:59:59`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReport(data.data.report);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 bg-zinc-950/60 p-4 border border-zinc-900 rounded-2xl shrink-0">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Từ ngày</label>
          <input 
            type="date" 
            value={dateRange.from} 
            onChange={e => setDateRange({...dateRange, from: e.target.value})} 
            className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer w-40" 
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Đến ngày</label>
          <input 
            type="date" 
            value={dateRange.to} 
            onChange={e => setDateRange({...dateRange, to: e.target.value})} 
            className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all font-mono cursor-pointer w-40" 
          />
        </div>
        <button 
          onClick={fetchReport} 
          className="bg-violet-650 hover:bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(124,58,237,0.2)] h-9 cursor-pointer"
        >
          Xem báo cáo
        </button>
      </div>

      {loading ? (
        <div className="flex-grow flex items-center justify-center text-zinc-500 font-light text-xs">
          Đang tính toán báo cáo tổng hợp...
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân viên</th>
                <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ngày có mặt</th>
                <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ngày vắng</th>
                <th className="px-5 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Tổng giờ làm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {report.map((r, i) => (
                <tr key={i} className="hover:bg-zinc-900/10 transition-all">
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {r.user.name} <span className="text-zinc-500 font-mono text-[10px]">({r.user.role})</span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-emerald-400 font-bold font-mono">
                    {r.presentDays}
                  </td>
                  <td className="px-5 py-3.5 text-center text-rose-400 font-bold font-mono">
                    {r.absentDays}
                  </td>
                  <td className="px-5 py-3.5 text-right text-violet-400 font-bold font-mono">
                    {r.totalHours} giờ
                  </td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-600 font-light">
                    Không có dữ liệu báo cáo trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
