"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Calendar, 
  RefreshCw, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  AlertTriangle,
  FileDown
} from "lucide-react";
import AdminTabs from "@/components/admin/AdminTabs";
import IngredientModal from "@/components/inventory/IngredientModal";
import StockAdjustModal from "@/components/inventory/StockAdjustModal";
import { fetchIngredients, deleteIngredient } from "@/lib/api/admin";

export default function AdminInventoryPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [stockTarget, setStockTarget] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIngredients(lowStockFilter);
      setIngredients(data?.data ?? []);
    } catch (err) {
      console.error("Lỗi fetch ingredients:", err);
    } finally {
      setLoading(false);
    }
  }, [lowStockFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn chắc chắn muốn xóa nguyên liệu "${name}"?`)) return;
    try {
      const res = await deleteIngredient(id);
      if (res.message && res.message.includes("BOM")) {
        alert("Không thể xóa nguyên liệu này vì đang liên kết với công thức món ăn (BOM)!");
      } else {
        loadData();
      }
    } catch (err) {
      alert("Đã xảy ra lỗi khi xóa!");
    }
  };

  const filteredIngredients = ingredients.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.unit.toLowerCase().includes(searchQuery.toLowerCase())
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
              <span className="font-bold tracking-tight text-lg text-white">Quản Lý Nguyên Liệu</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Kho hàng</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Hôm nay, 19 Tháng 5</span>
            </div>
            <button onClick={loadData} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
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

        {/* Action Bar */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Danh Sách Nguyên Liệu</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Quản lý định lượng, tồn kho thực tế, nhập kho và ngưỡng cảnh báo.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Tìm nguyên liệu..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>

              {/* Low Stock Filter Toggle */}
              <div className="flex gap-1.5 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setLowStockFilter(false)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    !lowStockFilter 
                      ? "bg-violet-600 text-white" 
                      : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setLowStockFilter(true)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    lowStockFilter 
                      ? "bg-amber-600 text-white" 
                      : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  Sắp hết hàng
                </button>
              </div>

              {/* Add New Button */}
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm Nguyên Liệu</span>
              </button>
            </div>
          </div>

          {/* High-Fidelity Data Table */}
          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3">Tên Nguyên Liệu</th>
                  <th className="px-5 py-3">Đơn Vị Tính</th>
                  <th className="px-5 py-3 text-right">Tồn Kho</th>
                  <th className="px-5 py-3 text-right">Ngưỡng Cảnh Báo</th>
                  <th className="px-5 py-3 text-center">Trạng Thái</th>
                  <th className="px-5 py-3 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-light">
                      Đang tải danh sách nguyên liệu...
                    </td>
                  </tr>
                ) : filteredIngredients.map(item => {
                  const stockNum = Number(item.stock);
                  const minStockNum = Number(item.minStock);
                  const isLow = stockNum <= minStockNum;
                  const isWarning = stockNum <= minStockNum * 2 && stockNum > minStockNum;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-3.5 font-semibold text-white">{item.name}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{item.unit}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-200">
                        {new Intl.NumberFormat("vi-VN").format(stockNum)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-zinc-500">
                        {new Intl.NumberFormat("vi-VN").format(minStockNum)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-[10px] text-rose-400 font-bold">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Cần nhập hàng</span>
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400 font-bold">
                            <span>Tồn kho thấp</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400 font-bold">
                            <span>Bình thường</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setStockTarget(item)}
                            className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 text-[10px] font-semibold transition-all"
                          >
                            Nhập kho
                          </button>
                          <button 
                            onClick={() => setEditTarget(item)}
                            className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                            title="Sửa nguyên liệu"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/25 transition-all"
                            title="Xóa nguyên liệu"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredIngredients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-600 font-light">
                      Không tìm thấy nguyên liệu nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      {(showAddModal || editTarget) && (
        <IngredientModal
          ingredient={editTarget}
          onClose={() => { setShowAddModal(false); setEditTarget(null); }}
          onSaved={() => { setShowAddModal(false); setEditTarget(null); loadData(); }}
        />
      )}
      {stockTarget && (
        <StockAdjustModal
          ingredient={stockTarget}
          onClose={() => setStockTarget(null)}
          onSaved={() => { setStockTarget(null); loadData(); }}
        />
      )}
    </div>
  );
}
