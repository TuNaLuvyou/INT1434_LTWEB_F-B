'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, ChevronDown, Package, Clipboard, AlertTriangle } from 'lucide-react';

const schema = z.object({
  delta:  z.coerce.number().refine(v => v !== 0, 'Số lượng không được = 0'),
  reason: z.enum(['MANUAL_IMPORT', 'ADJUSTMENT', 'MANUAL_EXPORT']),
  note:   z.string().optional(),
});

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  ingredient: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function StockAdjustModal({ ingredient, onClose, onSaved }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: 'MANUAL_IMPORT' },
  });

  const reason = watch('reason');

  const onSubmit = async (values: any) => {
    if (values.reason === 'MANUAL_IMPORT' && values.delta <= 0) {
      alert('Số lượng nhập kho phải lớn hơn 0');
      return;
    }
    if (values.reason === 'MANUAL_EXPORT' && values.delta <= 0) {
      alert('Số lượng xuất kho phải lớn hơn 0');
      return;
    }

    // Tự động chuyển thành delta âm nếu chọn MANUAL_EXPORT (xuất kho)
    let finalDelta = Number(values.delta);
    if (values.reason === 'MANUAL_EXPORT') {
      finalDelta = -Math.abs(finalDelta);
    }

    const res = await fetch(`${API}/api/ingredients/${ingredient.id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        delta: finalDelta,
      }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      if (data.data?.lowStockAlert) {
        alert(`⚠️ Cảnh báo: Tồn kho vẫn ở mức thấp (${data.data.stock} ${ingredient.unit})`);
      }
      onSaved();
    } else {
      alert(data.message || 'Lỗi cập nhật');
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
            <h3 className="text-base font-extrabold text-white">Điều chỉnh tồn kho</h3>
            <p className="text-[11px] text-zinc-300 font-normal mt-1">{ingredient.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stock Status Badge */}
        <div className="mb-5 px-4 py-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl text-xs flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-violet-500" />
            <span>Tồn kho hiện tại:</span>
          </div>
          <span className="text-white text-sm font-bold bg-violet-600/20 px-2.5 py-0.5 rounded-full border border-violet-500/25">
            {new Intl.NumberFormat('vi-VN').format(Number(ingredient.stock))} {ingredient.unit}
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Operation Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Loại thao tác</label>
            <div className="relative">
              <select 
                {...register('reason')} 
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all cursor-pointer font-medium appearance-none"
              >
                <option value="MANUAL_IMPORT">Nhập kho (MANUAL_IMPORT)</option>
                <option value="MANUAL_EXPORT">Xuất kho (MANUAL_EXPORT)</option>
                <option value="ADJUSTMENT">Điều chỉnh kiểm kho (ADJUSTMENT)</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-3 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">
              {reason === 'MANUAL_IMPORT' && 'Số lượng nhập kho'}
              {reason === 'MANUAL_EXPORT' && 'Số lượng xuất kho'}
              {reason === 'ADJUSTMENT' && 'Số lượng điều chỉnh (Nhập số âm để giảm, số dương để tăng)'}
            </label>
            <div className="relative">
              <input
                type="number" 
                step="0.01"
                {...register('delta')}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                placeholder={
                  reason === 'MANUAL_IMPORT' 
                    ? 'Nhập số lượng muốn nhập thêm...' 
                    : reason === 'MANUAL_EXPORT'
                    ? 'Nhập số lượng muốn xuất ra...'
                    : 'Ví dụ: -50 hoặc +100'
                }
              />
            </div>
            {errors.delta?.message && (
              <div className="mt-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-2xs flex items-center gap-1.5 animate-shake">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold">{String(errors.delta.message)}</span>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">Ghi chú (tùy chọn)</label>
            <div className="relative">
              <Clipboard className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                {...register('note')}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                placeholder={
                  reason === 'MANUAL_EXPORT'
                    ? 'Ví dụ: Hủy nguyên liệu hỏng, xuất dùng thử...'
                    : 'Ví dụ: Nhập hàng từ nhà cung cấp A'
                }
              />
            </div>
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
                <span>Xác nhận</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
