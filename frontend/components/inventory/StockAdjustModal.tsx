'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  delta:  z.coerce.number().refine(v => v !== 0, 'Số lượng không được = 0'),
  reason: z.enum(['MANUAL_IMPORT', 'ADJUSTMENT']),
  note:   z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Props {
  ingredient: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function StockAdjustModal({ ingredient, onClose, onSaved }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: 'MANUAL_IMPORT' },
  });

  const reason = watch('reason');

  const onSubmit = async (values: FormData) => {
    if (values.reason === 'MANUAL_IMPORT' && values.delta <= 0) {
      alert('MANUAL_IMPORT yêu cầu số lượng > 0');
      return;
    }
    const res = await fetch(`${API}/api/ingredients/${ingredient.id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Điều chỉnh tồn kho</h2>
            <p className="text-sm text-gray-500">{ingredient.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-6 py-3 bg-blue-50 text-sm text-blue-700 font-medium">
          Tồn kho hiện tại: <strong>{new Intl.NumberFormat('vi-VN').format(Number(ingredient.stock))} {ingredient.unit}</strong>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại thao tác</label>
            <select {...register('reason')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="MANUAL_IMPORT">Nhập kho (MANUAL_IMPORT)</option>
              <option value="ADJUSTMENT">Điều chỉnh kiểm kho (ADJUSTMENT)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số lượng {reason === 'ADJUSTMENT' ? '(âm = giảm)' : ''}
            </label>
            <input
              type="number" step="0.01"
              {...register('delta')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={reason === 'MANUAL_IMPORT' ? 'Nhập số lượng nhập...' : 'VD: -50 hoặc +100'}
            />
            {errors.delta && <p className="text-red-500 text-xs mt-1">{errors.delta.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              {...register('note')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Nhập hàng từ nhà cung cấp A"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60">
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
