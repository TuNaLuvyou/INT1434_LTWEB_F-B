"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, Mail, Download, RefreshCw,
  TrendingUp, ShoppingBag, Tag, BarChart2, Clock, AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, Building2
} from "lucide-react";
import { getAccessTokenFromCookie } from "@/lib/auth/client";
import { fetchBranches } from "@/lib/api/admin";
import { useAuthStore } from "@/stores/auth.store";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import FeatureLock from "@/components/admin/FeatureLock";
import { useFeatureGate } from "@/hooks/useFeatureGate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZReportKPI {
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  averageOrderValue: number;
}

interface ZReportPaymentBreakdown {
  method: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

interface ZReportTopItem {
  rank: number;
  menuItemName: string;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
}

interface ZReportData {
  summary: {
    from: string;
    to: string;
    generatedAt: string;
    restaurantName: string;
    branchName?: string;
    managerEmail: string;
  };
  kpi: ZReportKPI;
  paymentBreakdown: ZReportPaymentBreakdown[];
  topItems: ZReportTopItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5000";

function fmt(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalISOString(dateStr: string, endOfDay = false): string {
  if (!dateStr) return "";
  const [y, m, day] = dateStr.split("-");
  const time = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return `${y}-${m}-${day}${time}`;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Tiền Mặt",
  TRANSFER: "Chuyển Khoản",
};

const METHOD_COLORS: Record<string, string> = {
  CASH: "#10b981",
  TRANSFER: "#3b82f6",
};

// ─── Toast Component ──────────────────────────────────────────────────────────

interface ToastProps { type: "success" | "error"; message: string; }
function Toast({ type, message }: ToastProps) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium animate-in slide-in-from-bottom-4 duration-300 ${type === "success"
        ? "bg-emerald-950 border-emerald-700 text-emerald-200"
        : "bg-rose-950 border-rose-700 text-rose-200"
      }`}>
      {type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZReportPage() {
  const { user } = useAuthStore();
  const { hasFeature } = useFeatureGate();
  const reportLocked = !hasFeature("ADVANCED_REPORTS");

  // Date range — default: today
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  // Branch & User state
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // State
  const [reportData, setReportData] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const getAuthHeader = (): Record<string, string> => {
    const token = getAccessTokenFromCookie();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    async function initData() {
      if (reportLocked) return;
      try {
        if (user?.role === "ADMIN" || user?.role === "PLATFORM_ADMIN") {
          const branchRes = await fetchBranches();
          if (branchRes?.success && Array.isArray(branchRes.data)) {
            setBranches(branchRes.data);
          }
        }
      } catch (e) {
        console.error("Lỗi khi lấy danh sách chi nhánh:", e);
      }
    }
    initData();
  }, [user, reportLocked]);

  // ── Fetch preview data ──────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setReportData(null);
    try {
      const from = toLocalISOString(fromDate, false);
      const to = toLocalISOString(toDate, true);
      const res = await fetch(
        `${API_URL}/api/z-report/data?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&branchId=${selectedBranch}`,
        { headers: { "Content-Type": "application/json", ...getAuthHeader() } }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Lỗi khi tải dữ liệu");
      setReportData(json.data);
    } catch (e: any) {
      showToast("error", e.message ?? "Không thể tải dữ liệu Z-Report");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedBranch]);

  // Tự động tải báo cáo khi thay đổi chi nhánh chọn
  useEffect(() => {
    if (reportLocked) return;
    fetchReport();
  }, [fetchReport, reportLocked]);

  // ── Download PDF ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!fromDate || !toDate) return;
    setDownloading(true);
    try {
      const from = toLocalISOString(fromDate, false);
      const to = toLocalISOString(toDate, true);
      const res = await fetch(
        `${API_URL}/api/z-report/download?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&branchId=${selectedBranch}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) throw new Error("Lỗi tạo PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `z-report-${fromDate}-to-${toDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", "Đã tải xuống PDF Z-Report thành công!");
    } catch (e: any) {
      showToast("error", e.message ?? "Không thể tải PDF");
    } finally {
      setDownloading(false);
    }
  };

  // ── Send Email ──────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!fromDate || !toDate) return;
    setSending(true);
    try {
      const from = toLocalISOString(fromDate, false);
      const to = toLocalISOString(toDate, true);
      const res = await fetch(`${API_URL}/api/z-report/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ from, to, branchId: selectedBranch }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Gửi email thất bại");
      showToast("success", json.message ?? "Đã gửi Z-Report tới Manager!");
    } catch (e: any) {
      showToast("error", e.message ?? "Không thể gửi email Z-Report");
    } finally {
      setSending(false);
    }
  };

  // ── Export Excel ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!fromDate || !toDate) return;
    setExportingExcel(true);
    try {
      const from = toLocalISOString(fromDate, false);
      const to = toLocalISOString(toDate, true);
      const params = new URLSearchParams({
        from,
        to,
        type: 'full',
        branchId: selectedBranch
      });

      const res = await fetch(`${API_URL}/api/analytics/export?${params}`, {
        headers: getAuthHeader()
      });

      if (!res.ok) throw new Error("Lỗi khi tạo file Excel");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `z-report-${fromDate}-to-${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", "Đã tải xuống Excel Z-Report thành công!");
    } catch (e: any) {
      showToast("error", e.message ?? "Không thể xuất Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <AdminHeader
        title="Z-Report • Báo Cáo Chốt Ca"
        icon={<FileText size={13} className="stroke-[2.5]" />}
        rightSide={
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">
            Báo Cáo Ca
          </span>
        }
      />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto relative z-10">
        {reportLocked && (
          <FeatureLock
            featureName="Báo Cáo Nâng Cao (ADVANCED_REPORTS)"
            description="Gói cước hiện tại của bạn không hỗ trợ Báo cáo Z-Report & Phân tích nâng cao. Vui lòng nâng cấp gói cước để sử dụng."
          />
        )}
        {/* Scope Switcher Tabs for Admin */}
        {user?.role === "ADMIN" && (
          <AdminTabs
            items={[
              { key: "branch", label: "Chi Nhánh Hiện Tại", icon: <Building2 className="h-3.5 w-3.5" /> },
              { key: "all", label: "Tất cả chi nhánh", icon: <FileText className="h-3.5 w-3.5" /> },
            ]}
            activeKey={selectedBranch !== "all" ? "branch" : "all"}
            onChange={(key) =>
              setSelectedBranch(key === "all" ? "all" : (user?.currentBranchId || (branches[0]?.id || "")))
            }
            className="mb-4 shrink-0"
          />
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">

        {/* Control Panel */}
        <div className="shrink-0 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-bold text-white mb-3 sm:mb-4">Chọn Kỳ Báo Cáo</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
            {/* Branch Dropdown selector if specific branch scope is active */}
            {user?.role === "ADMIN" && selectedBranch !== "all" && (
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-violet-400" /> Chọn chi nhánh
                </label>
                <select
                  id="z-report-branch-select"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition-all"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      📍 {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* From date */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs text-zinc-400 font-medium">Từ ngày</label>
              <input
                id="z-report-from"
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition-all"
              />
            </div>
            {/* To date */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs text-zinc-400 font-medium">Đến ngày</label>
              <input
                id="z-report-to"
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition-all"
              />
            </div>
            {/* Load button */}
            <button
              id="z-report-load-btn"
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center justify-center sm:justify-start gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-all shrink-0 mt-2 sm:mt-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Tải Báo Cáo
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 h-32 animate-pulse" />
            ))}
          </div>
        )}

        {/* Report Data */}
        {reportData && !loading && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">

            {/* Summary banner */}
            <div className="bg-gradient-to-r from-violet-900/30 to-blue-900/20 border border-violet-800/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-white text-base">{reportData.summary.restaurantName}</h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 font-semibold">
                    {reportData.summary.branchName || (selectedBranch === "all" ? "🏢 Tất cả chi nhánh" : "Chi nhánh")}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Kỳ báo cáo: <span className="text-zinc-200">{fmtDate(reportData.summary.from)}</span>
                  {" → "}
                  <span className="text-zinc-200">{fmtDate(reportData.summary.to)}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Gửi tới: {reportData.summary.managerEmail}</p>
              </div>
              {/* Action buttons */}
              <div className="flex gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <button
                  id="z-report-excel-btn"
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-all disabled:opacity-60"
                >
                  {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />}
                  Xuất Excel
                </button>
                <button
                  id="z-report-download-btn"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-all disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Tải PDF
                </button>
                <button
                  id="z-report-email-btn"
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold transition-all"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Gửi Email Manager
                </button>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: "Tổng Doanh Thu", value: fmt(reportData.kpi.totalRevenue), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Số Đơn Hoàn Thành", value: `${reportData.kpi.totalOrders} đơn`, icon: ShoppingBag, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Tổng Giảm Giá", value: fmt(reportData.kpi.totalDiscount), icon: Tag, color: "text-rose-400", bg: "bg-rose-500/10" },
                { label: "Giá Trị TB / Đơn", value: fmt(Math.round(reportData.kpi.averageOrderValue)), icon: BarChart2, color: "text-violet-400", bg: "bg-violet-500/10" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 sm:p-5 space-y-2 sm:space-y-3 hover:border-zinc-800 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">{kpi.label}</span>
                    <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className={`font-mono font-bold text-lg ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Payment Breakdown + Top Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Payment Breakdown */}
              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 sm:p-6 space-y-4">
                <h3 className="text-sm font-bold text-white">Phương Thức Thanh Toán</h3>
                {reportData.paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-zinc-500">Không có dữ liệu trong kỳ.</p>
                ) : (
                  <div className="space-y-4">
                    {reportData.paymentBreakdown.map((row) => (
                      <div key={row.method} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-300 font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_COLORS[row.method] ?? "#6b7280" }} />
                            {METHOD_LABELS[row.method] ?? row.method}
                          </span>
                          <span className="font-mono text-zinc-400">{row.percentage}% · {fmt(row.revenue)}</span>
                        </div>
                        <div className="h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${row.percentage}%`, backgroundColor: METHOD_COLORS[row.method] ?? "#6b7280" }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500">{row.orderCount} đơn hàng</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Items */}
              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 sm:p-6 space-y-4">
                <h3 className="text-sm font-bold text-white">Top 5 Món Bán Chạy</h3>
                {reportData.topItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">Không có dữ liệu trong kỳ.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.topItems.map((item) => (
                      <div key={item.rank} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-900/60 transition-all">
                        <span className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                            item.rank === 2 ? "bg-zinc-500/20 text-zinc-300" :
                              item.rank === 3 ? "bg-orange-700/20 text-orange-400" :
                                "bg-zinc-800 text-zinc-500"
                          }`}>
                          #{item.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{item.menuItemName}</p>
                          <p className="text-[10px] text-zinc-500">{item.categoryName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono font-bold text-emerald-400">{fmt(item.totalRevenue)}</p>
                          <p className="text-[10px] text-zinc-500">×{item.totalQty} suất</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!reportData && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <FileText className="h-7 w-7 text-zinc-600" />
            </div>
            <div>
              <p className="text-zinc-400 font-medium">Chọn kỳ báo cáo và nhấn <span className="text-violet-400">Tải Báo Cáo</span></p>
              <p className="text-xs text-zinc-600 mt-1">Dữ liệu Z-Report sẽ hiển thị tại đây</p>
            </div>
          </div>
        )}

        </div>
      </main>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
