"use client";

import { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Clock, 
  Search, 
  Calendar, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  CreditCard,
  Wallet,
  Loader2,
  BarChart3,
  UserCheck,
  Phone
} from "lucide-react";
import { getAccessTokenFromCookie, setAccessToken } from "@/lib/auth/client";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import RevenueTrendChart from "@/components/admin/RevenueTrendChart";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Transaction {
  id: string;
  tableNo: string;
  customerName: string;
  amount: number;
  time: string;
  method: "Chuyển khoản" | "Tiền mặt";
  status: "Completed" | "Preparing" | "Cancelled";
  itemsCount: number;
}

const getLocalDateString = (date: Date = new Date()) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"all" | "branch">("branch");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Completed" | "Preparing" | "Cancelled">("All");
  const [rangeType, setRangeType] = useState<"today" | "yesterday" | "7days" | "30days" | "90days" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(getLocalDateString());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tempCustomDateText, setTempCustomDateText] = useState<string>("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [rangeStartText, setRangeStartText] = useState<string>("");
  const [rangeEndText, setRangeEndText] = useState<string>("");
  const rangeStartInputRef = useRef<HTMLInputElement>(null);
  const rangeEndInputRef = useRef<HTMLInputElement>(null);

  const getFallbackStats = () => ({
    todayRevenue: 0,
    revenueGrowth: "Chưa có dữ liệu hôm nay",
    todayOrders: 0,
    ordersGrowth: "Chưa có dữ liệu hôm nay",
    avgCookingTime: 0,
    cookingTimeDiff: "Chưa có dữ liệu",
    newCustomers: 0,
    customersGrowth: "Chưa có dữ liệu hôm nay",
    hourlySales: [
      { hour: "10:00", value: 0, height: "5%" },
      { hour: "12:00", value: 0, height: "5%" },
      { hour: "14:00", value: 0, height: "5%" },
      { hour: "16:00", value: 0, height: "5%" },
      { hour: "18:00", value: 0, height: "5%" },
      { hour: "20:00", value: 0, height: "5%" },
      { hour: "22:00", value: 0, height: "5%" },
    ],
    paymentMethods: {
      transferPercent: 0,
      cashPercent: 0,
      transferValue: 0,
      cashValue: 0
    },
    recentTransactions: []
  });

  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      }
    } catch (e) {
      console.warn('[Dashboard] Token refresh failed:', e);
    }
    return null;
  };

  const loadStats = async (range = rangeType, date = customDate, tab = activeTab) => {
    try {
      setLoading(true);
      let token = getAccessTokenFromCookie();
      if (!token) {
        token = await refreshAccessToken();
      }
      if (!token) {
        setStats(getFallbackStats());
        return;
      }

      const queryParams = new URLSearchParams({
        rangeType: range,
        ...(range === "custom" && { customDate: date })
      });
      if (user?.role === "MANAGER" || tab === "branch") {
        if (user?.currentBranchId) {
          queryParams.append("branchId", user.currentBranchId);
        }
      }
      const res = await fetch(`${API}/api/analytics/today-overview?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const retryRes = await fetch(`${API}/api/analytics/today-overview?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${newToken}` }
          });
          if (retryRes.ok) {
            const retryJson = await retryRes.json();
            if (retryJson.success) {
              setStats(retryJson.data);
              return;
            }
          }
        }
      }
      
      if (!res.ok) {
        console.error('[Dashboard] loadStats HTTP error:', res.status, res.statusText);
        try {
          const errBody = await res.json();
          console.error('[Dashboard] loadStats HTTP error details:', errBody);
        } catch {}
        setStats(getFallbackStats());
        return;
      }
      
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      } else {
        console.error('[Dashboard] loadStats API returned success=false:', json.message);
        setStats(getFallbackStats());
      }
    } catch (err) {
      console.error('[Dashboard] loadStats network/unexpected error:', err);
      setStats(getFallbackStats());
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (newRange: typeof rangeType) => {
    setRangeType(newRange);
    setIsDropdownOpen(false);
    
    let targetDate = customDate;
    if (newRange === "today") {
      targetDate = getLocalDateString(new Date());
    } else if (newRange === "yesterday") {
      targetDate = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    }
    
    setCustomDate(targetDate);
    
    if (newRange !== "custom") {
      loadStats(newRange, targetDate, activeTab);
    }
  };

  const handleCustomDateApply = (dateStr: string) => {
    setCustomDate(dateStr);
    setRangeType("custom");
    setIsDropdownOpen(false);
    loadStats("custom", dateStr, activeTab);
  };

  const handleNativeDateChange = (ymdDate: string) => {
    if (ymdDate) {
      const dmy = ymdDate.split("-").reverse().join("-");
      setTempCustomDateText(dmy);
    }
  };

  const handleTextInputSubmit = () => {
    const parts = tempCustomDateText.split("-");
    if (parts.length === 3) {
      const day = parts[0].trim().padStart(2, '0');
      const month = parts[1].trim().padStart(2, '0');
      const year = parts[2].trim();
      if (day.length === 2 && month.length === 2 && year.length === 4) {
        const ymd = `${year}-${month}-${day}`;
        const dateTest = new Date(ymd);
        if (!isNaN(dateTest.getTime())) {
          handleCustomDateApply(ymd);
          return;
        }
      }
    }
    toast.error("Vui lòng nhập đúng định dạng ngày dd-mm-yyyy (ví dụ: 30-05-2026)");
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (customDate) {
      if (customDate.includes("_")) {
        const [_, end] = customDate.split("_");
        setTempCustomDateText(end.split("-").reverse().join("-"));
      } else {
        setTempCustomDateText(customDate.split("-").reverse().join("-"));
      }
    }
  }, [customDate]);

  useEffect(() => {
    if (isDropdownOpen && customDate) {
      if (customDate.includes("_")) {
        const [_, end] = customDate.split("_");
        setTempCustomDateText(end.split("-").reverse().join("-"));
      } else {
        setTempCustomDateText(customDate.split("-").reverse().join("-"));
      }
    }
  }, [isDropdownOpen, customDate]);

  const handleNativeRangeStartChange = (ymdDate: string) => {
    if (ymdDate) {
      setRangeStartText(ymdDate.split("-").reverse().join("-"));
    }
  };

  const handleNativeRangeEndChange = (ymdDate: string) => {
    if (ymdDate) {
      setRangeEndText(ymdDate.split("-").reverse().join("-"));
    }
  };

  const handleRangeSubmit = () => {
    const parsePart = (text: string) => {
      const parts = text.split("-");
      if (parts.length === 3) {
        const day = parts[0].trim().padStart(2, '0');
        const month = parts[1].trim().padStart(2, '0');
        const year = parts[2].trim();
        if (day.length === 2 && month.length === 2 && year.length === 4) {
          const ymd = `${year}-${month}-${day}`;
          const dateTest = new Date(ymd);
          if (!isNaN(dateTest.getTime())) {
            return ymd;
          }
        }
      }
      return null;
    };

    const startYmd = parsePart(rangeStartText);
    const endYmd = parsePart(rangeEndText);

    if (!startYmd || !endYmd) {
      toast.error("Vui lòng nhập đúng định dạng dd-mm-yyyy cho cả hai ngày.");
      return;
    }

    if (new Date(startYmd) > new Date(endYmd)) {
      toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }

    handleCustomDateApply(`${startYmd}_${endYmd}`);
  };

  useEffect(() => {
    if (isDropdownOpen) {
      if (customDate && customDate.includes("_")) {
        const [s, e] = customDate.split("_");
        setRangeStartText(s.split("-").reverse().join("-"));
        setRangeEndText(e.split("-").reverse().join("-"));
      } else {
        const todayDmy = getLocalDateString().split("-").reverse().join("-");
        setRangeStartText(todayDmy);
        setRangeEndText(todayDmy);
      }
    }
  }, [isDropdownOpen, customDate]);

  const filteredTransactions = (stats?.recentTransactions || []).filter((t: Transaction) => {
    const matchesSearch = t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.tableNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCustomerHistory = (stats?.customerHistory || []).filter((c: any) => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
  });

  const getStatusStyle = (status: Transaction["status"]) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Preparing":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Cancelled":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
  };

  const getMethodIcon = (method: Transaction["method"]) => {
    if (method === "Chuyển khoản") {
      return <CreditCard className="h-3 w-3 text-violet-400 animate-pulse" />;
    }
    return <DollarSign className="h-3 w-3 text-emerald-400" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  const formatDateToDDMMYYYY = (date: Date) => {
    return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  };

  const formatHeaderDate = (rangeStr: string) => {
    if (!rangeStr) return "";
    if (rangeStr.includes("_")) {
      const [startStr, endStr] = rangeStr.split("_");
      return `${startStr.split("-").reverse().join("-")} đến ${endStr.split("-").reverse().join("-")}`;
    }
    return rangeStr.split("-").reverse().join("-");
  };

  const getGrowthIcon = (growthText: string) => {
    if (growthText && growthText.startsWith("-")) {
      return <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />;
    }
    return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />;
  };

  const getGrowthClass = (growthText: string) => {
    if (growthText && growthText.startsWith("-")) {
      return "text-rose-400";
    }
    return "text-emerald-400";
  };

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase">Đang đồng bộ phân tích thời gian thực...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <AdminHeader
        title="Analytics"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        badge="Management Suite"
        rightSide={
          <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-semibold hover:text-white hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <Calendar className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="hidden sm:inline">
                  {rangeType === "today" && `Hôm nay: ${formatDateToDDMMYYYY(new Date())}`}
                  {rangeType === "yesterday" && `Hôm qua: ${formatDateToDDMMYYYY(new Date(Date.now() - 24 * 60 * 60 * 1000))}`}
                  {rangeType === "7days" && "7 ngày qua"}
                  {rangeType === "30days" && "30 ngày qua"}
                  {rangeType === "90days" && "90 ngày qua"}
                  {rangeType === "custom" && `Ngày: ${formatHeaderDate(customDate)}`}
                </span>
                <span className="sm:hidden text-[11px]">
                  {rangeType === "today" && formatDateToDDMMYYYY(new Date())}
                  {rangeType === "yesterday" && formatDateToDDMMYYYY(new Date(Date.now() - 24 * 60 * 60 * 1000))}
                  {rangeType === "7days" && "7 ngày"}
                  {rangeType === "30days" && "30 ngày"}
                  {rangeType === "90days" && "90 ngày"}
                  {rangeType === "custom" && formatHeaderDate(customDate)}
                </span>
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chọn ngày cụ thể</div>
                      <div className="px-2.5 py-1.5 space-y-1.5">
                        <div className="relative flex items-center">
                          {/* Ô nhập chữ tự do chỉnh sửa dạng dd-mm-yyyy */}
                          <input 
                            type="text" 
                            placeholder="dd-mm-yyyy"
                            value={tempCustomDateText}
                            onChange={(e) => setTempCustomDateText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleTextInputSubmit();
                              }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono text-center cursor-text"
                          />
                          
                          {/* Nút emoji mở popup lịch nhanh bên phải */}
                          <button 
                            type="button"
                            onClick={() => dateInputRef.current?.showPicker()}
                            className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                            title="Mở lịch chọn"
                          >
                            📅
                          </button>

                          {/* Ẩn hoàn toàn input date gốc */}
                          <input 
                            ref={dateInputRef}
                            type="date" 
                            max={getLocalDateString()}
                            onChange={(e) => handleNativeDateChange(e.target.value)}
                            className="absolute w-0 h-0 opacity-0 pointer-events-none"
                          />
                        </div>
                        {/* Nút Áp dụng ngày cụ thể */}
                        <button
                          type="button"
                          onClick={handleTextInputSubmit}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-violet-900/10"
                        >
                          Áp dụng ngày
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-1.5 mt-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chọn khoảng ngày</div>
                      <div className="px-2.5 py-1.5 space-y-2">
                        {/* Từ ngày */}
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-zinc-500 font-medium ml-1">Từ ngày</span>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              placeholder="dd-mm-yyyy"
                              value={rangeStartText}
                              onChange={(e) => setRangeStartText(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono text-center cursor-text"
                            />
                            <button 
                              type="button"
                              onClick={() => rangeStartInputRef.current?.showPicker()}
                              className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                            >
                              📅
                            </button>
                            <input 
                              ref={rangeStartInputRef}
                              type="date" 
                              max={getLocalDateString()}
                              onChange={(e) => handleNativeRangeStartChange(e.target.value)}
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                            />
                          </div>
                        </div>

                        {/* Đến ngày */}
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-zinc-500 font-medium ml-1">Đến ngày</span>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              placeholder="dd-mm-yyyy"
                              value={rangeEndText}
                              onChange={(e) => setRangeEndText(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono text-center cursor-text"
                            />
                            <button 
                              type="button"
                              onClick={() => rangeEndInputRef.current?.showPicker()}
                              className="absolute right-2.5 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5 active:scale-90"
                            >
                              📅
                            </button>
                            <input 
                              ref={rangeEndInputRef}
                              type="date" 
                              max={getLocalDateString()}
                              onChange={(e) => handleNativeRangeEndChange(e.target.value)}
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                            />
                          </div>
                        </div>

                        {/* Nút Áp dụng khoảng ngày */}
                        <button
                          type="button"
                          onClick={handleRangeSubmit}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-violet-900/10 mt-1"
                        >
                          Áp dụng khoảng ngày
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-1.5 mt-1">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 mb-1.5 pb-1">Chọn nhanh</div>
                      
                      <button 
                        onClick={() => handleRangeChange("today")}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          rangeType === "today" ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        Hôm nay
                      </button>
                      
                      <button 
                        onClick={() => handleRangeChange("yesterday")}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          rangeType === "yesterday" ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        Hôm qua
                      </button>
                      
                      <button 
                        onClick={() => handleRangeChange("7days")}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          rangeType === "7days" ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        7 ngày gần nhất
                      </button>
                      
                      <button 
                        onClick={() => handleRangeChange("30days")}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          rangeType === "30days" ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        30 ngày gần nhất
                      </button>

                      <button 
                        onClick={() => handleRangeChange("90days")}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          rangeType === "90days" ? "bg-violet-600/10 text-violet-400 border border-violet-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        90 ngày gần nhất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => loadStats(rangeType, customDate, activeTab)}
              className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Admin Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
        <AdminTabs
          items={[
            { key: "branch", label: "Chi Nhánh Hiện Tại" },
            ...(user?.role === 'ADMIN' ? [{ key: "all", label: "Tổng Toàn Hệ Thống" }] : []),
          ]}
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'branch' | 'all');
            loadStats(rangeType, customDate, key as 'branch' | 'all');
          }}
          className="mb-4 sm:mb-6 shrink-0"
        />
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <>
        {/* Row 1: KPI Stats Widgets */}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
          {/* Card 1 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 sm:p-5 space-y-2 sm:space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium leading-tight">
                Doanh Thu {rangeType === "today" || rangeType === "yesterday" || rangeType === "custom" ? "Hôm Nay" : rangeType === "7days" ? "7 Ngày" : rangeType === "30days" ? "30 Ngày" : "90 Ngày"}
              </span>
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <DollarSign className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">
                {formatCurrency(stats?.todayRevenue || 0)}
              </h3>
              <div className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold ${getGrowthClass(stats?.revenueGrowth)}`}>
                {getGrowthIcon(stats?.revenueGrowth)}
                <span className="truncate">{stats?.revenueGrowth}</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 sm:p-5 space-y-2 sm:space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium leading-tight">
                Đơn Hàng {rangeType === "today" || rangeType === "yesterday" || rangeType === "custom" ? "Đã Giao" : rangeType === "7days" ? "7 Ngày" : rangeType === "30days" ? "30 Ngày" : "90 Ngày"}
              </span>
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <ShoppingBag className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">
                {stats?.todayOrders || 0} Đơn
              </h3>
              <div className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold ${getGrowthClass(stats?.ordersGrowth)}`}>
                {getGrowthIcon(stats?.ordersGrowth)}
                <span className="truncate">{stats?.ordersGrowth}</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 sm:p-5 space-y-2 sm:space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium leading-tight">TG Chế Biến TB</span>
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">
                {stats?.avgCookingTime ?? 11.4} Phút
              </h3>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
                <span className="truncate">{stats?.cookingTimeDiff}</span>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 sm:p-5 space-y-2 sm:space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium leading-tight">
                Lượt Quét {rangeType === "today" || rangeType === "yesterday" || rangeType === "custom" ? "Tại Bàn" : rangeType === "7days" ? "7 Ngày" : rangeType === "30days" ? "30 Ngày" : "90 Ngày"}
              </span>
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                <Users className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">
                {stats?.newCustomers || 0} Lượt
              </h3>
              <div className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold ${getGrowthClass(stats?.customersGrowth)}`}>
                {getGrowthIcon(stats?.customersGrowth)}
                <span className="truncate">{stats?.customersGrowth}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 shrink-0">
          {/* Chart Left: Sales by Hours */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 lg:col-span-2 flex flex-col justify-between h-[220px] sm:h-[250px] shrink-0">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {rangeType === "today" || rangeType === "yesterday" || rangeType === "custom" ? "Doanh Thu Theo Giờ" : "Doanh Thu Theo Ngày"}
                </h2>
                <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                  {rangeType === "today" || rangeType === "yesterday" || rangeType === "custom" 
                    ? "Thống kê doanh số bán hàng theo các khung giờ trong ngày." 
                    : `Thống kê doanh số bán hàng trong ${rangeType === "7days" ? "7 ngày qua" : rangeType === "30days" ? "30 ngày qua" : "90 ngày qua"}.`}
                </p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-violet-400 font-bold">
                Live Data
              </span>
            </div>

            {/* Custom Premium pure CSS Bar Chart */}
            <div className="flex items-end justify-between h-28 pt-4 border-b border-zinc-900 px-4 shrink-0">
              {(stats?.hourlySales || []).map((data: any, index: number) => (
                <div key={index} className="flex flex-col items-center gap-1 group w-full relative">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 bg-zinc-900 text-[9px] font-mono font-bold text-white px-2 py-1 rounded border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-10">
                    {formatCurrency(data.value)}
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: data.height }}
                    className="w-8 sm:w-10 rounded-t-lg bg-gradient-to-t from-violet-600/20 to-violet-500 hover:from-violet-500 hover:to-fuchsia-400 transition-all duration-300 relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                  </div>
                  {/* Hour Label */}
                  <span className="text-[9px] text-zinc-500 font-mono mt-0.5">{data.hour}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Right: Sales Channels & Payments */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 flex flex-col justify-between h-[220px] sm:h-[250px] shrink-0">
            <div className="shrink-0">
              <h2 className="text-sm font-bold text-white">Phương Thức Thanh Toán</h2>
              <p className="text-[11px] text-zinc-400 font-light mt-0.5">Phân tích tỷ trọng dòng tiền hôm nay.</p>
            </div>

            {/* Horizontal progress visualization */}
            <div className="space-y-4 py-1">
              {/* Chuyển khoản */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                    Chuyển khoản
                  </span>
                  <span className="font-mono text-zinc-400 font-semibold">
                    {stats?.paymentMethods?.transferPercent || 0}% ({formatCurrency(stats?.paymentMethods?.transferValue || 0)})
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500" 
                    style={{ width: `${stats?.paymentMethods?.transferPercent || 0}%` }} 
                  />
                </div>
              </div>

              {/* Tiền mặt */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Tiền mặt
                  </span>
                  <span className="font-mono text-zinc-400 font-semibold">
                    {stats?.paymentMethods?.cashPercent || 0}% ({formatCurrency(stats?.paymentMethods?.cashValue || 0)})
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" 
                    style={{ width: `${stats?.paymentMethods?.cashPercent || 0}%` }} 
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-900 text-[10px] text-zinc-500 font-light leading-relaxed shrink-0">
              Tổng quan thanh toán được tính toán tự động dựa trên giao dịch POS đồng bộ.
            </div>
          </div>
        </div>

        {/* Row 3: Recent Transactions Data Table */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-3 sm:p-5 flex flex-col space-y-3 sm:space-y-4 pb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-white">Giao Dịch Gần Đây</h2>
              <p className="text-[11px] text-zinc-400 font-light mt-0.5 hidden sm:block">Danh sách các hóa đơn vừa được thực hiện trong ngày.</p>
            </div>

            {/* Filter Tools */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto items-stretch sm:items-center">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Mã hóa đơn, số bàn..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>

              {/* Status Selectors */}
              <div className="flex gap-1 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 shrink-0 overflow-x-auto">
                {(["All", "Completed", "Preparing", "Cancelled"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`whitespace-nowrap px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      statusFilter === f 
                        ? "bg-violet-600 text-white" 
                        : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                    }`}
                  >
                    {f === "All" ? "Tất cả" : f === "Completed" ? "Đã xong" : f === "Preparing" ? "Đang làm" : "Đã hủy"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* High-Fidelity Data Table */}
          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Mã Đơn Hàng</th>
                  <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Đơn Số / Bàn</th>
                  <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thời Gian</th>
                  <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Số Món</th>
                  <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Tổng Hóa Đơn</th>
                  <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thanh Toán</th>
                  <th className="px-5 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {filteredTransactions.map((trans: Transaction, idx: number) => (
                  <tr key={`${trans.id}-${trans.status}-${idx}`} className="hover:bg-zinc-900/20 transition-all">
                    <td className="px-5 py-3 font-mono font-bold text-white">{trans.id}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-violet-400">Đơn số {filteredTransactions.length - idx}</div>
                      <div className="text-[10px] text-zinc-500 font-light mt-0.5">{trans.tableNo}</div>
                    </td>
                    <td className="px-5 py-3 font-mono text-zinc-400">{trans.time}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-300">{trans.itemsCount} món</td>
                    <td className="px-5 py-3 font-mono font-semibold text-zinc-200">{formatCurrency(trans.amount)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 w-fit mx-auto font-medium">
                        {getMethodIcon(trans.method)}
                        <span>{trans.method}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusStyle(trans.status)}`}>
                        {trans.status === "Completed" ? "Thành công" : trans.status === "Preparing" ? "Đang nấu" : "Đã hủy"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-zinc-600 font-light">
                      Không tìm thấy giao dịch nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 4: Revenue Trend Line Chart (Ngày/Tuần/Tháng/Năm) */}
        <RevenueTrendChart />

        {/* Row 5: Customer Transaction History */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-400" />
                Lịch Sử Giao Dịch Khách Hàng
              </h2>
              <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                Bảng tổng hợp lịch sử tích điểm và tổng chi tiêu của khách hàng thân thiết
              </p>
            </div>

            {/* Customer Search Bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm theo tên hoặc SĐT khách hàng..." 
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/30 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3.5">Khách Hàng</th>
                  <th className="px-5 py-3.5">Số Điện Thoại</th>
                  <th className="px-5 py-3.5 text-center">Tổng Số Đơn</th>
                  <th className="px-5 py-3.5 text-right">Tổng Tích Lũy Chi</th>
                  <th className="px-5 py-3.5 text-center">Điểm Thưởng</th>
                  <th className="px-5 py-3.5 text-right">Giao Dịch Gần Nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/80 text-xs">
                {filteredCustomerHistory.slice(0, 10).map((c: any, idx: number) => {
                  const nameStr = c.name || 'Khách vãng lai';
                  const initials = nameStr.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={c.id || idx} className="hover:bg-zinc-900/30 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
                              {nameStr}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                          <Phone className="h-3 w-3 text-zinc-500" />
                          {c.phone || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                          {c.orderCount || 0} đơn
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(c.totalSpent || 0)}
                      </td>
                      <td className="px-5 py-3 text-center font-mono">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px]">
                          ⭐ {c.points || 0} pts
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-zinc-500 text-[11px]">
                        {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('vi-VN') : '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredCustomerHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500 font-light">
                      Không tìm thấy lịch sử giao dịch khách hàng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        </div>
      </main>
    </div>
  );
}
