"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles,
  CupSoda,
  Search,
  CheckCircle2,
  XCircle,
  Scaling,
  Milk
} from "lucide-react";

export interface OptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
  isActive: boolean;
}

export type ToppingItem = OptionItem;

const DEFAULT_SIZES: OptionItem[] = [
  { id: 'opt-size-m', name: 'Size Vừa (Medium)', priceAdjustment: 0, isActive: true },
  { id: 'opt-size-l', name: 'Size Lớn (Large)', priceAdjustment: 10000, isActive: true },
  { id: 'opt-size-xl', name: 'Size Đặc Biệt (XL)', priceAdjustment: 15000, isActive: true },
];

const DEFAULT_TOPPINGS: OptionItem[] = [
  { id: 'opt-top-tc', name: 'Trân châu đen', priceAdjustment: 5000, isActive: true },
  { id: 'opt-top-thach', name: 'Thạch dừa', priceAdjustment: 5000, isActive: true },
  { id: 'opt-top-cheese', name: 'Kem Cheese', priceAdjustment: 8000, isActive: true },
  { id: 'opt-top-pudding', name: 'Pudding trứng', priceAdjustment: 7000, isActive: true },
];

const LOCAL_STORAGE_SIZES_KEY = "hiai_custom_sizes";
const LOCAL_STORAGE_TOPPINGS_KEY = "hiai_custom_toppings";

export function getStoredSizes(): OptionItem[] {
  if (typeof window === "undefined") return DEFAULT_SIZES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SIZES_KEY);
    if (!raw) return DEFAULT_SIZES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SIZES;
  } catch (err) {
    return DEFAULT_SIZES;
  }
}

export function saveStoredSizes(sizes: OptionItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SIZES_KEY, JSON.stringify(sizes));
    window.dispatchEvent(new Event("sizes_updated"));
    window.dispatchEvent(new Event("options_updated"));
  } catch (err) {
    console.error("Error saving sizes to localStorage:", err);
  }
}

export function getStoredToppings(): OptionItem[] {
  if (typeof window === "undefined") return DEFAULT_TOPPINGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TOPPINGS_KEY);
    if (!raw) return DEFAULT_TOPPINGS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TOPPINGS;
  } catch (err) {
    return DEFAULT_TOPPINGS;
  }
}

export function saveStoredToppings(toppings: OptionItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TOPPINGS_KEY, JSON.stringify(toppings));
    window.dispatchEvent(new Event("toppings_updated"));
    window.dispatchEvent(new Event("options_updated"));
  } catch (err) {
    console.error("Error saving toppings to localStorage:", err);
  }
}

interface ToppingManagerModalProps {
  onClose: () => void;
  onToppingsChanged?: () => void;
}

export default function ToppingManagerModal({ onClose, onToppingsChanged }: ToppingManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"sizes" | "toppings">("sizes");
  const [sizes, setSizes] = useState<OptionItem[]>([]);
  const [toppings, setToppings] = useState<OptionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form states
  const [editingItem, setEditingItem] = useState<OptionItem | null>(null);
  const [formData, setFormData] = useState({ name: "", priceAdjustment: 0 });

  useEffect(() => {
    setSizes(getStoredSizes());
    setToppings(getStoredToppings());
  }, []);

  const currentList = activeTab === "sizes" ? sizes : toppings;

  const handleSaveList = (newList: OptionItem[]) => {
    if (activeTab === "sizes") {
      setSizes(newList);
      saveStoredSizes(newList);
    } else {
      setToppings(newList);
      saveStoredToppings(newList);
    }
    if (onToppingsChanged) onToppingsChanged();
  };

  const openForm = (item?: OptionItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, priceAdjustment: item.priceAdjustment });
    } else {
      setEditingItem(null);
      setFormData({ name: "", priceAdjustment: activeTab === "sizes" ? 10000 : 5000 });
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ name: "", priceAdjustment: activeTab === "sizes" ? 10000 : 5000 });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let updatedList: OptionItem[] = [];
    if (editingItem) {
      updatedList = currentList.map(t => 
        t.id === editingItem.id 
          ? { ...t, name: formData.name.trim(), priceAdjustment: Number(formData.priceAdjustment) }
          : t
      );
    } else {
      const newItem: OptionItem = {
        id: `${activeTab === "sizes" ? "size" : "top"}_${Date.now()}`,
        name: formData.name.trim(),
        priceAdjustment: Number(formData.priceAdjustment),
        isActive: true,
      };
      updatedList = [...currentList, newItem];
    }

    handleSaveList(updatedList);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updatedList = currentList.filter(t => t.id !== id);
    handleSaveList(updatedList);
    if (editingItem?.id === id) resetForm();
  };

  const handleToggleActive = (id: string) => {
    const updatedList = currentList.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t);
    handleSaveList(updatedList);
  };

  const filteredList = currentList.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-zinc-950 border border-zinc-800/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden text-zinc-100 relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <CupSoda size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-50">Quản Lý Topping & Size Đồ Uống</h3>
              <p className="text-xs text-zinc-400">Thêm, sửa giá cộng thêm cho từng Size hoặc Topping áp dụng trên POS & Menu quét QR</p>
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

        {/* Tab Selection Bar (Left Aligned) */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-6 shrink-0 gap-2 pt-2">
          <button
            onClick={() => {
              setActiveTab("sizes");
              resetForm();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer outline-none ${
              activeTab === "sizes"
                ? "border-violet-500 text-violet-400 bg-violet-500/5 rounded-t-xl"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Scaling className="h-4 w-4" />
            <span>Tùy Chỉnh Kích Thước (Size)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 ml-1">
              {sizes.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("toppings");
              resetForm();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer outline-none ${
              activeTab === "toppings"
                ? "border-violet-500 text-violet-400 bg-violet-500/5 rounded-t-xl"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Milk className="h-4 w-4" />
            <span>Topping Đồ Uống</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 ml-1">
              {toppings.length}
            </span>
          </button>
        </div>

        {/* 2-Column Body Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
          {/* LEFT COLUMN: List */}
          <div className="flex-1 flex flex-col p-6 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
            
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={activeTab === "sizes" ? "Tìm kiếm size..." : "Tìm kiếm topping..."}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs font-bold text-zinc-100 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              <button
                type="button"
                onClick={() => openForm()}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition-all shadow-md shadow-violet-600/20 cursor-pointer active:scale-95 shrink-0"
              >
                <Plus size={14} /> {activeTab === "sizes" ? "Thêm Size" : "Thêm Topping"}
              </button>
            </div>

            {/* Scrollable Item List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredList.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-semibold border-2 border-dashed border-zinc-800 rounded-3xl">
                  Chưa có {activeTab === "sizes" ? "size" : "topping"} nào. Nhấn &quot;{activeTab === "sizes" ? "Thêm Size" : "Thêm Topping"}&quot; để tạo mới!
                </div>
              ) : (
                filteredList.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      editingItem?.id === item.id
                        ? "bg-violet-950/30 border-violet-500/50 shadow-md shadow-violet-500/10 ring-1 ring-violet-500/30"
                        : "bg-zinc-950 border-zinc-800/90 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item.id)}
                        className={`p-1 rounded-full transition-all cursor-pointer ${
                          item.isActive ? "text-violet-400" : "text-zinc-600"
                        }`}
                        title={item.isActive ? "Đang bật (Click để tắt)" : "Đang ẩn (Click để bật)"}
                      >
                        {item.isActive ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-zinc-100 text-sm">{item.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            item.isActive ? "bg-violet-500/15 text-violet-300 border border-violet-500/30" : "bg-zinc-800 text-zinc-500"
                          }`}>
                            {item.isActive ? "Hoạt động" : "Đã ẩn"}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-violet-400 mt-0.5 block">
                          +{Number(item.priceAdjustment).toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openForm(item)}
                        className="p-2 text-zinc-400 hover:text-violet-400 hover:bg-zinc-900 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                        title="Sửa"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
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
                <Sparkles size={16} className="text-violet-400" />
                <span>{editingItem ? `Chỉnh Sửa ${activeTab === "sizes" ? "Size" : "Topping"}` : `Thêm ${activeTab === "sizes" ? "Size" : "Topping"} Mới`}</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Tên {activeTab === "sizes" ? "Size Kích Thước" : "Topping"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={activeTab === "sizes" ? "Ví dụ: Size Vừa (M), Size Lớn (L)..." : "Ví dụ: Trân châu đường đen, Kem Cheese..."}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Giá phụ thu cộng thêm (VND) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={1000}
                  value={formData.priceAdjustment}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceAdjustment: Number(e.target.value) }))}
                  placeholder="10000"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">Số tiền cộng thêm vào giá gốc khi khách hàng chọn tùy chọn này.</p>
              </div>

              {/* Preview Card */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Xem trước tùy chọn</span>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-zinc-100 text-sm">{formData.name || `Tên ${activeTab === "sizes" ? "size" : "topping"}`}</span>
                  <span className="font-black text-violet-400 text-sm">
                    +{Number(formData.priceAdjustment || 0).toLocaleString('vi-VN')} VND
                  </span>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                {editingItem && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-3 border border-zinc-800 text-zinc-400 text-xs font-bold rounded-2xl hover:bg-zinc-900 cursor-pointer"
                  >
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-2xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 shadow-lg shadow-violet-500/20 transition-all cursor-pointer"
                >
                  {editingItem ? "Lưu Cập Nhật" : `Thêm ${activeTab === "sizes" ? "Size" : "Topping"} Mới`}
                </button>
              </div>
            </form>

            <div className="pt-6 border-t border-zinc-900 text-center">
              <p className="text-xs text-zinc-400 font-semibold">Tự động đồng bộ màn hình POS và Menu quét QR của Khách hàng</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
