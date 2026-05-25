'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  RefreshCw, 
  UserCheck, 
  Briefcase, 
  MapPin, 
  AlertCircle,
  FileText,
  LayoutDashboard,
  Mail,
  Phone,
  ShieldCheck
} from 'lucide-react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

export default function CheckInClient({ user }: { user: any }) {
  const [activeSubTab, setActiveSubTab] = useState<'checkin' | 'schedule' | 'profile'>('checkin');
  const [attendance, setAttendance] = useState<any>(null);
  const [myAttendanceHistory, setMyAttendanceHistory] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [myProfileRequests, setMyProfileRequests] = useState<any[]>([]);

  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getHeaders = (extraHeaders = {}) => {
    const token = getAccessTokenFromCookie();
    return {
      ...extraHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  const fetchMyHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/my-history`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMyAttendanceHistory(data?.data?.history || []);
      }
    } catch (error) {
      console.error("Error fetching my attendance history:", error);
    }
  }, [API_URL]);

  const fetchToday = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/today`, {
        headers: getHeaders(),
        credentials: 'include', 
      });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data?.data?.attendance || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/schedules?userId=${user.userId}`, { 
        headers: getHeaders(),
        credentials: 'include' 
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data?.data?.schedules || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, user.userId]);

  const fetchMyRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/my-profile-requests`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMyProfileRequests(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (activeSubTab === 'checkin') {
      fetchToday();
      fetchMyHistory();
    } else if (activeSubTab === 'schedule') {
      fetchSchedules();
    } else if (activeSubTab === 'profile') {
      fetchMyRequests();
    }
  }, [activeSubTab, fetchToday, fetchMyHistory, fetchSchedules, fetchMyRequests]);

  const handleCheckIn = async () => {
    // Generate mock/local device token if none exists to allow testing
    let token = localStorage.getItem('deviceToken');
    if (!token) {
      token = "mock-staff-device-token-2026";
      localStorage.setItem('deviceToken', token);
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/checkin`, {
        method: 'POST',
        headers: getHeaders({
          'Content-Type': 'application/json',
          'X-Device-Token': token
        }),
        credentials: 'include', 
      });
      const data = await res.json();
      
      if (res.ok) {
        setAttendance(data.data.attendance);
        alert(`Check-in thành công lúc ${new Date(data.data.attendance.checkInAt).toLocaleTimeString()}`);
        fetchMyHistory();
        router.refresh();
      } else {
        if (data.code === 'INVALID_DEVICE' || data.code === 'NO_DEVICE_TOKEN') {
          setErrorModal('Thiết bị không hợp lệ hoặc chưa được đăng ký. Vui lòng liên hệ Admin.');
        } else {
          alert(data.message || 'Lỗi check-in');
        }
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    let token = localStorage.getItem('deviceToken');
    if (!token) {
      token = "mock-staff-device-token-2026";
      localStorage.setItem('deviceToken', token);
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/checkout`, {
        method: 'POST',
        headers: getHeaders({
          'Content-Type': 'application/json',
          'X-Device-Token': token
        }),
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.ok) {
        setAttendance(data.data.attendance);
        alert(`Check-out thành công! Tổng thời gian làm: ${data.data.attendance.duration}`);
        fetchMyHistory();
      } else {
        alert(data.message || 'Lỗi check-out');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitProfileRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRequest(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/profile-requests`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          pendingName: editForm.name,
          pendingEmail: editForm.email,
          pendingPhone: editForm.phone
        }),
        credentials: 'include'
      });
      if (res.ok) {
        alert('Gửi yêu cầu thay đổi thông tin thành công! Vui lòng chờ Admin/Manager phê duyệt.');
        setIsEditing(false);
        fetchMyRequests();
      } else {
        const data = await res.json();
        alert(data.message || 'Lỗi khi gửi yêu cầu');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-45">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Cổng Nhân Viên</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-semibold tracking-wider uppercase">{user.role}</span>
            </div>
          </div>

          <button onClick={() => {
            if (activeSubTab === 'checkin') {
              fetchToday();
              fetchMyHistory();
            } else if (activeSubTab === 'schedule') {
              fetchSchedules();
            }
          }} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 space-y-6">
        {/* User Card */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[80px] pointer-events-none" />
          <div>
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Tài khoản</span>
            <h2 className="text-lg font-bold text-white mt-0.5">{user.name}</h2>
            <p className="text-xs text-zinc-400 font-light mt-0.5">Mã số: {user.userId}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 w-full max-w-md">
          <button
            onClick={() => setActiveSubTab('checkin')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
              activeSubTab === 'checkin' 
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.25)]" 
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Chấm Công
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
              activeSubTab === 'schedule' 
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.25)]" 
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Lịch Làm Việc
          </button>
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
              activeSubTab === 'profile' 
                ? "bg-teal-600 text-white shadow-[0_0_10px_rgba(13,148,136,0.25)]" 
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Thông Tin Cá Nhân
          </button>
        </div>

        {/* Error Modal banner */}
        {errorModal && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex flex-col gap-3 text-xs w-full animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="font-bold">Lỗi thiết bị: </strong>
                <span className="font-light">{errorModal}</span>
              </div>
              <button className="text-zinc-400 hover:text-white" onClick={() => setErrorModal(null)}>×</button>
            </div>
            
            {/* Direct Token Paste Form for frictionless setup */}
            <div className="border-t border-rose-500/10 pt-3 space-y-2">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Dán Token Thiết Bị Được Cấp Bởi Admin Vào Đây:</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Dán token dạng: dev-..." 
                  id="direct-device-token-input"
                  className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
                />
                <button
                  onClick={() => {
                    const inputEl = document.getElementById('direct-device-token-input') as HTMLInputElement;
                    if (inputEl && inputEl.value.trim()) {
                      localStorage.setItem('deviceToken', inputEl.value.trim());
                      alert('Đã lưu Token thiết bị thành công! Vui lòng bấm Check-in lại.');
                      setErrorModal(null);
                    } else {
                      alert('Vui lòng nhập Token thiết bị hợp lệ.');
                    }
                  }}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all"
                >
                  Lưu Token
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 1: TIME CLOCK */}
        {activeSubTab === 'checkin' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-8 flex flex-col items-center text-center space-y-6">
            
            {/* Digital Clock display */}
            <div className="space-y-1">
              <div className="text-4xl font-extrabold tracking-wider font-mono bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                {currentTime || "00:00:00"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                {currentDate || "Đang đồng bộ..."}
              </div>
            </div>

            {/* Attendance Status & Action Button */}
            {isLoading ? (
              <div className="text-xs text-zinc-500 font-light">Đang đồng bộ dữ liệu chấm công...</div>
            ) : !attendance ? (
              <div className="w-full space-y-6">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-zinc-400 text-xs font-light">
                  Bạn chưa thực hiện Check-in ca làm hôm nay. Vui lòng bấm Check-in dưới đây để bắt đầu.
                </div>
                <button 
                  onClick={handleCheckIn}
                  className="w-full py-4 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(20,184,166,0.25)] hover:shadow-[0_0_25px_rgba(20,184,166,0.4)]"
                >
                  Bắt Đầu Ca Làm (Check-in)
                </button>
              </div>
            ) : !attendance.checkOutAt ? (
              <div className="w-full space-y-6">
                <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs font-medium space-y-1">
                  <div className="text-teal-400">Đang trong ca làm việc</div>
                  <div className="text-[10px] text-zinc-500 font-light font-mono">
                    Check-in lúc: {new Date(attendance.checkInAt).toLocaleTimeString("vi-VN")}
                  </div>
                </div>
                <button 
                  onClick={handleCheckOut}
                  className="w-full py-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                >
                  Kết Thúc Ca Làm (Check-out)
                </button>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-xs space-y-2">
                  <div className="text-emerald-400 font-bold">Đã hoàn thành ca làm gần nhất hôm nay!</div>
                  <div className="text-[10px] text-zinc-500 font-light font-mono space-y-0.5">
                    <div>Check-in: {new Date(attendance.checkInAt).toLocaleTimeString("vi-VN")}</div>
                    <div>Check-out: {new Date(attendance.checkOutAt).toLocaleTimeString("vi-VN")}</div>
                  </div>
                </div>
                {attendance.duration && (
                  <div className="py-2.5 rounded-xl bg-teal-500/5 border border-teal-500/10 text-teal-400 font-semibold text-xs">
                    Tổng thời gian làm việc: {attendance.duration}
                  </div>
                )}
                <button 
                  onClick={handleCheckIn}
                  className="w-full py-4 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(20,184,166,0.25)] hover:shadow-[0_0_25px_rgba(20,184,166,0.4)]"
                >
                  Bắt Đầu Ca Làm (Check-in)
                </button>
              </div>
            )}
          </div>

          {/* Lịch Sử Chấm Công Của Tôi */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-4 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Lịch Sử Chấm Công Của Tôi</h3>
              <span className="text-[10px] text-zinc-500 font-light font-mono">Tất cả ca làm</span>
            </div>
            
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-4 py-2.5">Ngày</th>
                    <th className="px-4 py-2.5">Check-in</th>
                    <th className="px-4 py-2.5">Check-out</th>
                    <th className="px-4 py-2.5 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {myAttendanceHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-zinc-600 font-light">
                        Chưa có lịch sử chấm công nào được ghi nhận.
                      </td>
                    </tr>
                  ) : myAttendanceHistory.map(h => (
                    <tr key={h.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {new Date(h.checkInAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                        {new Date(h.checkInAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-500 font-semibold">
                        {h.checkOutAt ? new Date(h.checkOutAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.isApproved ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400">
                            Đã duyệt
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold text-amber-400">
                            Chờ duyệt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

        {/* Tab Content 2: MY SCHEDULE */}
        {activeSubTab === 'schedule' && (
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Lịch Trực Ca Của Tôi</h3>
            
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Ngày Trực</th>
                    <th className="px-5 py-3">Ca Làm</th>
                    <th className="px-5 py-3">Vị Trí</th>
                    <th className="px-5 py-3">Ghi Chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-zinc-500 font-light">
                        Đang tải lịch trực...
                      </td>
                    </tr>
                  ) : schedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-zinc-600 font-light">
                        Bạn chưa được xếp lịch ca trực nào.
                      </td>
                    </tr>
                  ) : schedules.map(sch => (
                    <tr key={sch.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 font-mono text-zinc-200">
                        {new Date(sch.date).toLocaleDateString("vi-VN", { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {sch.shiftStart} <span className="text-zinc-500 mx-1">→</span> {sch.shiftEnd}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-400 font-semibold uppercase">
                          {sch.position}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 font-light">
                        {sch.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 3: PERSONAL PROFILE */}
        {activeSubTab === 'profile' && (
          <div className="space-y-6">
            
            {/* PENDING REQUEST BANNER */}
            {myProfileRequests.find(r => r.status === 'PENDING') && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <strong className="font-bold">Yêu cầu chỉnh sửa đang chờ duyệt</strong>
                  <p className="text-[10px] text-zinc-400 font-light leading-relaxed">
                    Bạn đã gửi một yêu cầu thay đổi thông tin cá nhân. Vui lòng chờ Admin hoặc Manager phê duyệt để cập nhật hiển thị chính thức.
                  </p>
                  <div className="text-[9px] font-mono bg-zinc-950/40 p-2 rounded border border-zinc-900 mt-2 space-y-0.5">
                    <div>Tên mới gửi: {myProfileRequests.find(r => r.status === 'PENDING')?.pendingName}</div>
                    <div>Email mới gửi: {myProfileRequests.find(r => r.status === 'PENDING')?.pendingEmail}</div>
                    <div>SĐT mới gửi: {myProfileRequests.find(r => r.status === 'PENDING')?.pendingPhone}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white">Hồ sơ Nhân viên</h3>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5">Thông tin tài khoản và hợp đồng lao động tại RestoFlow.</p>
                </div>
                <button
                  onClick={() => {
                    setEditForm({
                      name: user.name,
                      email: user.email || '',
                      phone: myProfileRequests.find(r => r.status === 'APPROVED')?.pendingPhone || '098 765 4321'
                    });
                    setIsEditing(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all uppercase tracking-wider"
                >
                  Chỉnh sửa hồ sơ
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Họ và Tên</span>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-teal-400" />
                    {user.name}
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Email Đăng ký</span>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Mail className="h-4 w-4 text-teal-400" />
                    {user.email || `${user.userId}@restoflow.demo`}
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Vai trò hệ thống</span>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-teal-400" />
                    {user.role === 'STAFF' ? 'Nhân viên (Staff)' : user.role}
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Trạng thái</span>
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Đang hoạt động (Active)
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Số điện thoại liên hệ</span>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Phone className="h-4 w-4 text-teal-400" />
                    {myProfileRequests.find(r => r.status === 'APPROVED')?.pendingPhone || '098 765 4321'}
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-1.5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Ngày bắt đầu làm việc</span>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-teal-400" />
                    15 Tháng 02, 2026
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-4 space-y-1.5">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Quy trình chỉnh sửa hồ sơ</span>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-light">
                  Mọi yêu cầu thay đổi Họ tên, Email, Số điện thoại của bạn sau khi gửi đi sẽ được chuyển trực tiếp tới hệ thống xét duyệt của **Admin hoặc Manager** để xác minh trước khi áp dụng chính thức vào cơ sở dữ liệu.
                </p>
              </div>
            </div>

            {/* EDIT PROFILE MODAL */}
            {isEditing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-6 shadow-2xl relative">
                  <div>
                    <h3 className="text-base font-bold text-white">Chỉnh sửa thông tin</h3>
                    <p className="text-xs text-zinc-400 font-light mt-1">Gửi yêu cầu xét duyệt thay đổi hồ sơ cá nhân.</p>
                  </div>

                  <form onSubmit={handleSubmitProfileRequest} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Họ và Tên</label>
                      <input 
                        type="text" 
                        required 
                        value={editForm.name || ''} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Email liên lạc</label>
                      <input 
                        type="email" 
                        required 
                        value={editForm.email || ''} 
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Số điện thoại</label>
                      <input 
                        type="text" 
                        required 
                        value={editForm.phone || ''} 
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingRequest}
                        className="flex-1 bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(20,184,166,0.25)] flex items-center justify-center"
                      >
                        {isSubmittingRequest ? 'Đang gửi...' : 'Gửi yêu cầu'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
