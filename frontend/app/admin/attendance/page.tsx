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
  const [filterStatus, setFilterStatus] = useState<"all" | "approved" | "pending">("all");
  const [filterDate, setFilterDate] = useState("");

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "dd/mm/yyyy";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

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
  const applyFilters = (data: any[]) => {
    return data.filter(rec => {
      const matchSearch =
        rec.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.device?.label?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        filterStatus === "all" ? true :
        filterStatus === "approved" ? rec.isApproved :
        !rec.isApproved;
      const matchDate = !filterDate ? true :
        new Date(rec.checkInAt).toLocaleDateString("en-CA") === filterDate;
      return matchSearch && matchStatus && matchDate;
    });
  };

  const filteredToday = applyFilters(todayData);
  const filteredHistory = applyFilters(historyData);
  const pendingApprovals = applyFilters(historyData.filter(r => !r.isApproved));

  return (
    <div className="h-screen max-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-6 pl-16 lg:pl-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Quản Lý Chấm Công</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Chấm Công</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div 
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                  const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
                  if (input) {
                    try {
                      input.showPicker();
                    } catch (err) {
                      input.focus();
                    }
                  }
                }
              }}
              className="relative hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium cursor-pointer hover:border-violet-500/50 transition-all group"
            >
              <Calendar className="h-3.5 w-3.5 text-zinc-500 group-hover:text-violet-400 transition-colors" />
              <span className="text-zinc-300 text-xs font-mono select-none">
                {filterDate ? formatDateString(filterDate) : "dd/mm/yyyy"}
              </span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
              />
              {filterDate && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFilterDate(""); }}
                  className="text-zinc-500 hover:text-rose-400 transition-colors ml-1 z-10 font-bold"
                >
                  ×
                </button>
              )}
            </div>
            <button onClick={loadActiveTabData} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col p-6 space-y-4 max-w-7xl w-full mx-auto">

        {/* Section Actions & Sub-Tabs */}
        <div className="flex-1 min-h-0 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
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
              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Tìm nhân viên, thiết bị..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                  />
                </div>

                {/* Status filter pills */}
                {activeTab !== SubTab.Approve && (
                  <div className="flex gap-1 border border-zinc-900 bg-zinc-950/60 rounded-xl p-0.5">
                    {(["all", "approved", "pending"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          filterStatus === s
                            ? "bg-violet-600 text-white shadow-[0_0_8px_rgba(124,58,237,0.3)]"
                            : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                        }`}
                      >
                        {s === "all" ? "Tất cả" : s === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reset filters */}
                {(searchQuery || filterDate || filterStatus !== "all") && (
                  <button
                    onClick={() => { setSearchQuery(""); setFilterDate(""); setFilterStatus("all"); }}
                    className="text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-all font-semibold"
                  >
                    Xóa filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sub-tab 1: TODAY */}
          {activeTab === SubTab.Today && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân Viên</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Vai Trò</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thời Gian Check-In</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thời Gian Check-Out</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thiết Bị Ghi Nhận</th>
                    <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Trạng Thái Phê Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-light">
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
                      <td className="px-5 py-3.5 font-mono text-zinc-400">
                        {rec.checkOutAt ? (
                          new Date(rec.checkOutAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        ) : (
                          <span className="text-zinc-600 italic">Chưa check-out</span>
                        )}
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
                      <td colSpan={6} className="px-5 py-8 text-center text-zinc-600 font-light">
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân Viên</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ngày Chấm</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Giờ Check-in</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Giờ Check-out</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Loại</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thiết Bị</th>
                    <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Phê Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-zinc-500 font-light">
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
                        <td className="px-5 py-3.5 font-mono text-zinc-400">
                          {rec.checkOutAt ? (
                            new Date(rec.checkOutAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            <span className="text-zinc-600 italic">Chưa check-out</span>
                          )}
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
                      <td colSpan={7} className="px-5 py-8 text-center text-zinc-600 font-light">
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân Viên</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thời Gian Check-In</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thời Gian Check-Out</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Loại</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thiết Bị Yêu Cầu</th>
                    <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-light">
                        Đang tải danh sách chờ phê duyệt...
                      </td>
                    </tr>
                  ) : pendingApprovals.map(rec => (
                    <tr key={rec.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 font-semibold text-white">{rec.user?.name}</td>
                      <td className="px-5 py-3.5 font-mono text-zinc-200">
                        {new Date(rec.checkInAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-zinc-400">
                        {rec.checkOutAt ? (
                          new Date(rec.checkOutAt).toLocaleString("vi-VN")
                        ) : (
                          <span className="text-zinc-600 italic">Chưa check-out</span>
                        )}
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
                      <td colSpan={6} className="px-5 py-8 text-center text-zinc-600 font-light">
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
