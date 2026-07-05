'use client';

import React, { useState } from 'react';
import { X, Edit2, Trash2, Calendar, ShoppingBag, Eye, HelpCircle, Loader2 } from 'lucide-react';
import TableForm from './TableForm';
import TableQRCode from './TableQRCode';
import { getAccessTokenFromCookie } from '../../lib/auth/client';

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  sessionId?: string | null;
  activeSession?: {
    openedAt: Date | string;
    orderItemsCount: number;
  } | null;
}

interface TableModalProps {
  table?: Table | null;
  mode: 'view' | 'add' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrCreatedTable: Table, action: 'add' | 'edit' | 'delete') => void;
  onToast: (toast: { type: 'success' | 'error'; message: string }) => void;
}

export default function TableModal({ table, mode: initialMode, isOpen, onClose, onSuccess, onToast }: TableModalProps) {
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>(initialMode);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleUpdateSuccess = (updatedTable: Table) => {
    onToast({ type: 'success', message: mode === 'add' ? 'Đã thêm bàn mới thành công!' : 'Đã cập nhật bàn thành công!' });
    onSuccess(updatedTable, mode === 'add' ? 'add' : 'edit');
    onClose();
  };

  const handleFormError = (message: string) => {
    onToast({ type: 'error', message });
  };

  const handleDelete = async () => {
    if (!table) return;
    setDeleting(true);
    try {
      const token = getAccessTokenFromCookie();
      if (!token) {
        throw new Error('Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.');
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/tables/${table.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Xóa bàn thất bại.');
      }

      onToast({ type: 'success', message: 'Đã xóa bàn ăn thành công!' });
      onSuccess(table, 'delete');
      onClose();
    } catch (err: any) {
      console.error('[TableModal] Delete error:', err);
      onToast({ type: 'error', message: err.message || 'Không thể xóa bàn ăn này.' });
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Tính thời gian mở bàn nếu bàn đang OCCUPIED
  const getSessionDuration = (openedAtString?: Date | string) => {
    if (!openedAtString) return '';
    const openedAt = new Date(openedAtString);
    const now = new Date();
    const diffMs = now.getTime() - openedAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} phút trước`;
    }
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours} giờ ${remainingMins} phút trước`;
  };

  const statusBadges = {
    AVAILABLE: { label: 'Trống', class: 'bg-emerald-950/60 text-emerald-400 border-emerald-800' },
    OCCUPIED: { label: 'Đang dùng', class: 'bg-red-950/60 text-red-400 border-red-800' },
    RESERVED: { label: 'Đã đặt', class: 'bg-amber-950/60 text-amber-400 border-amber-800' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print-no-show">
      {/* Container */}
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-6 shrink-0">
          <h3 className="text-base font-extrabold text-white tracking-tight">
            {mode === 'add' && 'THÊM BÀN ĂN MỚI'}
            {mode === 'edit' && `SỬA THÔNG TIN BÀN SỐ ${table?.tableNumber}`}
            {mode === 'view' && `CHI TIẾT BÀN SỐ ${table?.tableNumber}`}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {deleteConfirm ? (
            /* Delete Confirmation view */
            <div className="space-y-6 text-center py-4">
              <div className="h-14 w-14 rounded-full bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
                <HelpCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Xác nhận xóa bàn ăn?</h4>
                <p className="text-xs text-zinc-400 leading-relaxed px-4">
                  Bạn có chắc chắn muốn xóa **Bàn số {table?.tableNumber} ({table?.label})** khỏi hệ thống? 
                  Hành động này không thể hoàn tác và mã QR cũ sẽ mất hiệu lực vĩnh viễn.
                </p>
              </div>
              <div className="flex gap-3 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Không, giữ lại
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md shadow-red-950/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Đồng ý xóa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Form Add / Edit */}
              {(mode === 'add' || mode === 'edit') && (
                <TableForm
                  table={table}
                  mode={mode as 'add' | 'edit'}
                  onSuccess={handleUpdateSuccess}
                  onCancel={mode === 'add' ? onClose : () => setMode('view')}
                  onError={handleFormError}
                />
              )}

              {/* View Details Mode */}
              {mode === 'view' && table && (
                <div className="space-y-6">
                  {/* Metadata Summary */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800/80">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Tên hiển thị</p>
                      <h4 className="text-base font-extrabold text-white">{table.label}</h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadges[table.status].class}`}>
                      {statusBadges[table.status].label}
                    </span>
                  </div>

                  {/* Active Session Info if OCCUPIED */}
                  {table.status === 'OCCUPIED' && table.activeSession && (
                    <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-3">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                        <ShoppingBag className="h-4 w-4" />
                        Thông tin khách tại bàn
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-zinc-500 font-medium">Thời gian mở bàn</p>
                          <div className="flex items-center gap-1 text-xs text-zinc-300 font-semibold">
                            <Calendar className="h-3 w-3 text-red-500" />
                            {getSessionDuration(table.activeSession.openedAt)}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[10px] text-zinc-500 font-medium">Số món đã gọi</p>
                          <p className="text-xs text-zinc-300 font-bold font-mono">
                            {table.activeSession.orderItemsCount} món ăn
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Code Container */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Mã QR gọi món trực tiếp
                    </label>
                    <TableQRCode table={table} />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-3 border-t border-zinc-800/60">
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="h-10 px-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-red-950/20 hover:border-red-900/60 hover:text-red-400 text-zinc-400 flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa bàn
                    </button>

                    <button
                      onClick={() => setMode('edit')}
                      className="flex-1 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                      Sửa tên / Trạng thái
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
