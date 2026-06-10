'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

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
    const token = getAccessTokenFromCookie();
    const res = await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom`, {
      headers: {
        'Authorization': `Bearer ${token || ''}`
      },
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) setBom(data.data);
  }, [menuItemId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchBom();
      const token = getAccessTokenFromCookie();
      const res2 = await fetch(`${API}/api/ingredients`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        },
        credentials: 'include'
      });
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
    const token = getAccessTokenFromCookie();
    await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom/${ingredientId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify({ quantity: Number(editQty) }),
      credentials: 'include',
    });
    setEditingId(null);
    await fetchBom();
    setSaving(false);
  };

  const deleteEntry = async (ingredientId: string) => {
    if (!confirm('Xóa nguyên liệu này khỏi công thức?')) return;
    const token = getAccessTokenFromCookie();
    await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom/${ingredientId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token || ''}`
      },
      credentials: 'include',
    });
    await fetchBom();
  };

  // ── Add ─────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.ingredientId || !addForm.quantity) return;
    setSaving(true);
    const token = getAccessTokenFromCookie();
    const res = await fetch(`${API}/api/ingredients/menu-items/${menuItemId}/bom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
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
    <div className="space-y-6 text-zinc-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">
            Công thức: <span className="text-violet-400">{menuItemName}</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-semibold">BOM — Bill of Materials</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-2xl transition-colors font-light">×</button>
        )}
      </div>

      {/* Realtime preview */}
      {bom.length > 0 && (
        <div className="bg-violet-950/20 border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-violet-300 font-semibold leading-relaxed">
          <span className="font-bold text-violet-200">1 suất {menuItemName} cần: </span>
          {preview}
        </div>
      )}

      {/* BOM table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 font-semibold">Đang tải công thức...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-md shadow-xl">
          <table className="min-w-full divide-y divide-zinc-900 text-xs">
            <thead className="bg-zinc-950">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nguyên liệu</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Số lượng</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Đơn vị</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-zinc-900/20 divide-y divide-zinc-900/60">
              {bom.map(entry => (
                <tr key={entry.ingredientId} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-zinc-100">{entry.ingredient.name}</td>
                  <td className="px-4 py-3">
                    {editingId === entry.ingredientId ? (
                      <input
                        type="number" step="0.01" min="0.01"
                        value={editQty}
                        autoFocus
                        onChange={e => setEditQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(entry.ingredientId); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-24 border border-violet-500/40 rounded px-2.5 py-1 text-xs bg-zinc-950 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold"
                      />
                    ) : (
                      <span
                        className="font-mono font-bold text-zinc-100 cursor-pointer hover:text-violet-400 hover:underline transition-colors"
                        onClick={() => startEdit(entry)}
                        title="Click để sửa"
                      >
                        {new Intl.NumberFormat('vi-VN').format(Number(entry.quantity))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 font-semibold">{entry.ingredient.unit}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === entry.ingredientId ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => saveEdit(entry.ingredientId)} disabled={saving}
                          className="text-[10px] px-2.5 py-1 bg-violet-650 text-white rounded-md hover:bg-violet-600 font-black transition-all shadow-md shadow-violet-500/10">
                          ✓ Lưu
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-[10px] px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-md hover:text-zinc-200 hover:bg-zinc-900 font-semibold transition-all">
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => deleteEntry(entry.ingredientId)}
                        className="text-[10px] px-2 py-1 text-red-400 hover:text-red-300 font-bold hover:underline transition-colors"
                      >
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bom.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-zinc-500 italic font-semibold">
                    Chưa có nguyên liệu nào trong công thức.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add row */}
      {allIngredients.length === 0 ? (
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300">
          <p className="font-bold text-sm mb-1">⚠️ Chưa có nguyên liệu nào trong kho!</p>
          <p className="leading-relaxed font-semibold">
            Bạn cần tạo các nguyên liệu trước khi cấu hình công thức cho món ăn. Hãy bấm vào mục 
            <strong className="text-white"> "Nguyên liệu" </strong> (biểu tượng Cơ sở dữ liệu 🗄️) ở thanh menu bên trái để tạo nguyên liệu mới.
          </p>
        </div>
      ) : available.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 text-xs text-zinc-500 text-center italic font-semibold">
          Tất cả các nguyên liệu hiện có đã được thêm vào công thức này.
        </div>
      ) : (
        <form onSubmit={handleAdd} className="flex gap-3 items-end bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 backdrop-blur-md shadow-inner">
          <div className="flex-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Chọn nguyên liệu</label>
            <select
              required
              value={addForm.ingredientId}
              onChange={e => setAddForm(f => ({ ...f, ingredientId: e.target.value }))}
              className="w-full border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs bg-zinc-950 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all font-semibold appearance-none cursor-pointer"
            >
              <option value="" className="text-zinc-500 bg-zinc-950">-- Chọn nguyên liệu --</option>
              {available.map((i: any) => (
                <option key={i.id} value={i.id} className="bg-zinc-950 text-zinc-100 font-semibold">{i.name} ({i.unit})</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Số lượng</label>
            <input
              required type="number" step="0.01" min="0.01"
              value={addForm.quantity}
              onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs bg-zinc-950 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all font-semibold placeholder-zinc-600"
              placeholder="VD: 150"
            />
          </div>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-violet-500/15 disabled:opacity-60 h-[42px] cursor-pointer active:scale-98">
            + Thêm
          </button>
        </form>
      )}

      <p className="text-[10px] text-zinc-500 italic font-semibold">
        💡 Gợi ý: Click trực tiếp vào số lượng trong bảng để sửa nhanh, nhấn Enter để lưu lại.
      </p>
    </div>
  );
}
