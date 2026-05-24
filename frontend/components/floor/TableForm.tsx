'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Plus, Edit3 } from 'lucide-react';
import { getAccessTokenFromCookie } from '../../lib/auth/client';

const tableSchema = z.object({
  tableNumber: z.coerce
    .number()
    .int('Số bàn phải là số nguyên')
    .min(1, 'Số bàn tối thiểu là 1')
    .max(99, 'Số bàn tối đa là 99'),
  label: z
    .string()
    .min(1, 'Tên bàn không được để trống')
    .max(50, 'Tên bàn tối đa 50 ký tự'),
});

type TableFormValues = z.infer<typeof tableSchema>;

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

interface TableFormProps {
  table?: Table | null;
  mode: 'add' | 'edit';
  onSuccess: (updatedOrCreatedTable: Table) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

export default function TableForm({ table, mode, onSuccess, onCancel, onError }: TableFormProps) {
  const [loading, setLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TableFormValues>({
    resolver: zodResolver(tableSchema) as any,
    defaultValues: {
      tableNumber: table ? table.tableNumber : undefined as any,
      label: table ? table.label : '',
    },
  });

  const onSubmit = async (values: TableFormValues) => {
    setLoading(true);
    try {
      const token = getAccessTokenFromCookie();
      if (!token) {
        throw new Error('Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.');
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const url = mode === 'add' 
        ? `${API_URL}/api/tables` 
        : `${API_URL}/api/tables/${table?.id}`;
        
      const method = mode === 'add' ? 'POST' : 'PUT';

      // Loại bỏ tableNumber khỏi request body khi ở mode edit vì backend cấm sửa tableNumber
      const body = mode === 'add' 
        ? values 
        : { label: values.label };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Gửi yêu cầu thất bại.');
      }

      if (result.success && result.data) {
        onSuccess(result.data);
      } else {
        throw new Error(result.message || 'Lỗi không xác định.');
      }
    } catch (err: any) {
      console.error('[TableForm] Submit error:', err);
      onError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Table Number - Chỉ cho sửa khi Thêm mới */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Số hiệu bàn (1 - 99)
        </label>
        {mode === 'add' ? (
          <input
            type="number"
            {...register('tableNumber')}
            placeholder="Ví dụ: 12"
            disabled={loading}
            className={`w-full bg-zinc-950 border ${
              errors.tableNumber ? 'border-red-500' : 'border-zinc-800'
            } rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition-all`}
          />
        ) : (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-500 select-none">
            Bàn số {table?.tableNumber} <span className="text-xs font-normal text-zinc-600">(Không thể sửa đổi số hiệu bàn)</span>
          </div>
        )}
        {errors.tableNumber && (
          <p className="text-xs text-red-400 font-semibold">{errors.tableNumber.message}</p>
        )}
      </div>

      {/* Table Label */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Tên hiển thị bàn (Label)
        </label>
        <input
          type="text"
          {...register('label')}
          placeholder="Ví dụ: Bàn Cửa Sổ 2, Khu VIP"
          disabled={loading}
          className={`w-full bg-zinc-950 border ${
            errors.label ? 'border-red-500' : 'border-zinc-800'
          } rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition-all`}
        />
        {errors.label && (
          <p className="text-xs text-red-400 font-semibold">{errors.label.message}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
        >
          Hủy bỏ
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu dữ liệu...
            </>
          ) : mode === 'add' ? (
            <>
              <Plus className="h-4 w-4" />
              Thêm bàn mới
            </>
          ) : (
            <>
              <Edit3 className="h-4 w-4" />
              Cập nhật bàn
            </>
          )}
        </button>
      </div>
    </form>
  );
}
