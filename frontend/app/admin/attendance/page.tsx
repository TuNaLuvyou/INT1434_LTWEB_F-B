"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Calendar, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  XCircle, 
  Download, 
  Clock, 
  UserCheck, 
  UserX,
  FileText
} from "lucide-react";
import AdminTabs from "@/components/admin/AdminTabs";
import { 
  fetchAttendanceToday, 
  fetchAttendanceHistory, 
  approveAttendance, 
  fetchAttendanceReport 
} from "@/lib/api/admin";

enum SubTab {
  Today = "today",
  History = "history",
  Approve = "approve",
  Report = "report"
}

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<SubTab>(SubTab.Today);
  const [todayData, setTodayData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttendanceToday();
      if (data?.data?.attendance) {
        setTodayData([data.data.attendance]);
      } else if (Array.isArray(data?.data)) {
        setTodayData(data.data);
      } else {
        setTodayData([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttendanceHistory();
      if (Array.isArray(data?.data?.history)) {
        setHistoryData(data.data.history);
      } else if (Array.isArray(data?.data)) {
        setHistoryData(data.data);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActiveTabData = useCallback(() => {
    if (activeTab === SubTab.Today) {
      loadToday();
    } else {
      loadHistory();
    }
  }, [activeTab, loadToday, loadHistory]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  const handleApprove = async (id: string) => {
    try {
      const res = await approveAttendance(id);
      if (res.message) {
        alert(res.message);
      }
      loadHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const blob = await fetchAttendanceReport();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_ChamCong_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Lỗi download report:", err);
      alert("Không thể tải báo cáo vào lúc này!");
    }
  };

  // Filter logic
  const filteredToday = todayData.filter(rec => 
    rec.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.device?.label?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = historyData.filter(rec => 
    rec.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.device?.label?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingApprovals = historyData.filter(rec => 
    !rec.isApproved && 
    (rec.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     rec.device?.label?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Quản Lý Chấm Công</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Chấm Công</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Hôm nay, 19 Tháng 5</span>
            </div>
            <button onClick={loadActiveTabData} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex justify-start">
          <AdminTabs />
        </div>

        {/* Section Actions & Sub-Tabs */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-1.5 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 shrink-0">
              <button
                onClick={() => { setActiveTab(SubTab.Today); setSearchQuery(""); }}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === SubTab.Today 
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.25)]" 
                    : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                }`}
              >
                Hôm Nay
              </button>
              <button
                onClick={() => { setActiveTab(SubTab.History); setSearchQuery(""); }}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === SubTab.History 
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.25)]" 
                    : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                }`}
              >
                Lịch Sử
              </button>
              <button
                onClick={() => { setActiveTab(SubTab.Approve); setSearchQuery(""); }}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === SubTab.Approve 
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.25)]" 
                    : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                }`}
              >
                Duyệt Chấm Công
              </button>
              <button
                onClick={() => { setActiveTab(SubTab.Report); setSearchQuery(""); }}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === SubTab.Report 
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.25)]" 
                    : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                }`}
              >
                Báo Cáo
              </button>
            </div>

            {activeTab !== SubTab.Report && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Tìm nhân viên, thiết bị..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>
            )}
          </div>

          {/* Sub-tab 1: TODAY */}
          {activeTab === SubTab.Today && (
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Nhân Viên</th>
                    <th className="px-5 py-3">Vai Trò</th>
                    <th className="px-5 py-3">Thời Gian Check-In</th>
                    <th className="px-5 py-3">Thiết Bị Ghi Nhận</th>
                    <th className="px-5 py-3 text-center">Trạng Thái Phê Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-500 font-light">
                        Đang tải chấm công hôm nay...
                      </td>
                    </tr>
                  ) : filteredToday.map(rec => (
                    <tr key={rec.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 font-semibold text-white">{rec.user?.name}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{rec.user?.role}</td>
                      <td className="px-5 py-3.5 font-mono text-zinc-200">
                        {new Date(rec.checkInAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400">{rec.device?.label || "App Web"}</td>
                      <td className="px-5 py-3.5 text-center">
                        {rec.isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400 font-bold">
                            <CheckCircle className="h-3 w-3" />
                            <span>Đã duyệt</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400 font-bold">
                            <Clock className="h-3 w-3" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredToday.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-600 font-light">
                        Chưa có check-in nào trong ngày hôm nay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab 2: HISTORY */}
          {activeTab === SubTab.History && (
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Nhân Viên</th>
                    <th className="px-5 py-3">Ngày Chấm</th>
                    <th className="px-5 py-3">Giờ Check-in</th>
                    <th className="px-5 py-3">Loại</th>
                    <th className="px-5 py-3">Thiết Bị</th>
                    <th className="px-5 py-3 text-center">Phê Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-light">
                        Đang tải lịch sử chấm công...
                      </td>
                    </tr>
                  ) : filteredHistory.map(rec => {
                    const dateObj = new Date(rec.checkInAt);
                    return (
                      <tr key={rec.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-5 py-3.5 font-semibold text-white">{rec.user?.name}</td>
                        <td className="px-5 py-3.5 font-mono text-zinc-400">
                          {dateObj.toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-zinc-200">
                          {dateObj.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3.5 uppercase font-semibold text-zinc-300">{rec.type || "Check-in"}</td>
                        <td className="px-5 py-3.5 text-zinc-400">{rec.device?.label || "Web App"}</td>
                        <td className="px-5 py-3.5 text-center">
                          {rec.isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400 font-bold">
                              <span>Đã duyệt</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400 font-bold">
                              <span>Chờ duyệt</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-zinc-600 font-light">
                        Không tìm thấy dòng lịch sử chấm công nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab 3: APPROVE */}
          {activeTab === SubTab.Approve && (
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Nhân Viên</th>
                    <th className="px-5 py-3">Thời Gian Check-In</th>
                    <th className="px-5 py-3">Loại</th>
                    <th className="px-5 py-3">Thiết Bị Yêu Cầu</th>
                    <th className="px-5 py-3 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-500 font-light">
                        Đang tải danh sách chờ phê duyệt...
                      </td>
                    </tr>
                  ) : pendingApprovals.map(rec => (
                    <tr key={rec.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 font-semibold text-white">{rec.user?.name}</td>
                      <td className="px-5 py-3.5 font-mono text-zinc-200">
                        {new Date(rec.checkInAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-5 py-3.5 uppercase font-semibold text-zinc-400">{rec.type || "Check-in"}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{rec.device?.label || "Web App"}</td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleApprove(rec.id)}
                          className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold transition-all shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                        >
                          Duyệt Chấm Công
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && pendingApprovals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-600 font-light">
                        Tất cả các chấm công đã được phê duyệt!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab 4: REPORT */}
          {activeTab === SubTab.Report && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <FileText className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-semibold text-white">Xuất Báo Cáo Chấm Công PDF</h3>
                <p className="text-xs text-zinc-400 font-light mt-1">Xuất và tải tệp PDF phân tích chi tiết chấm công và giờ làm của toàn bộ nhân viên.</p>
              </div>
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                <Download className="h-4 w-4" />
                <span>Tải Xuống Báo Cáo (PDF)</span>
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
