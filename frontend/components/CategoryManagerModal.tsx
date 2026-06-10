"use client";

import React, { useState, useEffect } from "react";
import { getAccessTokenFromCookie } from "@/lib/auth/client";
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Loader2,
  AlertTriangle,
  FolderOpen
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count?: {
    menuItems: number;
  };
}

interface CategoryManagerModalProps {
  onClose: () => void;
  onCategoryChanged: () => void;
}

export default function CategoryManagerModal({ onClose, onCategoryChanged }: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", sortOrder: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete states
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        headers: { "Authorization": `Bearer ${accessToken || ""}` }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setCategories(result.data || []);
      } else {
        throw new Error(result.message || "Không thể tải danh sách danh mục");
      }
    } catch (err: any) {
      console.error("[Category Manager] Lỗi tải dữ liệu:", err);
      setError(err.message || "Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openForm = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, sortOrder: category.sortOrder });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", sortOrder: categories.length + 1 });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", sortOrder: 0 });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const accessToken = getAccessTokenFromCookie();
      const url = editingCategory 
        ? `${API_URL}/api/admin/categories/${editingCategory.id}`
        : `${API_URL}/api/admin/categories`;
      
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Authorization": `Bearer ${accessToken || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Lưu danh mục thất bại");
      }

      await fetchCategories();
      onCategoryChanged(); // Báo cho trang cha cập nhật dropdown
      closeForm();
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra khi lưu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/admin/categories/${deleteConfirmItem.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${accessToken || ""}` }
      });
      
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Xóa danh mục thất bại");
      }

      await fetchCategories();
      onCategoryChanged();
      setDeleteConfirmItem(null);
    } catch (err: any) {
      setDeleteError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl max-w-2xl w-full rounded-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400">
              <FolderOpen size={18} />
            </div>
            <h3 className="text-lg font-black text-zinc-50">Quản lý Danh mục</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          
          {/* Thông báo lỗi xoá */}
          {deleteError && (
            <div className="mb-4 flex items-start gap-3 p-3.5 bg-red-950/20 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1 leading-relaxed">{deleteError}</span>
              <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-white transition-colors shrink-0"><X size={16}/></button>
            </div>
          )}

          {/* Form Thêm/Sửa */}
          {isFormOpen ? (
            <form onSubmit={handleFormSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
              <h4 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
                {editingCategory ? <Edit3 size={16} className="text-violet-400"/> : <Plus size={16} className="text-violet-400"/>}
                {editingCategory ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Tên danh mục <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="VD: Món khai vị, Đồ uống..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Thứ tự hiển thị</label>
                  <input 
                    type="number" 
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 rounded-lg text-xs font-bold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingCategory ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-zinc-400">Có tổng cộng {categories.length} danh mục</p>
              <button
                onClick={() => openForm()}
                className="flex items-center gap-2 bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20 hover:border-violet-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                <Plus size={14} /> Thêm danh mục
              </button>
            </div>
          )}

          {/* Danh sách categories */}
          {loading ? (
            <div className="py-12 flex justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-950/50">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-900">
                    <th className="p-3 text-xs font-black text-zinc-400 w-16 text-center">STT</th>
                    <th className="p-3 text-xs font-black text-zinc-400">Tên danh mục</th>
                    <th className="p-3 text-xs font-black text-zinc-400">Slug</th>
                    <th className="p-3 text-xs font-black text-zinc-400 text-center">Số món</th>
                    <th className="p-3 text-xs font-black text-zinc-400 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {categories.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-zinc-500 text-xs">Chưa có danh mục nào</td></tr>
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="p-3 text-center text-zinc-500 font-medium">{cat.sortOrder}</td>
                        <td className="p-3 font-bold text-zinc-200">{cat.name}</td>
                        <td className="p-3 text-zinc-500 text-xs font-mono">{cat.slug}</td>
                        <td className="p-3 text-center">
                          <span className="bg-zinc-900 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-zinc-800">
                            {cat._count?.menuItems || 0} món
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openForm(cat)}
                              className="p-1.5 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmItem(cat)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* Modal xác nhận xóa */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-zinc-950 border border-zinc-800 shadow-2xl max-w-sm w-full p-6 text-center rounded-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 bg-red-950/20 border border-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle size={24} className="stroke-[2.5]" />
            </div>
            
            <h3 className="text-base font-black text-zinc-100">Xóa danh mục?</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Xóa danh mục <strong className="text-zinc-200">"{deleteConfirmItem.name}"</strong>? 
              Bạn chỉ có thể xóa nếu danh mục này không chứa món ăn nào.
            </p>

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-bold hover:bg-zinc-900"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-500 flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 size={12} className="animate-spin" /> : "Xóa danh mục"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
