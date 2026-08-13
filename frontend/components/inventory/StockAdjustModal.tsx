'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, ChevronDown, Package, Clipboard, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const schema = z.object({
  delta:  z.coerce.number().refine(v => v !== 0, 'Số lượng không được = 0'),
  reason: z.enum(['MANUAL_IMPORT', 'ADJUSTMENT', 'MANUAL_EXPORT']),
  note:   z.string().optional(),
});

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  ingredient: any;
  targetWarehouse?: 'main' | 'branch';
  onClose: () => void;
  onSaved: () => void;
}

export default function StockAdjustModal({ ingredient, targetWarehouse = 'main', onClose, onSaved }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: 'MANUAL_IMPORT' },
  });

  const reason = watch('reason');
  const delta = watch('delta');

  const currentStock = targetWarehouse === 'branch' ? Number(ingredient.branchStock || 0) : Number(ingredient.mainStock || ingredient.stock || 0);

  let projectedStock = currentStock;
  const numDelta = Number(delta) || 0;
  if (reason === 'MANUAL_IMPORT') {
    projectedStock = currentStock + Math.abs(numDelta);
  } else if (reason === 'MANUAL_EXPORT') {
    projectedStock = currentStock - Math.abs(numDelta);
  } else {
    projectedStock = currentStock + numDelta;
  }

  const onSubmit = async (values: any) => {
    if (values.reason === 'MANUAL_IMPORT' && values.delta <= 0) {
      alert('Số lượng nhập kho phải lớn hơn 0');
      return;
    }
    if (values.reason === 'MANUAL_EXPORT' && values.delta <= 0) {
      alert('Số lượng xuất kho phải lớn hơn 0');
      return;
    }

    let finalDelta = Number(values.delta);
    if (values.reason === 'MANUAL_EXPORT') {
      finalDelta = -Math.abs(finalDelta);
    }

    const token = getAccessTokenFromCookie();
    const res = await fetch(`${API}/api/ingredients/${ingredient.id}/stock`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...values,
        delta: finalDelta,
        targetWarehouse
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl h-[92vh] sm:h-[85vh] bg-zinc-950 border border-zinc-800/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden text-zinc-100 relative font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-50">Điều Chỉnh Tồn Kho</h3>
              <p className="text-xs text-zinc-400">Nguyên liệu: <span className="text-violet-400 font-bold">{ingredient.name}</span></p>
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

        {/* 2-Column Body Layout */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: Inputs */}
              <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <Package size={16} className="text-violet-400" />
                  <span>Chi tiết điều chỉnh kho</span>
                </h4>

                {/* Operation Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Loại thao tác</label>
                  <div className="relative">
                    <select 
                      {...register('reason')} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-4 pr-10 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all cursor-pointer font-semibold appearance-none"
                    >
                      <option value="MANUAL_IMPORT">📥 Nhập kho (MANUAL_IMPORT)</option>
                      <option value="MANUAL_EXPORT">📤 Xuất kho / Hao hụt (MANUAL_EXPORT)</option>
                      <option value="ADJUSTMENT">📋 Điều chỉnh kiểm kho thực tế (ADJUSTMENT)</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">
                    {reason === 'MANUAL_IMPORT' && 'Số lượng nhập kho'}
                    {reason === 'MANUAL_EXPORT' && 'Số lượng xuất kho'}
                    {reason === 'ADJUSTMENT' && 'Số lượng điều chỉnh (+/-)'}
                  </label>
                  <input
                    type="number" 
                    step="0.01"
                    {...register('delta')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                    placeholder="Ví dụ: 50"
                  />
                  {errors.delta?.message && (
                    <p className="text-[11px] text-red-400 font-bold mt-1">{String(errors.delta.message)}</p>
                  )}
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Ghi chú (tùy chọn)</label>
                  <div className="relative">
                    <Clipboard className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      {...register('note')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                      placeholder="Lý do điều chỉnh kho..."
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Realtime Stock Calculation Card */}
              <div className="space-y-5 flex flex-col justify-between">
                <div className="space-y-4 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                  <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-violet-400" />
                    <span>Dự báo thay đổi kho</span>
                  </h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <span className="text-xs text-zinc-400 font-semibold">Tồn kho hiện tại:</span>
                      <span className="text-sm font-bold text-zinc-100">{new Intl.NumberFormat('vi-VN').format(currentStock)} {ingredient.unit}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <span className="text-xs text-zinc-400 font-semibold">Thay đổi:</span>
                      <span className={`text-sm font-black ${
                        reason === 'MANUAL_IMPORT' ? 'text-emerald-400' : reason === 'MANUAL_EXPORT' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {reason === 'MANUAL_IMPORT' ? `+${Math.abs(numDelta)}` : reason === 'MANUAL_EXPORT' ? `-${Math.abs(numDelta)}` : numDelta} {ingredient.unit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-violet-950/30 rounded-2xl border border-violet-500/40">
                      <span className="text-xs text-violet-300 font-bold uppercase tracking-wider">Tồn kho sau điều chỉnh:</span>
                      <span className="text-base font-black text-violet-300">
                        {new Intl.NumberFormat('vi-VN').format(projectedStock)} {ingredient.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-3xl text-center">
                  <p className="text-xs text-zinc-400 font-semibold">Lịch sử điều chỉnh sẽ được ghi lại trong nhật ký quản lý kho</p>
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
                  <Loader2 size={16} className="animate-spin" /> Đang cập nhật...
                </>
              ) : (
                "Xác Nhận Điều Chỉnh"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
