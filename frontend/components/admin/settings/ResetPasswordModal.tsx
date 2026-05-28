'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  newPassword: z.string()
    .min(8, 'Mật khẩu phải từ 8 ký tự')
    .regex(/^(?=.*[A-Z])(?=.*\d)/, 'Cần 1 chữ hoa và 1 số'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"]
});

type FormData = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ResetPasswordModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  if (!isOpen) return null;

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ newPassword: data.newPassword })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success('Đã đặt lại mật khẩu thành công');
        reset();
        onClose();
      } else {
        toast.error(result.message || 'Lỗi đặt lại mật khẩu');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white">Đặt lại mật khẩu</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Mật khẩu mới</label>
            <input 
              type="password"
              {...register('newPassword')} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" 
            />
            {errors.newPassword && <p className="text-rose-500 text-xs">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Xác nhận mật khẩu</label>
            <input 
              type="password"
              {...register('confirmPassword')} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" 
            />
            {errors.confirmPassword && <p className="text-rose-500 text-xs">{errors.confirmPassword.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              {isSubmitting ? 'Đang lưu...' : 'Đặt lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
