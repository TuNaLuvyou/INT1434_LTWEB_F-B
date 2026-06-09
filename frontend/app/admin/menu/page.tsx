"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { getAccessTokenFromCookie } from "@/lib/auth/client";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  TrendingDown, 
  Loader2, 
  ChevronRight,
  Filter,
  Utensils,
  X
} from "lucide-react";
import Image from "next/image";

const MenuItemForm = dynamic(() => import("@/components/MenuItemForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12 text-sm font-semibold text-zinc-400">
      Đang tải form...
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isSoldOut: boolean;
  category?: {
    name: string;
  };
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Trạng thái modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  
  // Trạng thái modal xóa
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch categories từ api public menu
      const menuRes = await fetch(`${API_URL}/api/menu`);
      const menuResult = await menuRes.json();
      if (menuRes.ok && menuResult.success) {
        setCategories(menuResult.data.categories || []);
      }

      // 2. Fetch danh sách món quản lý (bao gồm các món ẩn)
      const accessToken = getAccessTokenFromCookie();
      const adminRes = await fetch(`${API_URL}/api/admin/menu-items`, {
        headers: { "Authorization": `Bearer ${accessToken || ""}` }
      });
      const adminResult = await adminRes.json();
      if (adminRes.ok && adminResult.success) {
        setItems(adminResult.data || []);
      } else {
        throw new Error(adminResult.message || "Không thể tải danh sách món ăn quản lý");
      }
    } catch (err: any) {
      console.error("[Admin Menu Dashboard] Lỗi tải dữ liệu:", err);
      setError(err.message || "Không thể kết nối đến API backend. Vui lòng kiểm tra server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Xử lý xóa món ăn
  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(`${API_URL}/api/admin/menu-items/${deleteConfirmItem.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${accessToken || ""}` }
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Xóa món ăn thất bại");
      }

      // Reload dữ liệu
      await fetchData();
      setDeleteConfirmItem(null);
    } catch (err: any) {
      alert(err.message || "Đã có lỗi xảy ra");
    } finally {
      setIsDeleting(false);
    }
  };

  // Mở modal thêm mới
  const handleAddNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  // Mở modal sửa món
  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  // Khi form submit thành công
  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setSelectedItem(null);
    fetchData();
  };

  // Lọc danh sách món ăn theo search & category
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "" || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });


  return (
    <div className="h-screen max-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-6 pl-16 lg:pl-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Quản lý Món ăn</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Menu</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col p-6 space-y-4 max-w-7xl w-full mx-auto relative z-10">
        {/* Header Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-2">
              <Utensils size={13} className="stroke-[2.5]" />
              <span>Hệ thống RestoFlow • Admin Panel</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Danh Sách Thực Đơn
            </h1>
          </div>
          
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 active:scale-98 shadow-lg shadow-violet-500/15 cursor-pointer transition-all self-start sm:self-center"
          >
            <Plus size={14} className="stroke-[3]" /> Thêm món mới
          </button>
        </div>

        {/* Thanh lọc & tìm kiếm */}
        <div className="bg-zinc-900/40 border border-zinc-900 p-4 shrink-0 flex flex-col md:flex-row gap-4 rounded-2xl shadow-xl backdrop-blur-md">
          {/* Ô tìm kiếm */}
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên món, mô tả..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 text-sm font-semibold rounded-xl focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all text-zinc-100 placeholder-zinc-500 shadow-sm"
            />
          </div>

          {/* Ô lọc danh mục */}
          <div className="relative min-w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 text-sm font-semibold rounded-xl focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all appearance-none cursor-pointer text-zinc-100 placeholder-zinc-500 shadow-sm"
            >
              <option value="" className="bg-zinc-950 text-zinc-100">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-zinc-950 text-zinc-100">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Trạng thái Loading / Lỗi */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-zinc-900/80 shadow-xl backdrop-blur-sm rounded-2xl">
            <Loader2 className="animate-spin text-orange-500 mb-3" size={32} />
            <p className="text-sm font-bold text-zinc-400">Đang tải danh sách món ăn...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 bg-red-950/10 rounded-2xl border border-red-900/30 p-6 text-center">
            <AlertTriangle className="text-red-500 mb-3" size={36} />
            <p className="text-sm font-black text-red-400 mb-2">Đã xảy ra lỗi</p>
            <p className="text-xs text-zinc-400 max-w-md mb-4 leading-relaxed">{error}</p>
            <button
              onClick={fetchData}
              className="px-4.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              Thử lại ngay
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-zinc-900/80 shadow-xl backdrop-blur-sm rounded-2xl text-center px-4">
            <div className="p-4.5 bg-orange-500/10 rounded-full text-orange-500 mb-4 border border-orange-500/20 animate-pulse">
              <Utensils size={32} />
            </div>
            <h3 className="text-base font-extrabold text-zinc-200">Không tìm thấy món ăn nào</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm font-semibold">
              {searchTerm || selectedCategory 
                ? "Không tìm thấy món nào phù hợp với điều kiện tìm kiếm/lọc của bạn." 
                : "Danh sách món ăn trống. Hãy bắt đầu bằng cách thêm món mới!"}
            </p>
          </div>
        ) : (
          /* Bảng dữ liệu */
          <div className="flex-1 min-h-0 bg-zinc-900/20 border border-zinc-900/80 shadow-xl backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr className="bg-zinc-950/80 border-b border-zinc-900">
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest w-24 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Hình ảnh</th>
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Tên món & Mô tả</th>
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest w-40 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Danh mục</th>
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest w-36 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Giá bán</th>
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest w-36 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Trạng thái</th>
                    <th className="p-4 text-xs font-black text-zinc-400 uppercase tracking-widest w-28 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/20 transition-colors">
                      {/* Hình ảnh */}
                      <td className="p-4">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner flex-shrink-0">
                          <Image
                            src={item.imageUrl || "/placeholder-food.svg"}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </td>

                      {/* Tên món và Mô tả */}
                      <td className="p-4">
                        <h4 className="text-sm font-black text-zinc-100 line-clamp-1 hover:text-violet-400 transition-colors cursor-default">{item.name}</h4>
                        {item.description ? (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed max-w-md font-semibold">
                            {item.description}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic mt-1 font-semibold">Chưa có mô tả món</p>
                        )}
                      </td>

                      {/* Danh mục */}
                      <td className="p-4">
                        <span className="text-xs font-extrabold bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full border border-violet-500/20">
                          {item.category?.name || "Không rõ"}
                        </span>
                      </td>

                      {/* Giá bán */}
                      <td className="p-4 font-black text-sm text-zinc-100">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND"
                        }).format(Number(item.price))}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-4 space-y-1">
                        {/* Hoạt động */}
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                            <Eye size={10} /> Hiển thị
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            <EyeOff size={10} /> Ẩn
                          </span>
                        )}
                        
                        {/* Hết món */}
                        {item.isSoldOut && (
                          <div className="block mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                              <TrendingDown size={10} /> Hết món
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 bg-zinc-950 text-zinc-400 hover:text-violet-400 hover:border-violet-500/50 rounded-lg cursor-pointer transition-all border border-zinc-800 shadow-sm"
                            title="Chỉnh sửa món"
                          >
                            <Edit3 size={14} className="stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-2 bg-zinc-950 text-zinc-400 hover:text-red-400 hover:border-red-500/50 rounded-lg cursor-pointer transition-all border border-zinc-800 shadow-sm"
                            title="Xóa món"
                          >
                            <Trash2 size={14} className="stroke-[2.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Form Thêm/Sửa */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 shadow-2xl max-w-lg w-full overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-150 relative">
            {/* Header Modal */}
            <div className="px-6 py-4.5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/30">
              <h3 className="text-base font-black text-zinc-50">
                {selectedItem ? "Chỉnh sửa Món ăn" : "Thêm Món ăn Mới"}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6">
              <MenuItemForm
                categories={categories}
                initialData={selectedItem}
                onSubmitSuccess={handleFormSubmitSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 shadow-2xl max-w-sm w-full p-6 text-center rounded-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 bg-red-950/20 border border-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <AlertTriangle size={24} className="stroke-[2.5]" />
            </div>
            
            <h3 className="text-base font-black text-zinc-100">Xác nhận xóa món ăn?</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-1.5 leading-relaxed">
              Bạn có chắc chắn muốn xóa món <strong className="text-zinc-200 font-bold">"{deleteConfirmItem.name}"</strong> không? 
              Hình ảnh trên Cloudinary cũng sẽ được xóa bỏ vĩnh viễn. Hành động này không thể hoàn tác!
            </p>

            <div className="flex gap-3 justify-center mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="px-4.5 py-2.5 border border-zinc-800 text-zinc-400 rounded-lg text-sm font-bold hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50 transition-all cursor-pointer"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4.5 py-2.5 bg-red-650 text-white rounded-lg text-xs font-black hover:bg-red-500 active:scale-98 disabled:opacity-50 shadow-lg shadow-red-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Đang xóa...
                  </>
                ) : (
                  "Đúng, hãy xóa"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
