'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  code: z.string().min(3, 'Mã quá ngắn').max(20, 'Mã quá dài').transform(v => v.toUpperCase()),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.coerce.number().positive('Giá trị phải lớn hơn 0'),
  maxUsage: z.coerce.number().positive('Lượt dùng phải > 0').nullable().or(z.literal('').transform(() => null)),
  expiredAt: z.string().nullable().or(z.literal('').transform(() => null)),
}).refine(data => {
  if (data.discountType === 'PERCENT' && data.discountValue > 100) return false;
  return true;
}, {
  message: "Phần trăm giảm tối đa là 100%",
  path: ["discountValue"]
});

type FormData = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function VoucherModal({ isOpen, onClose, voucher, onSuccess }: { isOpen: boolean, onClose: () => void, voucher?: any, onSuccess: (data: any) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = useForm<any>({
    resolver: zodResolver(schema),
    values: {
      code: voucher?.code || '',
      discountType: voucher?.discountType || 'PERCENT',
      discountValue: voucher?.discountValue || '',
      maxUsage: voucher?.maxUsage || '',
      expiredAt: voucher?.expiredAt ? new Date(voucher.expiredAt).toISOString().slice(0, 16) : '',
    }
  });

  const discountType = watch('discountType');

  if (!isOpen) return null;

  const onSubmit = async (data: any) => {
    try {
      const url = voucher ? `${API}/api/vouchers/${voucher.id}` : `${API}/api/vouchers`;
      const method = voucher ? 'PUT' : 'POST';
      
      // Ensure null is sent for empty strings
      const payload = {
        ...data,
        maxUsage: data.maxUsage ? Number(data.maxUsage) : null,
        expiredAt: data.expiredAt ? new Date(data.expiredAt).toISOString() : null
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(voucher ? 'Đã cập nhật voucher' : 'Đã tạo voucher mới');
        onSuccess(result.data);
        reset();
        onClose();
      } else {
        toast.error(result.message || 'Lỗi lưu voucher');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white">{voucher ? 'Sửa Voucher' : 'Tạo Voucher mới'}</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Mã Voucher</label>
            <input 
              {...register('code')} 
              placeholder="VD: WELCOME20"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 uppercase" 
            />
            {errors.code && <p className="text-rose-500 text-xs">{errors.code.message?.toString()}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase">Loại giảm giá</label>
              <select 
                {...register('discountType')} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="PERCENT">Theo %</option>
                <option value="FIXED">Số tiền cố định</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase">Giá trị</label>
              <input 
                type="number"
                {...register('discountValue')} 
                placeholder={discountType === 'PERCENT' ? '10' : '50000'}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" 
              />
              {errors.discountValue && <p className="text-rose-500 text-xs">{errors.discountValue.message?.toString()}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Giới hạn số lượt dùng (Bỏ trống nếu Không giới hạn)</label>
            <input 
              type="number"
              {...register('maxUsage')} 
              placeholder="VD: 100"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" 
            />
            {errors.maxUsage && <p className="text-rose-500 text-xs">{errors.maxUsage.message?.toString()}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Hết hạn vào (Bỏ trống nếu Vô thời hạn)</label>
            <input 
              type="datetime-local"
              {...register('expiredAt')} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 [color-scheme:dark]" 
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              {isSubmitting ? 'Đang lưu...' : 'Lưu Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
