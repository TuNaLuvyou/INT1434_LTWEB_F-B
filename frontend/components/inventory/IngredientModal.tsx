'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, AlertTriangle, Layers, Scale, Info } from 'lucide-react';

const schema = z.object({
  name:     z.string().min(1, 'Tên nguyên liệu không được để trống'),
  unit:     z.string().min(1, 'Đơn vị tính không được để trống'),
  stock:    z.coerce.number().min(0, 'Tồn kho khởi tạo không được âm'),
  minStock: z.coerce.number().min(0, 'Ngưỡng cảnh báo không được âm'),
});
type FormData = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  ingredient?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function IngredientModal({ ingredient, onClose, onSaved }: Props) {
  const isEdit = !!ingredient;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:     ingredient?.name || '',
      unit:     ingredient?.unit || '',
      stock:    ingredient ? Number(ingredient.stock) : 0,
      minStock: ingredient ? Number(ingredient.minStock) : 0,
    },
  });

  const onSubmit = async (values: any) => {
    const url = isEdit ? `${API}/api/ingredients/${ingredient.id}` : `${API}/api/ingredients`;
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-[28px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Glow */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[100px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-extrabold text-white">
              {isEdit ? 'Chỉnh sửa nguyên liệu' : 'Thêm nguyên liệu mới'}
            </h3>
            <p className="text-[11px] text-zinc-300 font-normal mt-1">
              {isEdit ? 'Thay đổi thông số cấu hình nguyên liệu nhà hàng RestoFlow.' : 'Tạo mới một nguyên liệu vào danh sách kho.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Ingredient Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Tên nguyên liệu</label>
            <div className="relative">
              <Layers className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                {...register('name')}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                placeholder="Ví dụ: Thịt bò, Bột mì..."
              />
            </div>
            {errors.name?.message && (
              <div className="mt-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-2xs flex items-center gap-1.5 animate-shake">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold">{String(errors.name.message)}</span>
              </div>
            )}
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Đơn vị tính</label>
            <div className="relative">
              <Scale className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                {...register('unit')}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                placeholder="Ví dụ: kg, gam, quả, hộp..."
              />
            </div>
            {errors.unit?.message && (
              <div className="mt-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-2xs flex items-center gap-1.5 animate-shake">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold">{String(errors.unit.message)}</span>
              </div>
            )}
          </div>

          {/* Current Stock */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Tồn kho hiện tại</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                {...register('stock')}
                disabled={isEdit}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-950/30"
                placeholder="Ví dụ: 100"
              />
            </div>
            {errors.stock?.message && (
              <div className="mt-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-2xs flex items-center gap-1.5 animate-shake">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold">{String(errors.stock.message)}</span>
              </div>
            )}
            {isEdit && (
              <div className="mt-2 p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/60 flex items-start gap-2.5">
                <Info className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-400 font-medium leading-normal">
                  Lưu ý: Để điều chỉnh tồn kho, vui lòng dùng tính năng <span className="text-violet-400 font-bold">"Nhập kho"</span> tại danh sách ngoài để giữ lịch sử điều chỉnh chính xác.
                </p>
              </div>
            )}
          </div>

          {/* Low Stock Warning Alert Threshold */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Ngưỡng cảnh báo hết hàng</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                {...register('minStock')}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                placeholder="Ví dụ: 10"
              />
            </div>
            {errors.minStock?.message && (
              <div className="mt-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-2xs flex items-center gap-1.5 animate-shake">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold">{String(errors.minStock.message)}</span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-3 mt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-850/40 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition-all active:scale-95 flex-1"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-95 flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>Lưu lại</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
