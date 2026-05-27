'use client';

import { useState, useEffect } from 'react';

export default function HrmDashboard({ currentUser }: { currentUser: any }) {
  const [activeTab, setActiveTab] = useState('attendance'); 

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'attendance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Chấm công hôm nay
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lịch làm việc
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'report'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Báo cáo tháng
          </button>
        </nav>
      </div>

      <div className="p-6 bg-gray-50 min-h-[500px]">
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Dữ liệu chấm công hôm nay</h2>
        <button 
          onClick={() => setShowManualForm(!showManualForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
        >
          {showManualForm ? 'Đóng form' : '+ Chấm công hộ'}
        </button>
      </div>

      {showManualForm && (
        <div className="bg-white p-6 rounded border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Form chấm công hộ</h3>
          <form onSubmit={handleManualCheckIn} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">User ID</label>
              <input required value={manualForm.userId} onChange={e => setManualForm({...manualForm, userId: e.target.value})} className="w-full border p-2 rounded" placeholder="Nhập ID..." />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Thời gian Check-in</label>
              <input required type="datetime-local" value={manualForm.checkInAt} onChange={e => setManualForm({...manualForm, checkInAt: e.target.value})} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ghi chú</label>
              <input value={manualForm.note} onChange={e => setManualForm({...manualForm, note: e.target.value})} className="w-full border p-2 rounded" placeholder="Quên điện thoại..." />
            </div>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded h-[42px]">
              Xác nhận
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-3">* Chấm công hộ sẽ bỏ qua bước xác thực thiết bị và tự động được Đã Duyệt.</p>
        </div>
      )}

      {loading ? <p>Đang tải...</p> : (
        <div className="bg-white rounded border overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Nhân viên</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Check-in</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Check-out</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Thiết bị</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Duyệt</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendances.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.user.name} <span className="text-gray-400 text-xs ml-1">({a.user.role})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.checkInAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3 text-gray-500">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : 'Chưa out'}</td>
                  <td className="px-4 py-3 text-gray-500">{a.device ? a.device.label : 'Manual'}</td>
                  <td className="px-4 py-3 text-center">
                    {a.isApproved 
                      ? <span className="inline-flex bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">Đã Duyệt</span>
                      : a.approvedBy 
                        ? <span className="inline-flex bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">Từ Chối</span>
                        : <span className="inline-flex bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">Chờ Duyệt</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleApprove(a.id, true)} className="text-green-600 hover:underline mr-3 font-medium">Duyệt</button>
                    <button onClick={() => handleApprove(a.id, false)} className="text-red-600 hover:underline font-medium">Từ chối</button>
                  </td>
                </tr>
              ))}
              {attendances.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Chưa có ai check-in hôm nay.</td></tr>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Lịch làm việc sắp tới</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
        >
          {showForm ? 'Đóng form' : '+ Xếp ca'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded border shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">User ID</label>
              <input required value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} className="w-full border p-2 rounded" placeholder="Nhập ID..." />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ngày làm việc</label>
              <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Từ giờ (HH:mm)</label>
              <input required type="time" value={form.shiftStart} onChange={e => setForm({...form, shiftStart: e.target.value})} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Đến giờ (HH:mm)</label>
              <input required type="time" value={form.shiftEnd} onChange={e => setForm({...form, shiftEnd: e.target.value})} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Vị trí</label>
              <input required value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="w-full border p-2 rounded" placeholder="Bếp / Phục vụ..." />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow">
                Xác nhận xếp ca
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Đang tải...</p> : (
        <div className="bg-white rounded border overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Ngày</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Nhân viên</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Ca làm</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Vị trí</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schedules.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-gray-900 font-medium">{new Date(s.date).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3 text-gray-500">{s.user.name} ({s.user.role})</td>
                  <td className="px-4 py-3 text-blue-600 font-semibold">{s.shiftStart} - {s.shiftEnd}</td>
                  <td className="px-4 py-3 text-gray-500">{s.position}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline">Xóa</button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Chưa có dữ liệu.</td></tr>
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
    <div className="space-y-6">
      <div className="flex items-end gap-4 bg-white p-4 rounded border shadow-sm">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Từ ngày</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="border p-2 rounded w-40" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Đến ngày</label>
          <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="border p-2 rounded w-40" />
        </div>
        <button onClick={fetchReport} className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded h-[42px] font-medium">
          Xem báo cáo
        </button>
      </div>

      {loading ? <p>Đang tải...</p> : (
        <div className="bg-white rounded border overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Nhân viên</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Ngày có mặt</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Ngày vắng</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Tổng giờ làm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.user.name} <span className="text-gray-400 text-xs">({r.user.role})</span></td>
                  <td className="px-4 py-3 text-center text-green-600 font-bold">{r.presentDays}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-bold">{r.absentDays}</td>
                  <td className="px-4 py-3 text-right text-blue-600 font-bold">{r.totalHours} giờ</td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Không có dữ liệu trong khoảng thời gian này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
