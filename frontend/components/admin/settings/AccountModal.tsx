'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  name: z.string().min(2, 'Tên quá ngắn'),
  role: z.enum(['ADMIN', 'MANAGER', 'KITCHEN', 'CASHIER']),
  password: z.string()
    .min(8, 'Mật khẩu phải từ 8 ký tự')
    .regex(/^(?=.*[A-Z])(?=.*\d)/, 'Cần 1 chữ hoa và 1 số')
    .optional()
    .or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AccountModal({ isOpen, onClose, user, onSuccess }: { isOpen: boolean, onClose: () => void, user?: any, onSuccess: (data: any) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      email: user?.email || '',
      name: user?.name || '',
      role: user?.role || 'CASHIER',
      password: '',
    }
  });

  if (!isOpen) return null;

  const onSubmit = async (data: FormData) => {
    try {
      const url = user ? `${API}/api/admin/users/${user.id}` : `${API}/api/admin/users`;
      const method = user ? 'PATCH' : 'POST';
      
      const payload: any = { ...data };
      if (user) {
        delete payload.password;
        delete payload.email; // Don't update email
      } else {
        if (!data.password) {
          toast.error('Vui lòng nhập mật khẩu cho tài khoản mới');
          return;
        }
      }

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
        toast.success(user ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản mới');
        onSuccess(result.data);
        reset();
        onClose();
      } else {
        toast.error(result.message || 'Lỗi lưu tài khoản');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white">{user ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản mới'}</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Email</label>
            <input 
              {...register('email')} 
              disabled={!!user}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50" 
            />
            {errors.email && <p className="text-rose-500 text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Họ và tên</label>
            <input 
              {...register('name')} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" 
            />
            {errors.name && <p className="text-rose-500 text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase">Vai trò</label>
            <select 
              {...register('role')} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            >

              <option value="CASHIER">Thu ngân (CASHIER)</option>
              <option value="KITCHEN">Bếp (KITCHEN)</option>
              <option value="MANAGER">Quản lý (MANAGER)</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
            </select>
          </div>

          {!user && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase">Mật khẩu</label>
              <input 
                type="password"
                {...register('password')} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" 
              />
              {errors.password && <p className="text-rose-500 text-xs">{errors.password.message}</p>}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              {isSubmitting ? 'Đang lưu...' : 'Lưu tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
