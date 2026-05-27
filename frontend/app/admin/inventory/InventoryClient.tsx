'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import IngredientModal from '@/components/inventory/IngredientModal';
import StockAdjustModal from '@/components/inventory/StockAdjustModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const fmt = (n: number, unit: string) =>
  `${new Intl.NumberFormat('vi-VN').format(n)} ${unit}`;

// ── Low-stock severity helper ─────────────────────────────────────────────────

type StockLevel = 'critical' | 'warning' | 'ok';

function getStockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= minStock)       return 'critical';
  if (stock <= minStock * 2)   return 'warning';
  return 'ok';
}

// ── Red dot — dùng trên tab title khi có nguyên liệu ở mức critical ──────────

function RedDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full
                 bg-red-500 text-white text-[10px] font-bold leading-none
                 animate-pulse"
      title={`${count} nguyên liệu cần nhập kho ngay`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

// ── Stock badge trong bảng ────────────────────────────────────────────────────

function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const level = getStockLevel(stock, minStock);

  if (level === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       text-xs font-bold bg-red-100 text-red-800 ring-1 ring-red-300">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        ⚠️ Cảnh báo
      </span>
    );
  }
  if (level === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       text-xs font-bold bg-yellow-100 text-yellow-800">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        Sắp hết
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                     text-xs font-bold bg-green-100 text-green-800">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Đủ hàng
    </span>
  );
}

// ── Low-stock banner alert ────────────────────────────────────────────────────

function LowStockBanner({ items }: { items: any[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (items.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex gap-4 items-start">
      {/* Icon */}
      <div className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">
        🚨
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-red-800 text-sm">
          {items.length} nguyên liệu đang ở mức cảnh báo tồn kho
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map(ing => (
            <span
              key={ing.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                         bg-red-100 text-red-700 text-xs font-semibold ring-1 ring-red-200"
            >
              {ing.name}
              <span className="text-red-400 font-normal">
                ({new Intl.NumberFormat('vi-VN').format(Number(ing.stock))}/{new Intl.NumberFormat('vi-VN').format(Number(ing.minStock))} {ing.unit})
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-red-600">
          Hệ thống đã gửi email cảnh báo đến Admin. Vui lòng nhập kho ngay để tránh gián đoạn hoạt động.
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-red-400 hover:text-red-600 transition-colors text-xl leading-none"
        aria-label="Đóng cảnh báo"
      >
        ×
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InventoryClient() {
  const [activeTab, setActiveTab]       = useState<'list' | 'logs'>('list');
  const [ingredients, setIngredients]   = useState<any[]>([]);
  const [logs, setLogs]                 = useState<any[]>([]);
  const [logsTotal, setLogsTotal]       = useState(0);
  const [logsPage, setLogsPage]         = useState(1);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [editTarget, setEditTarget]     = useState<any | null>(null);
  const [stockTarget, setStockTarget]   = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Derived: danh sách nguyên liệu critical (stock <= minStock) ───────────

  const criticalItems = useMemo(
    () => ingredients.filter(i => getStockLevel(Number(i.stock), Number(i.minStock)) === 'critical'),
    [ingredients]
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(
        `${API}/api/ingredients${lowStockOnly ? '?lowStock=true' : ''}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (res.ok) setIngredients(data.data);
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly]);

  const fetchLogs = useCallback(async () => {
    const res  = await fetch(
      `${API}/api/inventory/logs?page=${logsPage}&limit=20`,
      { credentials: 'include' }
    );
    const data = await res.json();
    if (res.ok) {
      setLogs(data.data.logs);
      setLogsTotal(data.data.total);
    }
  }, [logsPage]);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);
  useEffect(() => { if (activeTab === 'logs') fetchLogs(); }, [activeTab, fetchLogs]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa nguyên liệu "${name}"?`)) return;
    const res  = await fetch(`${API}/api/ingredients/${id}`, {
      method: 'DELETE', credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) fetchIngredients();
    else        alert(data.message);
  };

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modals */}
      {(showAddModal || editTarget) && (
        <IngredientModal
          ingredient={editTarget}
          onClose={() => { setShowAddModal(false); setEditTarget(null); }}
          onSaved={() => { setShowAddModal(false); setEditTarget(null); fetchIngredients(); }}
        />
      )}
      {stockTarget && (
        <StockAdjustModal
          ingredient={stockTarget}
          onClose={() => setStockTarget(null)}
          onSaved={() => { setStockTarget(null); fetchIngredients(); }}
        />
      )}

      {/* ── Low-stock banner (hiển thị khi có nguyên liệu critical) ── */}
      <div className="mb-4">
        <LowStockBanner items={criticalItems} />
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">

          {/* Tab: Danh sách */}
          <button
            onClick={() => setActiveTab('list')}
            className={`relative flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Danh sách nguyên liệu
            {/* Red dot badge trên tab nếu có nguyên liệu critical */}
            <RedDot count={criticalItems.length} />
          </button>

          {/* Tab: Lịch sử */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Lịch sử nhập/xuất kho
          </button>
        </div>

        <div className="p-6">
          {/* ── TAB 1: LIST ─────────────────────────────────── */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Tìm nguyên liệu..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lowStockOnly}
                      onChange={e => setLowStockOnly(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    Chỉ xem sắp hết
                    {criticalItems.length > 0 && (
                      <span className="text-red-500 font-semibold">({criticalItems.length})</span>
                    )}
                  </label>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                             px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  + Thêm nguyên liệu
                </button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="py-12 text-center text-gray-400">Đang tải...</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Tên nguyên liệu','Đơn vị','Tồn kho','Ngưỡng cảnh báo','Trạng thái','Dùng trong','Thao tác'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filtered.map((ing: any) => {
                        const level = getStockLevel(Number(ing.stock), Number(ing.minStock));
                        return (
                          <tr
                            key={ing.id}
                            className={`transition-colors ${
                              level === 'critical'
                                ? 'bg-red-50 hover:bg-red-100'
                                : level === 'warning'
                                  ? 'bg-yellow-50 hover:bg-yellow-100'
                                  : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                {/* Red dot trên tên nguyên liệu nếu critical */}
                                {level === 'critical' && (
                                  <span
                                    className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse"
                                    title="Tồn kho ở mức cảnh báo"
                                  />
                                )}
                                {ing.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{ing.unit}</td>
                            <td className={`px-4 py-3 font-mono font-semibold ${
                              level === 'critical' ? 'text-red-700' :
                              level === 'warning'  ? 'text-yellow-700' : 'text-gray-700'
                            }`}>
                              {fmt(Number(ing.stock), ing.unit)}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-500">
                              {fmt(Number(ing.minStock), ing.unit)}
                            </td>
                            <td className="px-4 py-3">
                              <StockBadge stock={Number(ing.stock)} minStock={Number(ing.minStock)} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="inline-flex items-center justify-center w-7 h-7
                                           rounded-full bg-blue-50 text-blue-700 text-xs font-bold"
                                title={`Dùng trong ${ing._count.bom} món`}
                              >
                                {ing._count.bom}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditTarget(ing)}
                                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200
                                             text-gray-700 font-medium transition-colors"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => setStockTarget(ing)}
                                  className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                    level === 'critical'
                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                      : 'bg-green-50 hover:bg-green-100 text-green-700'
                                  }`}
                                >
                                  {level === 'critical' ? '⚡ Nhập kho' : 'Nhập kho'}
                                </button>
                                <button
                                  onClick={() => handleDelete(ing.id, ing.name)}
                                  className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100
                                             text-red-700 font-medium transition-colors"
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                            Không có nguyên liệu nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: LOGS ─────────────────────────────────── */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-700">Lịch sử xuất / nhập kho</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Thời gian','Nguyên liệu','Biến động','Lý do','Thực hiện bởi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {log.ingredient?.name}{' '}
                          <span className="text-gray-400 text-xs">({log.ingredient?.unit})</span>
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${
                          Number(log.delta) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Number(log.delta) > 0 ? '+' : ''}
                          {new Intl.NumberFormat('vi-VN').format(Number(log.delta))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono ${
                            log.reason?.startsWith('WASTE')
                              ? 'bg-orange-100 text-orange-700'
                              : log.reason?.startsWith('ORDER_DEDUCT')
                                ? 'bg-blue-100 text-blue-700'
                                : log.reason?.startsWith('VOID')
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}>
                            {log.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {log.createdBy || '—'}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                          Chưa có lịch sử.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {logsTotal > 20 && (
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={logsPage <= 1}
                    onClick={() => setLogsPage(p => p - 1)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                  >← Trước</button>
                  <span className="px-3 py-1 text-sm text-gray-600">Trang {logsPage}</span>
                  <button
                    disabled={logsPage * 20 >= logsTotal}
                    onClick={() => setLogsPage(p => p + 1)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                  >Sau →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
