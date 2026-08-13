"use client";

import React, { useState, useEffect } from "react";
import { FolderOpen, Plus, Edit3, Trash2, X, AlertTriangle, Loader2, Sparkles, FolderPlus } from "lucide-react";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  _count?: {
    menuItems: number;
  };
}

interface CategoryManagerModalProps {
  onClose: () => void;
  onCategoryChanged?: () => void;
}

export default function CategoryManagerModal({ onClose, onCategoryChanged }: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", sortOrder: 0 });
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        headers: {
          "Authorization": `Bearer ${accessToken || ""}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.data);
      } else {
        setError(data.message || "Không thể tải danh sách danh mục");
      }
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, sortOrder: category.sortOrder });
    setError(null);
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    const maxSort = categories.reduce((max, c) => c.sortOrder > max ? c.sortOrder : max, 0);
    setFormData({ name: "", sortOrder: maxSort + 10 });
    setError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const accessToken = getAccessTokenFromCookie();
      const url = editingCategory
        ? `${API_URL}/api/admin/categories/${editingCategory.id}`
        : `${API_URL}/api/admin/categories`;

      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken || ""}`
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEditingCategory(null);
        setFormData({ name: "", sortOrder: 0 });
        await fetchCategories();
        if (onCategoryChanged) onCategoryChanged();
      } else {
        setError(data.message || "Thao tác thất bại");
      }
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      const accessToken = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/admin/categories/${deletingId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken || ""}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeletingId(null);
        await fetchCategories();
        if (onCategoryChanged) onCategoryChanged();
      } else {
        setDeleteError(data.message || "Không thể xóa danh mục này");
      }
    } catch (err: any) {
      setDeleteError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-zinc-950 border border-zinc-800/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden text-zinc-100 relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <FolderOpen size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-50">Quản lý Danh Mục Thực Đơn</h3>
              <p className="text-xs text-zinc-400">Tạo, sắp xếp thứ tự và quản lý phân loại món ăn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/80 transition-all active:scale-95 cursor-pointer"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2-Column Body Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
          {/* LEFT COLUMN: Category List */}
          <div className="flex-1 flex flex-col p-6 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h4 className="text-sm font-extrabold text-zinc-200 flex items-center gap-2">
                <span>Danh sách danh mục</span>
                <span className="text-xs font-bold bg-violet-500/20 text-violet-300 px-2.5 py-0.5 rounded-full border border-violet-500/30">
                  {categories.length}
                </span>
              </h4>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-600/20 cursor-pointer active:scale-95"
              >
                <Plus size={14} /> Thêm Danh Mục Mới
              </button>
            </div>

            {deleteError && (
              <div className="mb-4 flex items-center justify-between p-3 bg-red-950/30 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold shrink-0">
                <span className="flex items-center gap-2">
                  <AlertTriangle size={15} /> {deleteError}
                </span>
                <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-white"><X size={15}/></button>
              </div>
            )}

            {/* Scrollable Category Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-zinc-500 gap-2">
                  <Loader2 size={18} className="animate-spin text-violet-400" /> Đang tải danh mục...
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-semibold border-2 border-dashed border-zinc-800 rounded-3xl">
                  Chưa có danh mục nào. Hãy thêm danh mục đầu tiên!
                </div>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      editingCategory?.id === cat.id
                        ? "bg-violet-950/30 border-violet-500/50 shadow-md shadow-violet-500/10 ring-1 ring-violet-500/30"
                        : "bg-zinc-950 border-zinc-800/90 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-black text-xs flex items-center justify-center shrink-0">
                        #{cat.sortOrder}
                      </div>
                      <div>
                        <h5 className="font-extrabold text-zinc-100 text-sm">{cat.name}</h5>
                        <p className="text-xs text-zinc-400 font-semibold">
                          {cat._count?.menuItems ?? 0} món ăn thuộc danh mục
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        className="p-2 text-zinc-400 hover:text-violet-400 hover:bg-zinc-900 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                        title="Sửa"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(cat.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Form Add / Edit */}
          <div className="w-full lg:w-[420px] p-6 flex flex-col justify-between bg-zinc-950 overflow-y-auto">
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <h4 className="text-sm font-black text-zinc-100 pb-3 border-b border-zinc-800 flex items-center gap-2">
                <FolderPlus size={16} className="text-violet-400" />
                <span>{editingCategory ? "Chỉnh Sửa Danh Mục" : "Thêm Danh Mục Mới"}</span>
              </h4>

              {error && (
                <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold">
                  ⚠️ {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Tên danh mục <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Đồ uống nóng, Món khai vị..."
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Thứ tự hiển thị (Sort Order)
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">Số nhỏ hơn sẽ hiển thị trước trên thực đơn.</p>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-2xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 disabled:opacity-50 shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Đang lưu...
                    </>
                  ) : editingCategory ? (
                    "Lưu Cập Nhật"
                  ) : (
                    "Tạo Danh Mục Mới"
                  )}
                </button>
              </div>
            </form>

            <div className="pt-6 border-t border-zinc-900 text-center">
              <p className="text-xs text-zinc-400 font-semibold">Tự động đồng bộ với thực đơn POS & Quét mã QR</p>
            </div>
          </div>

        </div>

        {/* Confirmation Modal Delete */}
        {deletingId && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 shadow-2xl max-w-sm w-full p-6 text-center rounded-3xl space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-950/30 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-base font-black text-zinc-100">Xác nhận xóa danh mục</h4>
                <p className="text-xs text-zinc-400 mt-1">Các món thuộc danh mục này sẽ cần được gán danh mục mới.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 border border-zinc-800 text-zinc-400 font-bold text-xs rounded-xl hover:bg-zinc-900"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20"
                >
                  {isDeleting ? "Đang xóa..." : "Xóa Ngay"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
