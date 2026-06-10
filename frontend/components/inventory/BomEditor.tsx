'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  menuItemId: string;
  menuItemName: string;
  onClose?: () => void;
}

export default function BomEditor({ menuItemId, menuItemName, onClose }: Props) {
  const [bom, setBom] = useState<any[]>([]);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [addForm, setAddForm] = useState({ ingredientId: '', quantity: '' });
  const [saving, setSaving] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────

  const fetchBom = useCallback(async () => {
    const res = await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setBom(data.data);
  }, [menuItemId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchBom();
      const res2 = await fetch(`${API}/api/ingredients`, { credentials: 'include' });
      const d2 = await res2.json();
      if (res2.ok) setAllIngredients(d2.data);
      setLoading(false);
    };
    init();
  }, [fetchBom]);

  // ── Inline edit ─────────────────────────────────────────────

  const startEdit = (entry: any) => {
    setEditingId(entry.ingredientId);
    setEditQty(String(Number(entry.quantity)));
  };

  const saveEdit = async (ingredientId: string) => {
    setSaving(true);
    await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom/${ingredientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: Number(editQty) }),
      credentials: 'include',
    });
    setEditingId(null);
    await fetchBom();
    setSaving(false);
  };

  const deleteEntry = async (ingredientId: string) => {
    if (!confirm('Xóa nguyên liệu này khỏi công thức?')) return;
    await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom/${ingredientId}`, {
      method: 'DELETE', credentials: 'include',
    });
    await fetchBom();
  };

  // ── Add ─────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.ingredientId || !addForm.quantity) return;
    setSaving(true);
    const res = await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId: addForm.ingredientId, quantity: Number(addForm.quantity) }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) alert(data.message);
    else setAddForm({ ingredientId: '', quantity: '' });
    await fetchBom();
    setSaving(false);
  };

  // ── Realtime preview ─────────────────────────────────────────

  const preview = bom
    .map(e => `${new Intl.NumberFormat('vi-VN').format(Number(e.quantity))}${e.ingredient.unit} ${e.ingredient.name}`)
    .join(', ');

  // ── Available ingredients to add (not yet in BOM) ─────────────

  const usedIds = new Set(bom.map(e => e.ingredientId));
  const available = allIngredients.filter(i => !usedIds.has(i.id));

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Công thức: <span className="text-blue-600">{menuItemName}</span></h2>
          <p className="text-xs text-gray-500 mt-0.5">BOM — Bill of Materials</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        )}
      </div>

      {/* Realtime preview */}
      {bom.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
          <span className="font-semibold">1 suất {menuItemName} cần: </span>
          {preview}
        </div>
      )}

      {/* BOM table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Đang tải công thức...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nguyên liệu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Số lượng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Đơn vị</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {bom.map(entry => (
                <tr key={entry.ingredientId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.ingredient.name}</td>
                  <td className="px-4 py-3">
                    {editingId === entry.ingredientId ? (
                      <input
                        type="number" step="0.01" min="0.01"
                        value={editQty}
                        autoFocus
                        onChange={e => setEditQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(entry.ingredientId); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-24 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span
                        className="font-mono cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={() => startEdit(entry)}
                        title="Click để sửa"
                      >
                        {new Intl.NumberFormat('vi-VN').format(Number(entry.quantity))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.ingredient.unit}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === entry.ingredientId ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => saveEdit(entry.ingredientId)} disabled={saving}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                          ✓ Lưu
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => deleteEntry(entry.ingredientId)}
                        className="text-xs px-2 py-1 text-red-600 hover:text-red-800 hover:underline"
                      >
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bom.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                    Chưa có nguyên liệu nào trong công thức.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add row */}
      {available.length > 0 && (
        <form onSubmit={handleAdd} className="flex gap-3 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Chọn nguyên liệu</label>
            <select
              required
              value={addForm.ingredientId}
              onChange={e => setAddForm(f => ({ ...f, ingredientId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn nguyên liệu --</option>
              {available.map((i: any) => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">Số lượng</label>
            <input
              required type="number" step="0.01" min="0.01"
              value={addForm.quantity}
              onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: 150"
            />
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 h-[42px]">
            + Thêm
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400 italic">
        💡 Click vào số lượng trong bảng để sửa nhanh, nhấn Enter để lưu.
      </p>
    </div>
  );
}
