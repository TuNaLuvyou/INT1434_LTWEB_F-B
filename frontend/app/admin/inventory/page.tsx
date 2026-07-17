"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Calendar, 
  RefreshCw, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  ArrowRight,
  Warehouse,
  Store,
  PackageOpen,
  History,
  Loader2,
} from "lucide-react";
import IngredientModal from "@/components/inventory/IngredientModal";
import StockAdjustModal from "@/components/inventory/StockAdjustModal";
import {
  fetchIngredients, deleteIngredient, fetchInventoryLogs,
  fetchBranches, fetchCurrentUser, fetchBranchStock, fetchExportedStats, transferIngredientToBranch,
} from "@/lib/api/admin";
import { useAuthStore } from "@/stores/auth.store";

type Tab = "main" | "branch" | "exported" | "logs";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const today = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

// ── Content area loading overlay ──────────────────────────────────────────────
function ContentLoader({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400 min-h-[400px]">
      <Loader2 className="animate-spin text-violet-500 h-10 w-10 mb-4" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}

// ── Modal Xuất từ Kho tổng → Chi nhánh ──────────────────────────────────────
function TransferModal({ 
  ingredient, 
  branches, 
  onClose, 
  onSaved 
}: { 
  ingredient: any; 
  branches: any[]; 
  onClose: () => void; 
  onSaved: () => void; 
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !quantity || Number(quantity) <= 0) {
      setError("Vui lòng nhập số lượng hợp lệ");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await transferIngredientToBranch({
        ingredientId: ingredient.id,
        branchId,
        quantity: Number(quantity),
        note,
      });
      if (!data.success) throw new Error(data.message || "Lỗi");
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-1">Xuất sang Chi nhánh</h3>
          <p className="text-sm text-zinc-400 mb-5">
            Xuất <span className="text-violet-400 font-semibold">{ingredient.name}</span> từ Kho tổng sang Kho chi nhánh
          </p>
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl mb-5 text-sm">
            <Warehouse className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="text-zinc-300">Tồn kho tổng hiện tại:</span>
            <span className="font-mono font-bold text-white ml-auto">{fmt(Number(ingredient.stock))} {ingredient.unit}</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Chi nhánh nhận hàng</label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-violet-500"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Số lượng xuất ({ingredient.unit})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Nhập số lượng..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Ghi chú (tùy chọn)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Nhập ghi chú..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-all">
                Huỷ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" />
                {loading ? "Đang xử lý..." : "Xuất hàng"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminInventoryPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "PLATFORM_ADMIN";
  const [activeTab, setActiveTab] = useState<Tab>("branch");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveTab(isAdmin ? "main" : "branch");
  }, [isAdmin]);

  // Kho tổng
  const [mainIngredients, setMainIngredients] = useState<any[]>([]);
  // Kho chi nhánh
  const [branchIngredients, setBranchIngredients] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  // Đã xuất
  const [exportedStats, setExportedStats] = useState<any[]>([]);
  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [stockTarget, setStockTarget] = useState<any | null>(null);
  const [transferTarget, setTransferTarget] = useState<any | null>(null);

  // ── Fetch branches ────────────────────────────────────────────
  const loadBranches = useCallback(async () => {
    try {
      const d = await fetchBranches();
      if (d.data) setBranches(d.data ?? []);
    } catch {}
  }, []);

  // ── Kho tổng ──────────────────────────────────────────────────
  const loadMainStock = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIngredients(lowStockFilter);
      setMainIngredients(data?.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [lowStockFilter]);

  // ── Kho chi nhánh ─────────────────────────────────────────────
  const loadBranchStock = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchBranchStock();
      if (d.data) setBranchIngredients(d.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // ── Đã xuất ────────────────────────────────────────────────────
  const loadExportedStats = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchExportedStats();
      if (d.data) setExportedStats(d.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // ── Logs ────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInventoryLogs(logsPage, 20);
      setLogs(data?.data?.logs ?? []);
      setLogsTotal(data?.data?.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, [logsPage]);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => {
    if (activeTab === "main") loadMainStock();
    else if (activeTab === "branch") loadBranchStock();
    else if (activeTab === "exported") loadExportedStats();
    else if (activeTab === "logs") loadLogs();
  }, [activeTab, loadMainStock, loadBranchStock, loadExportedStats, loadLogs]);

  const handleRefresh = () => {
    if (activeTab === "main") loadMainStock();
    else if (activeTab === "branch") loadBranchStock();
    else if (activeTab === "exported") loadExportedStats();
    else loadLogs();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa nguyên liệu "${name}"?`)) return;
    try {
      const res = await deleteIngredient(id);
      if (res.message?.includes("BOM")) {
        alert("Không thể xóa — nguyên liệu đang dùng trong công thức món ăn!");
      } else {
        handleRefresh();
      }
    } catch { alert("Đã xảy ra lỗi!"); }
  };

  // ── Tab labels config ─────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: "main",     label: "Kho tổng",         icon: Warehouse,   adminOnly: true },
    { key: "branch",   label: "Kho chi nhánh",    icon: Store },
    { key: "exported", label: "Đã xuất",           icon: PackageOpen },
    { key: "logs",     label: "Lịch sử nhập/xuất", icon: History },
  ];

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  // ── Filter helpers ────────────────────────────────────────────
  const q = searchQuery.toLowerCase();
  const filteredMain = mainIngredients.filter(i => i.name?.toLowerCase().includes(q));
  const filteredBranch = branchIngredients.filter(i => i.name?.toLowerCase().includes(q));
  const filteredExported = exportedStats.filter(i => i.name?.toLowerCase().includes(q));

  // ── Render ────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
          <p className="text-sm text-zinc-400 font-medium">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pl-16 lg:pl-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-lg text-white">Quản Lý Nguyên Liệu</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Kho hàng</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>{today}</span>
            </div>
            <button onClick={handleRefresh} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-4 sm:mb-6 shrink-0 gap-1">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all outline-none focus:outline-none ${
                activeTab === key
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: KHO TỔNG (Admin only) ─────────────────────────── */}
        {activeTab === "main" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4">
            {loading ? (
              <ContentLoader label="Đang tải kho tổng..." />
            ) : (
              <>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Kho Tổng</h2>
                <p className="text-sm text-zinc-400 mt-0.5">Tồn kho trung tâm. Admin nhập hàng tại đây rồi xuất sang từng chi nhánh.</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input type="text" placeholder="Tìm nguyên liệu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 w-48"
                  />
                </div>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0">
                  <Plus className="h-3.5 w-3.5" /><span>Thêm</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Tên Nguyên Liệu</th>
                    <th className="px-5 py-3">Đơn Vị</th>
                    <th className="px-5 py-3 text-right">Tồn Kho Tổng</th>
                    <th className="px-5 py-3 text-right">Ngưỡng Cảnh Báo</th>
                    <th className="px-5 py-3 text-center">Trạng Thái</th>
                    <th className="px-5 py-3 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {filteredMain.map((item: any) => {
                    const stock = Number(item.stock);
                    const min = Number(item.minStock);
                    const isLow = stock <= min;
                    const isWarn = stock <= min * 2 && stock > min;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-5 py-3.5 font-semibold text-white">{item.name}</td>
                        <td className="px-5 py-3.5 text-zinc-400">{item.unit}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-200">{fmt(stock)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-zinc-500">{fmt(min)}</td>
                        <td className="px-5 py-3.5 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-bold">
                              <AlertTriangle className="h-3 w-3" />Cần nhập hàng
                            </span>
                          ) : isWarn ? (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 font-bold">Tồn kho thấp</span>
                          ) : (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-bold">Bình thường</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setTransferTarget(item)} className="px-2.5 py-1 rounded bg-violet-500/15 border border-violet-500/20 text-violet-400 hover:bg-violet-500/25 text-xs font-semibold transition-all flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />Xuất sang CN
                            </button>
                            <button onClick={() => setStockTarget(item)} className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold transition-all">
                              Nhập/Xuất kho
                            </button>
                            <button onClick={() => setEditTarget(item)} className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(item.id, item.name)} className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/25 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filteredMain.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-600">Không có nguyên liệu nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: KHO CHI NHÁNH ─────────────────────────────────── */}
        {activeTab === "branch" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4">
            {loading ? (
              <ContentLoader label="Đang tải kho chi nhánh..." />
            ) : (
              <>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Kho Chi Nhánh</h2>
                <p className="text-sm text-zinc-400 mt-0.5">Tồn kho thực tế tại chi nhánh. Tự động giảm khi có order.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input type="text" placeholder="Tìm nguyên liệu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 w-48"
                  />
                </div>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0">
                  <Plus className="h-3.5 w-3.5" /><span>Thêm</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Tên Nguyên Liệu</th>
                    <th className="px-5 py-3">Đơn Vị</th>
                    <th className="px-5 py-3 text-right">Kho Chi Nhánh</th>
                    <th className="px-5 py-3 text-right">Ngưỡng cảnh báo</th>
                    <th className="px-5 py-3 text-center">Trạng Thái</th>
                    <th className="px-5 py-3 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {filteredBranch.map((item: any) => {
                    const bStock = Number(item.branchStock);
                    const mStock = Number(item.mainStock);
                    const min = Number(item.minStock);
                    const isLow = bStock <= min;
                    const isWarn = bStock <= min * 2 && bStock > min;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="px-5 py-3.5 font-semibold text-white">{item.name}</td>
                            <td className="px-5 py-3.5 text-zinc-400">{item.unit}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">{fmt(bStock)}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-zinc-600">{fmt(min)}</td>
                            <td className="px-5 py-3.5 text-center">
                              {!item.hasBranchRecord ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/50 text-xs text-zinc-500 font-bold">Chưa nhận hàng</span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-bold">
                                  <AlertTriangle className="h-3 w-3" />Cần nhập
                                </span>
                              ) : isWarn ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 font-bold">Tồn kho thấp</span>
                              ) : (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-bold">Bình thường</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setStockTarget(item)} className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold transition-all">
                                  Nhập/Xuất kho
                                </button>
                                <button onClick={() => setEditTarget(item)} className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDelete(item.id, item.name)} className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/25 transition-all">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && filteredBranch.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-600">
                          Chưa có dữ liệu kho chi nhánh.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: ĐÃ XUẤT ───────────────────────────────────────── */}
        {activeTab === "exported" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4">
            {loading ? (
              <ContentLoader label="Đang tải dữ liệu xuất kho..." />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-base font-bold text-white">Tồn kho Bếp (Đã Xuất)</h2>
                    <p className="text-sm text-zinc-400 mt-0.5">Quản lý lượng nguyên liệu đang sử dụng tại bếp. Gọi món sẽ trừ trực tiếp vào kho này.</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input type="text" placeholder="Tìm nguyên liệu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 w-48"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                        <th className="px-5 py-3">Tên Nguyên Liệu</th>
                        <th className="px-5 py-3">Đơn Vị</th>
                        <th className="px-5 py-3 text-right">Tồn Kho Bếp (Đã xuất)</th>
                        <th className="px-5 py-3 text-right">Kho Lưu Trữ (Chi nhánh)</th>
                        <th className="px-5 py-3 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-xs">
                      {filteredExported.map((item: any) => {
                        const inUse = Number(item.totalExported);
                        const isNegative = inUse < 0;
                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="px-5 py-3.5 font-semibold text-white">{item.name}</td>
                            <td className="px-5 py-3.5 text-zinc-400">{item.unit}</td>
                            <td className={`px-5 py-3.5 text-right font-mono font-bold ${isNegative ? 'text-rose-400' : 'text-amber-400'}`}>
                              {fmt(inUse)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-zinc-400">
                              {item.currentBranchStock !== null ? fmt(Number(item.currentBranchStock)) : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {isNegative ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-bold">
                                  <AlertTriangle className="h-3 w-3" />Thiếu hụt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 font-bold">
                                  <PackageOpen className="h-3 w-3" />Đang dùng
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && filteredExported.length === 0 && (
                        <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-600">Chưa có nguyên liệu nào được xuất.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: LỊCH SỬ ───────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4">
            {loading ? (
              <ContentLoader label="Đang tải nhật ký..." />
            ) : (
              <>
            <div>
              <h2 className="text-base font-bold text-white">Lịch sử nhập/xuất kho</h2>
              <p className="text-sm text-zinc-400 mt-0.5">Toàn bộ nhật ký biến động nguyên liệu.</p>
            </div>
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Thời gian</th>
                    <th className="px-5 py-3">Nguyên liệu</th>
                    <th className="px-5 py-3 text-right">Biến động</th>
                    <th className="px-5 py-3">Lý do</th>
                    <th className="px-5 py-3">Thực hiện bởi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-sm">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 text-zinc-400 text-xs">{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="px-5 py-3.5 font-semibold text-white text-xs">
                        {log.ingredient?.name} <span className="text-zinc-500">({log.ingredient?.unit})</span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-mono font-bold text-xs ${Number(log.delta) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {Number(log.delta) > 0 ? "+" : ""}{fmt(Number(log.delta))}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs bg-zinc-800 text-zinc-300 font-mono">{log.reason}</span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 font-mono text-xs">{log.createdBy || "—"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-500">Chưa có lịch sử.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {logsTotal > 20 && (
              <div className="flex gap-2 justify-end items-center">
                <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-800 rounded bg-zinc-900/50 hover:bg-zinc-800 disabled:opacity-40 transition-all">
                  ← Trước
                </button>
                <span className="px-3 py-1 text-xs text-zinc-500">Trang {logsPage} / {Math.ceil(logsTotal / 20)}</span>
                <button disabled={logsPage * 20 >= logsTotal} onClick={() => setLogsPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-800 rounded bg-zinc-900/50 hover:bg-zinc-800 disabled:opacity-40 transition-all">
                  Sau →
                </button>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {(showAddModal || editTarget) && (
        <IngredientModal
          ingredient={editTarget}
          targetWarehouse={activeTab === 'branch' ? 'branch' : 'main'}
          onClose={() => { setShowAddModal(false); setEditTarget(null); }}
          onSaved={() => { 
            setShowAddModal(false); 
            setEditTarget(null); 
            if (activeTab === 'branch') {
              loadBranchStock();
            } else {
              loadMainStock();
            }
          }}
        />
      )}
      {stockTarget && (
        <StockAdjustModal
          ingredient={stockTarget}
          targetWarehouse={activeTab === 'branch' ? 'branch' : 'main'}
          onClose={() => setStockTarget(null)}
          onSaved={() => { 
            setStockTarget(null); 
            if (activeTab === 'branch') {
              loadBranchStock();
            } else {
              loadMainStock();
            }
          }}
        />
      )}
      {transferTarget && (
        <TransferModal
          ingredient={transferTarget}
          branches={branches}
          onClose={() => setTransferTarget(null)}
          onSaved={() => { setTransferTarget(null); loadMainStock(); loadBranchStock(); }}
        />
      )}
    </div>
  );
}
