'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, AlertTriangle, Layers, Scale, Info, Box } from 'lucide-react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const schema = z.object({
  name:     z.string().min(1, 'Tên nguyên liệu không được để trống'),
  unit:     z.string().min(1, 'Đơn vị tính không được để trống'),
  stock:    z.coerce.number().min(0, 'Tồn kho khởi tạo không được âm'),
  minStock: z.coerce.number().min(0, 'Ngưỡng cảnh báo không được âm'),
});

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  ingredient?: any;
  targetWarehouse?: 'main' | 'branch';
  onClose: () => void;
  onSaved: () => void;
}

export default function IngredientModal({ ingredient, targetWarehouse = 'main', onClose, onSaved }: Props) {
  const isEdit = !!ingredient;

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:     ingredient?.name || '',
      unit:     ingredient?.unit || '',
      stock:    ingredient ? (targetWarehouse === 'branch' ? Number(ingredient.branchStock || 0) : Number(ingredient.mainStock || ingredient.stock || 0)) : 0,
      minStock: ingredient ? Number(ingredient.minStock) : 0,
    },
  });

  const watchName = watch('name');
  const watchUnit = watch('unit');
  const watchStock = watch('stock');
  const watchMinStock = watch('minStock');

  const onSubmit = async (values: any) => {
    const url = isEdit ? `${API}/api/ingredients/${ingredient.id}` : `${API}/api/ingredients`;
    const method = isEdit ? 'PUT' : 'POST';

    const token = getAccessTokenFromCookie();

    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...values,
        targetWarehouse
      }),
      credentials: 'include',
    });

    const data = await res.json();
    if (res.ok) {
      onSaved();
    } else {
      alert(data.message || 'Lỗi lưu thông tin');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl h-[92vh] sm:h-[85vh] bg-zinc-950 border border-zinc-800/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden text-zinc-100 relative font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Box size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-50">
                {isEdit ? 'Chỉnh Sửa Nguyên Liệu Kho' : 'Thêm Nguyên Liệu Mới'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isEdit ? 'Thay đổi thông số cấu hình nguyên liệu nhà hàng.' : 'Tạo mới nguyên liệu vào kho quản lý.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/80 transition-all cursor-pointer"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2-Column Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: Core Ingredient Specs */}
              <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <Layers size={16} className="text-violet-400" />
                  <span>Thông tin nguyên liệu</span>
                </h4>

                {/* Tên nguyên liệu */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">
                    Tên nguyên liệu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Layers className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      {...register('name')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                      placeholder="Ví dụ: Thịt bò bít tết, Bột mì khoai tây, Đường phèn..."
                    />
                  </div>
                  {errors.name?.message && (
                    <p className="text-[11px] text-red-400 font-bold mt-1">{String(errors.name.message)}</p>
                  )}
                </div>

                {/* Đơn vị tính */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">
                    Đơn vị tính <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      {...register('unit')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                      placeholder="Ví dụ: kg, gam, lon, hộp, chai, ml..."
                    />
                  </div>
                  {errors.unit?.message && (
                    <p className="text-[11px] text-red-400 font-bold mt-1">{String(errors.unit.message)}</p>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Stock Levels & Preview */}
              <div className="space-y-5 flex flex-col justify-between">
                <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                  <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                    <Box size={16} className="text-violet-400" />
                    <span>Cấu hình kho & Cảnh báo</span>
                  </h4>

                  {/* Stock Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Tồn kho hiện tại</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('stock')}
                      disabled={isEdit}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold disabled:opacity-50"
                      placeholder="100"
                    />
                    {isEdit && (
                      <div className="mt-2 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-800 flex items-start gap-2 text-[11px] text-zinc-400 font-semibold">
                        <Info size={14} className="text-violet-400 shrink-0 mt-0.5" />
                        <span>Dùng tính năng <b>Nhập kho</b> ngoài danh sách để giữ lịch sử chính xác.</span>
                      </div>
                    )}
                  </div>

                  {/* Min Stock Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Ngưỡng cảnh báo hết hàng</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('minStock')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                      placeholder="10"
                    />
                  </div>
                </div>

                {/* Ingredient Preview Card */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-3xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Xem trước nguyên liệu</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-extrabold text-zinc-100 text-sm">{watchName || "Tên nguyên liệu"}</h5>
                      <p className="text-xs font-semibold text-zinc-400">Đơn vị: {watchUnit || "kg"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-violet-400 block">{watchStock || 0} {watchUnit || "kg"}</span>
                      <span className="text-[10px] text-zinc-500 font-bold block">Ngưỡng: {watchMinStock || 0}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-end gap-3 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 border border-zinc-800 text-zinc-400 rounded-2xl text-xs font-bold hover:bg-zinc-900 hover:text-zinc-200 transition-all"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-2xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 shadow-xl shadow-violet-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Đang lưu...
                </>
              ) : (
                "Lưu Cập Nhật"
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
