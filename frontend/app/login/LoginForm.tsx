'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { setAccessToken } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

const loginSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống').min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm({ redirectUrl }: { redirectUrl?: string }) {
  const router = useRouter();
  const fetchCurrentUser = useAuthStore(state => state.fetchCurrentUser);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError('root', { message: 'Email hoặc mật khẩu không đúng' });
        } else {
          setError('root', { message: result.message || 'Có lỗi xảy ra' });
        }
        return;
      }

      const { accessToken, user } = result.data;
      setAccessToken(accessToken);
      await fetchCurrentUser(); // load user state

      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        router.push('/admin/dashboard');
      } else if (user.role === 'STAFF') {
        router.push('/pos');
      } else if (user.role === 'KITCHEN') {
        router.push('/kds');
      } else {
        router.push('/');
      }
    } catch (error) {
      setError('root', { message: 'Không thể kết nối server. Thử lại sau.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errors.root && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="font-medium">{errors.root.message}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-bold text-gray-700">
          Email
        </label>
        <div className="mt-1.5">
          <input
            id="email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="admin@restoflow.demo"
            {...register('email')}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`appearance-none block w-full px-4 py-3.5 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm transition-all bg-gray-50/50 ${
              errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          />
        </div>
        {errors.email && (
          <p className="mt-2 text-sm text-red-600 font-medium" id="email-error">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-bold text-gray-700">
          Mật khẩu
        </label>
        <div className="mt-1.5 relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`appearance-none block w-full px-4 py-3.5 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm transition-all bg-gray-50/50 ${
              errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-amber-600 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-2 text-sm text-red-600 font-medium" id="password-error">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-amber-600/30 text-sm font-extrabold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-95"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Đang đăng nhập...</span>
            </div>
          ) : (
            'Đăng nhập ngay'
          )}
        </button>
      </div>
    </form>
  );
}
