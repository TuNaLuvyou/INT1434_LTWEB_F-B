"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  RefreshCw, 
  Check, 
  X, 
  User, 
  Mail, 
  Phone,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import AdminTabs from "@/components/admin/AdminTabs";
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

interface ProfileRequest {
  id: string;
  userId: string;
  userName: string;
  currentName: string;
  currentEmail: string;
  pendingName: string;
  pendingEmail: string;
  pendingPhone: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const { user: currentUser } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getHeaders = (extraHeaders = {}) => {
    const token = getAccessTokenFromCookie();
    return {
      ...extraHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/profile-requests`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/profile-requests/${id}/${action}`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        alert(action === 'approve' ? 'Phê duyệt hồ sơ thành công!' : 'Đã từ chối yêu cầu.');
        fetchRequests();
      } else {
        const data = await res.json();
        alert(data.message || 'Lỗi xử lý yêu cầu');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Duyệt Hồ Sơ</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">HRM Approvals</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchRequests}
              className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="flex justify-start">
          <AdminTabs />
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Danh Sách Yêu Cầu Thay Đổi Thông Tin</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Phê duyệt hoặc từ chối các yêu cầu sửa đổi hồ sơ cá nhân của nhân viên.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 shrink-0">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    filter === f 
                      ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]" 
                      : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  {f === 'PENDING' ? 'Đang Chờ' : f === 'APPROVED' ? 'Đã Duyệt' : f === 'REJECTED' ? 'Đã Từ Chối' : 'Tất Cả'}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500 font-light text-sm">
              Đang tải danh sách yêu cầu...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 font-light text-sm border border-dashed border-zinc-900 rounded-2xl bg-zinc-950/10">
              Không có yêu cầu chỉnh sửa nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRequests.map(req => (
                <div 
                  key={req.id} 
                  className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4 hover:border-zinc-800 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs uppercase">
                          {req.userName.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{req.userName}</h4>
                          <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">ID: {req.userId.slice(0, 8)}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-wider ${
                        req.status === 'PENDING' 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : req.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {req.status === 'PENDING' ? 'Chờ duyệt' : req.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                      </span>
                    </div>

                    {/* Compare Cards */}
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      {/* Current profile info */}
                      <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-3 space-y-1.5">
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Hiện Tại</span>
                        <div className="space-y-1">
                          <div className="text-zinc-400 font-medium truncate">Tên: {req.currentName}</div>
                          <div className="text-zinc-400 font-medium truncate">Email: {req.currentEmail}</div>
                        </div>
                      </div>

                      {/* Requested profile info */}
                      <div className="bg-violet-950/15 border border-violet-900/20 rounded-xl p-3 space-y-1.5">
                        <span className="text-[8px] text-violet-400 font-bold uppercase tracking-wider block">Yêu Cầu Thay Đổi</span>
                        <div className="space-y-1 font-semibold">
                          <div className="text-white truncate">Tên: {req.pendingName}</div>
                          <div className="text-white truncate">Email: {req.pendingEmail}</div>
                          <div className="text-violet-300 truncate">SĐT: {req.pendingPhone}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                      <Clock className="h-3 w-3" />
                      Gửi vào {new Date(req.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  {/* Actions for Pending */}
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2 border-t border-zinc-900">
                      <button 
                        onClick={() => handleAction(req.id, 'reject')}
                        className="flex-1 py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1 uppercase tracking-wider"
                      >
                        <X className="h-3 w-3" /> Từ Chối
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, 'approve')}
                        className="flex-1 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-1 uppercase tracking-wider"
                      >
                        <Check className="h-3 w-3" /> Duyệt Thay Đổi
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
