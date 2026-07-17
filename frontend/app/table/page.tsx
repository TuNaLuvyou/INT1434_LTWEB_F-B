"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Users, 
  Clock, 
  AlertCircle,
  ChevronRight,
  QrCode,
  Flame,
  ArrowLeft,
  Loader2,
  Table as TableIcon,
  Plus,
  X,
  Trash2,
  UtensilsCrossed
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { getAccessTokenFromCookie } from "../../lib/auth/client";
import TableQRCode from "../../components/floor/TableQRCode";

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  isExcess?: boolean;
}

export default function TableSelectionInternalPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [qrTableId, setQrTableId] = useState<string | null>(null);

  // States for Add Table feature
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Deletion States & Handlers
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const handleDeleteTable = async (tableId: string, tableNumber: number) => {
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa Bàn số ${tableNumber}? Hành động này không thể hoàn tác.`);
    if (!confirmDelete) return;

    setDeletingId(tableId);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/tables/${tableId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Xóa bàn ăn thất bại.");
      }

      if (result.success) {
        setTables(prev => prev.filter(t => t.id !== tableId));
      } else {
        throw new Error(result.message || "Xóa bàn ăn thất bại.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Có lỗi xảy ra khi xóa bàn ăn.");
    } finally {
      setDeletingId(null);
    }
  };

  // Load Auth Session to verify ADMIN/MANAGER access
  const { user, fetchCurrentUser } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const hasToken = isMounted ? !!getAccessTokenFromCookie() : false;
  const canManage = hasToken && user && (user.role === "ADMIN" || user.role === "MANAGER");

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber || !newLabel) {
      setAddError("Vui lòng nhập đầy đủ số bàn và tên bàn hiển thị.");
      return;
    }
    
    const num = parseInt(newTableNumber);
    if (isNaN(num) || num < 1 || num > 99) {
      setAddError("Số bàn phải là số nguyên từ 1 đến 99.");
      return;
    }

    setAddLoading(true);
    setAddError(null);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/tables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          tableNumber: num,
          label: newLabel.trim()
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Tạo bàn mới thất bại.");
      }

      if (result.success && result.data) {
        setTables(prev => [...prev, result.data].sort((a, b) => a.tableNumber - b.tableNumber));
        setIsAddOpen(false);
        setNewTableNumber("");
        setNewLabel("");
      } else {
        throw new Error(result.message || "Tạo bàn mới thất bại.");
      }
    } catch (err: any) {
      console.error(err);
      setAddError(err.message || "Có lỗi xảy ra khi tạo bàn mới.");
    } finally {
      setAddLoading(false);
    }
  };

  const updateTableStatus = async (tableId: string, newStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED") => {
    setUpdatingId(tableId);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/tables/${tableId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Cập nhật trạng thái thất bại.");
      const result = await res.json();
      if (result.success && result.data) {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
      } else {
        throw new Error(result.message || "Cập nhật thất bại.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Không thể cập nhật trạng thái bàn.");
    } finally {
      setUpdatingId(null);
    }
  };

  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/tables?t=${Date.now()}`, {
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });
      if (!res.ok) throw new Error("Không thể kết nối tới server.");
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setTables(result.data);
      } else {
        throw new Error("Dữ liệu phản hồi không đúng định dạng.");
      }
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách bàn:", err);
      setError("Không thể lấy dữ liệu bàn ăn. Vui lòng đảm bảo server backend đang chạy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const filteredTables = tables.filter(table => {
    const matchesSearch = 
      table.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      table.tableNumber.toString().includes(searchQuery);
    
    const matchesStatus = 
      statusFilter === "ALL" || 
      table.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const availableCount = tables.filter(t => t.status === "AVAILABLE").length;
  const occupiedCount = tables.filter(t => t.status === "OCCUPIED").length;
  const reservedCount = tables.filter(t => t.status === "RESERVED").length;

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans pb-12">
      {/* Decorative Top Banner Background */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-black to-transparent pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-gray-900 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-md shadow-black/30 shrink-0">
              <TableIcon className="text-white h-4 w-4 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h1 className="text-sm font-extrabold text-gray-100 tracking-tight leading-none">Quản lý Bàn</h1>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5 hidden sm:block">Thực đơn khách hàng</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isMounted && canManage && (
              <button 
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-emerald-900 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Thêm bàn</span>
              </button>
            )}

            <button 
              onClick={fetchTables}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900/70 text-xs font-semibold text-gray-200 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 mt-4 sm:mt-8 space-y-4 sm:space-y-6 pb-12">
        {/* Banner giới thiệu */}
        <div className="bg-zinc-900/60 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-lg shadow-black/50 relative overflow-hidden border border-zinc-800 backdrop-blur-sm">
          <div className="absolute right-4 bottom-[-16px] opacity-10 text-7xl sm:text-9xl select-none font-bold pointer-events-none">🍽️</div>
          <div className="space-y-2 sm:space-y-3 relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-white text-[10px] font-bold tracking-wide uppercase">
              <QrCode className="h-3 w-3" /> DANH SÁCH BÀN
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">Quản lý bàn nhà hàng</h2>
            <p className="text-xs text-gray-400 leading-relaxed font-light hidden sm:block">
              Danh sách các bàn hiện có và trạng thái (còn trống / có khách / đặt trước). Dùng cho nghiệp vụ nội bộ.
            </p>
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-zinc-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-2 sm:gap-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-300 shrink-0">
              <span className="font-mono font-bold text-xs sm:text-sm">{tables.length}</span>
            </div>
            <div>
              <p className="text-[9px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng bàn</p>
              <p className="text-xs sm:text-sm font-extrabold text-gray-100">{tables.length} bàn</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-2 sm:gap-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-emerald-700 border border-emerald-800 flex items-center justify-center text-emerald-50 shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Còn trống</p>
              <p className="text-xs sm:text-sm font-extrabold text-gray-100">{availableCount} bàn</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-2 sm:gap-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-amber-800/20 border border-amber-800 flex items-center justify-center text-amber-300 shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Có khách</p>
              <p className="text-xs sm:text-sm font-extrabold text-gray-100">{occupiedCount} bàn</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-2 sm:gap-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-amber-800/20 border border-amber-800 flex items-center justify-center text-amber-300 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Đặt trước</p>
              <p className="text-xs sm:text-sm font-extrabold text-gray-100">{reservedCount} bàn</p>
            </div>
          </div>
        </div>

        {/* Bộ lọc & Tìm kiếm */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between bg-zinc-900/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-900 shadow-sm">
          {/* Status Filters */}
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "AVAILABLE", label: "Trống" },
              { id: "OCCUPIED", label: "Có khách" },
              { id: "RESERVED", label: "Đặt trước" }
            ].map(tab => {
              const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
                      isActive 
                        ? "bg-emerald-600 text-white shadow-sm" 
                        : "bg-zinc-900/40 text-gray-500 hover:text-white hover:bg-zinc-900/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 sm:top-2.5 sm:h-4 sm:w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Tìm bàn ăn..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl py-1.5 sm:py-2 pl-8 sm:pl-9 pr-4 text-xs font-medium text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:bg-zinc-900/40 transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="bg-zinc-900/40 rounded-3xl border border-zinc-900 p-6 space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-20 bg-zinc-800 rounded-lg" />
                  <div className="h-5 w-16 bg-zinc-800 rounded-full" />
                </div>
                <div className="h-8 w-2/3 bg-zinc-800 rounded-lg mt-2" />
                <div className="h-10 w-full bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900 border border-red-800 rounded-3xl p-6 text-center max-w-md mx-auto space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-800 text-red-200 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-red-200 text-sm">Lỗi kết nối dữ liệu</h3>
              <p className="text-xs text-red-300 leading-relaxed px-4">{error}</p>
            </div>
            <button 
              onClick={fetchTables}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Thử lại
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTables.length === 0 && (
            <div className="bg-zinc-900/40 rounded-3xl border border-zinc-900 p-12 text-center max-w-sm mx-auto space-y-4 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-zinc-800 border border-zinc-800 text-gray-500 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-gray-100 text-sm">Không tìm thấy bàn nào</h3>
              <p className="text-xs text-gray-500">Vui lòng thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
            </div>
          </div>
        )}

        {/* Grid of Tables */}
        {!loading && !error && filteredTables.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {filteredTables.map(table => {
              const statusBadges = {
                AVAILABLE: { label: "Trống", class: "bg-emerald-900 text-emerald-300 border-emerald-800" },
                OCCUPIED: { label: "Có khách", class: "bg-orange-900 text-orange-300 border-orange-800" },
                RESERVED: { label: "Đặt trước", class: "bg-amber-900 text-amber-300 border-amber-800" }
              };
              const badge = statusBadges[table.status];
              const isLocked = table.isExcess;

              return (
                <div
                  key={table.id}
                  className={`group relative block overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-900 bg-zinc-900/40 p-4 sm:p-6 transition-all duration-300 shadow-xl ${
                    isLocked ? 'opacity-50 grayscale hover:scale-100 pointer-events-none' : 'hover:scale-[1.01] hover:border-zinc-800 hover:bg-zinc-900/60'
                  }`}
                >
                  {/* Glow effect */}
                  {!isLocked && (
                    <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-700 to-emerald-500 opacity-0 blur-[50px] transition-all duration-500 group-hover:opacity-20 group-hover:-translate-x-6 group-hover:translate-y-6" />
                  )}

                  <div className="space-y-2 sm:space-y-3 relative z-10">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] sm:text-[10px] font-bold font-mono text-gray-500 uppercase tracking-widest">
                        #{table.tableNumber}
                      </span>
                      
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded-md bg-red-950/40 text-red-400 border border-red-900/50 text-[9px] font-bold">Quá giới hạn</span>
                        )}
                        {!isLocked && (
                          <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${badge.class}`}>
                            {badge.label}
                          </span>
                        )}

                        {isMounted && canManage && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteTable(table.id, table.tableNumber);
                            }}
                            disabled={deletingId === table.id}
                            className="pointer-events-auto h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                            title="Xóa bàn"
                          >
                            {deletingId === table.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base sm:text-xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors leading-tight">
                      {table.label}
                    </h3>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className={`mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-900/50 flex gap-1.5 sm:gap-2 relative z-10 ${isLocked ? 'invisible' : 'pointer-events-auto'}`}>
                    <button
                      onClick={() => updateTableStatus(table.id, "OCCUPIED")}
                      disabled={updatingId === table.id || table.status === "OCCUPIED"}
                      className={`flex-1 py-1 sm:py-1.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        table.status === "OCCUPIED"
                          ? "bg-orange-600/90 text-white shadow-md shadow-orange-950/20"
                          : "bg-zinc-950/40 text-zinc-400 hover:text-orange-300 hover:bg-orange-950/20 border border-zinc-900"
                      }`}
                    >
                      {updatingId === table.id && table.status !== "OCCUPIED" ? (
                        <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin" />
                      ) : (
                        <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      )}
                      <span>Có khách</span>
                    </button>

                    <button
                      onClick={() => updateTableStatus(table.id, "AVAILABLE")}
                      disabled={updatingId === table.id || table.status === "AVAILABLE"}
                      className={`flex-1 py-1 sm:py-1.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        table.status === "AVAILABLE"
                          ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-950/20"
                          : "bg-zinc-950/40 text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/20 border border-zinc-900"
                      }`}
                    >
                      {updatingId === table.id && table.status !== "AVAILABLE" ? (
                        <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      )}
                      <span>Trống</span>
                    </button>
                  </div>

                  <div className={`mt-2.5 sm:mt-4 relative z-10 flex gap-2 ${isLocked ? 'invisible' : 'pointer-events-auto'}`}>
                    <Link
                      href={`/table/${table.id}?tenantId=${user?.tenantId}&branchId=${user?.branchId}`}
                      className="flex-1 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-zinc-950/30 border border-zinc-800 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white hover:shadow-md flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold text-gray-200 transition-all cursor-pointer"
                    >
                      <UtensilsCrossed className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Thực đơn
                      <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <button
                      onClick={() => setQrTableId(table.id)}
                      className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg sm:rounded-xl bg-zinc-950/30 border border-zinc-800 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                      title="Hiện mã QR"
                    >
                      <QrCode className="h-4 w-4 sm:h-4 sm:w-4 text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Modal Thêm Bàn Mới */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => {
                setIsAddOpen(false);
                setAddError(null);
              }}
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-emerald-400" />
                Thêm bàn mới
              </h2>
              <p className="text-xs text-zinc-500">
                Tạo một bàn ăn mới trong sơ đồ hệ thống nhà hàng.
              </p>
            </div>

            {addError && (
              <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/50 flex gap-2.5 text-xs text-red-400 font-semibold leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddTable} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Số hiệu bàn (1 - 99)
                </label>
                <input
                  type="number"
                  placeholder="Ví dụ: 12"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  disabled={addLoading}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-white focus:outline-none focus:bg-zinc-900/80 transition-all placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Tên hiển thị (Label)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bàn Cửa Sổ 1"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  disabled={addLoading}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-white focus:outline-none focus:bg-zinc-900/80 transition-all placeholder:text-zinc-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setAddError(null);
                  }}
                  disabled={addLoading}
                  className="flex-1 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {addLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Tạo bàn
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrTableId && tables.find(t => t.id === qrTableId) && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" 
          onClick={() => setQrTableId(null)}
        >
          <div className="relative animate-scale-in" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setQrTableId(null)}
              className="absolute -right-3 -top-3 z-10 h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-red-600 flex items-center justify-center transition-all shadow-xl cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <TableQRCode table={tables.find(t => t.id === qrTableId)!} />
          </div>
        </div>
      )}
    </div>
  );
}
