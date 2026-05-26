'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Chỉnh sửa nguyên liệu' : 'Thêm nguyên liệu mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên nguyên liệu</label>
            <input
              type="text"
              {...register('name')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Thịt bò, Bột mì..."
            />
            {errors.name?.message && <p className="text-red-500 text-xs mt-1">{String(errors.name.message)}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label>
            <input
              type="text"
              {...register('unit')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: kg, gam, quả, hộp..."
            />
            {errors.unit?.message && <p className="text-red-500 text-xs mt-1">{String(errors.unit.message)}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho hiện tại</label>
            <input
              type="number"
              step="0.01"
              {...register('stock')}
              disabled={isEdit} // Thường không nên trực tiếp sửa tồn kho khi edit mà qua phiếu nhập kho
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
              placeholder="VD: 100"
            />
            {errors.stock?.message && <p className="text-red-500 text-xs mt-1">{String(errors.stock.message)}</p>}
            {isEdit && (
              <p className="text-[11px] text-gray-400 mt-1">
                Lưu ý: Để điều chỉnh tồn kho, vui lòng dùng tính năng "Nhập kho" ở trang danh sách.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngưỡng cảnh báo hết hàng</label>
            <input
              type="number"
              step="0.01"
              {...register('minStock')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: 10"
            />
            {errors.minStock?.message && <p className="text-red-500 text-xs mt-1">{String(errors.minStock.message)}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
              {isSubmitting ? 'Đang lưu...' : 'Lưu lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
