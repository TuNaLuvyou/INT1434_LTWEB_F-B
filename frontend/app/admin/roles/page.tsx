"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  RefreshCw, 
  Shield, 
  ShieldAlert, 
  Mail, 
  User, 
  Check, 
  ArrowRight
} from 'lucide-react';
import AdminTabs from "@/components/admin/AdminTabs";
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CASHIER';
}

export default function RolesPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getHeaders = (extraHeaders = {}) => {
    const token = getAccessTokenFromCookie();
    return {
      ...extraHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  // Restrict page strictly to ADMIN role
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.push('/admin');
    }
  }, [currentUser, router]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/devices/users`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/devices/users/${userId}/role`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });
      if (res.ok) {
        alert('Cập nhật quyền thành công!');
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Lỗi cập nhật quyền');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-white">Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-zinc-500 font-light">Chỉ tài khoản Quản Trị Viên (Admin) mới có quyền truy cập chức năng phân quyền.</p>
          <Link href="/admin" className="inline-block px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white hover:bg-zinc-800 transition-all">
            Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

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
              <span className="font-bold tracking-tight text-lg text-white">Phân Quyền</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold tracking-wider uppercase">Admin Control</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchUsers}
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
          <div>
            <h2 className="text-base font-bold text-white">Quản Lý Quyền Tài Khoản</h2>
            <p className="text-xs text-zinc-400 font-light mt-0.5">Thay đổi vai trò quyền lực của các tài khoản nhân viên trong hệ thống RestoFlow.</p>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-zinc-500 font-light text-sm">
              Đang tải danh sách tài khoản...
            </div>
          ) : (
            <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3">Nhân Viên</th>
                    <th className="px-5 py-3">Email Đăng Ký</th>
                    <th className="px-5 py-3">Vai Trò Hiện Tại</th>
                    <th className="px-5 py-3 text-right">Phân Quyền Mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-zinc-900/20 transition-all">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-2xs uppercase">
                            {u.name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">{u.name}</span>
                            <span className="text-[9px] text-zinc-600 font-mono block mt-0.5">ID: {u.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-300 font-light">{u.email}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
                          u.role === 'ADMIN' 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : u.role === 'MANAGER'
                            ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <select
                          disabled={updatingUserId === u.id || u.id === currentUser.id}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all max-w-[150px] disabled:opacity-50"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="STAFF">STAFF</option>
                          <option value="KITCHEN">KITCHEN</option>
                          <option value="CASHIER">CASHIER</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
