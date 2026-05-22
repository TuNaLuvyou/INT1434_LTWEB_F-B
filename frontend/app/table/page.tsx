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
  Table as TableIcon
} from "lucide-react";

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED";
}

export default function TableSelectionInternalPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/tables`);
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
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-md shadow-black/30">
              <TableIcon className="text-white h-5 w-5" />
            </div>

            <div>
              <h1 className="text-sm font-extrabold text-gray-100 tracking-tight leading-none">Table</h1>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">Thực đơn khách hàng</p>
            </div>
          </div>

          <button 
            onClick={fetchTables}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900/70 text-xs font-semibold text-gray-200 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        {/* Banner giới thiệu */}
        <div className="bg-zinc-900/60 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-black/50 relative overflow-hidden border border-zinc-800 backdrop-blur-sm">
          <div className="absolute right-6 bottom-[-20px] opacity-10 text-9xl select-none font-bold pointer-events-none">🍽️</div>
          <div className="space-y-3 relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-white text-[10px] font-bold tracking-wide uppercase">
              <QrCode className="h-3 w-3" /> DANH SÁCH BÀN
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Danh sách các bàn trong nhà hàng</h2>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-light">
              Danh sách các bàn hiện có và trạng thái (còn trống / có khách / đặt trước). Dùng cho nghiệp vụ nội bộ.
            </p>
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-300 shrink-0">
              <span className="font-mono font-bold text-sm">{tables.length}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng số bàn</p>
              <p className="text-sm font-extrabold text-gray-100">Thiết lập</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-700 border border-emerald-800 flex items-center justify-center text-emerald-50 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bàn trống</p>
              <p className="text-sm font-extrabold text-gray-100">{availableCount} bàn trống</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-800/20 border border-amber-800 flex items-center justify-center text-amber-300 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Có khách</p>
              <p className="text-sm font-extrabold text-gray-100">{occupiedCount} đang dùng</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-800/20 border border-amber-800 flex items-center justify-center text-amber-300 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Đặt trước</p>
              <p className="text-sm font-extrabold text-gray-100">{reservedCount} đã đặt</p>
            </div>
          </div>
        </div>

        {/* Bộ lọc & Tìm kiếm */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900 shadow-sm">
          {/* Status Filters */}
          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "AVAILABLE", label: "Còn trống" },
              { id: "OCCUPIED", label: "Đang ngồi" },
              { id: "RESERVED", label: "Đặt trước" }
            ].map(tab => {
              const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Tìm bàn ăn..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:bg-zinc-900/40 transition-all"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredTables.map(table => {
              const statusBadges = {
                AVAILABLE: { label: "Đang trống", class: "bg-emerald-900 text-emerald-300 border-emerald-800" },
                OCCUPIED: { label: "Có khách", class: "bg-orange-900 text-orange-300 border-orange-800" },
                RESERVED: { label: "Đặt trước", class: "bg-amber-900 text-amber-300 border-amber-800" }
              };
              const badge = statusBadges[table.status];

              return (
                <div
                  key={table.id}
                  className="group relative block overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-900/40 p-8 transition-all duration-300 hover:scale-[1.01] hover:border-zinc-800 hover:bg-zinc-900/60 shadow-xl"
                >
                  {/* Glow effect */}
                  <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-700 to-emerald-500 opacity-0 blur-[50px] transition-all duration-500 group-hover:opacity-20 group-hover:-translate-x-6 group-hover:translate-y-6" />

                  <div className="space-y-3 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-widest">
                        Table #{table.tableNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                      {table.label}
                    </h3>
                  </div>

                  <div className="mt-6 relative z-10">
                    <Link
                      href={`/table/${table.id}`}
                      className="w-full h-10 rounded-xl bg-zinc-950/30 border border-zinc-800 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white hover:shadow-md flex items-center justify-center gap-1.5 text-xs font-bold text-gray-200 transition-all cursor-pointer"
                    >
                      Vào thực đơn
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
