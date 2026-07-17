"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  RefreshCw, 
  ShieldAlert, 
  Mail, 
  User, 
  Plus, 
  X, 
  Lock, 
  Loader2,
  ChevronDown,
  Search
} from 'lucide-react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';
}

export default function RolesPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER'>('CASHIER');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: getHeaders({
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }),
        credentials: 'include',
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      } else {
        console.error("fetchUsers failed with status:", res.status);
      }
    } catch (error) {
      console.error("fetchUsers error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  // Fetch users ONLY when current authenticated user is loaded/available (solves token refresh race conditions)
  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [fetchUsers, currentUser]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PATCH',
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Client-side validations
    if (!newName.trim() || !newEmail.trim() || !newPassword || !newRole) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setErrorMessage('Mật khẩu phải chứa ít nhất 1 chữ viết hoa.');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setErrorMessage('Mật khẩu phải chứa ít nhất 1 số.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Tạo tài khoản nhân viên thành công!');
        setIsModalOpen(false);
        // Clear inputs
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('CASHIER');
        fetchUsers();
      } else {
        setErrorMessage(data.message || 'Lỗi khi tạo tài khoản.');
      }
    } catch (err) {
      setErrorMessage('Lỗi kết nối tới máy chủ.');
    } finally {
      setIsCreating(false);
    }
  };

  // Perform memory filtering based on Search Query and Role Filter
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-white">Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-zinc-500 font-light">Chỉ tài khoản Quản Trị Viên (Admin) mới có quyền truy cập chức năng phân quyền.</p>
          <Link href="/admin/dashboard" className="inline-block px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white hover:bg-zinc-800 transition-all">
            Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pl-16 lg:pl-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-lg text-white">Phân Quyền</span>
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold tracking-wider uppercase">Admin Control</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold p-2 sm:px-4 sm:py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0 active:scale-95"
              aria-label="Tạo tài khoản mới"
            >
              <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Tạo Tài Khoản</span>
            </button>

            <button 
              onClick={fetchUsers}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0"
              aria-label="Tải lại danh sách"
            >
              <RefreshCw className="h-4 w-4 animate-spin-once" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="shrink-0 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Quản Lý Quyền Tài Khoản</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Thay đổi vai trò quyền lực của các tài khoản nhân viên trong hệ thống HiAI-MenuGo.</p>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between pb-1">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Tìm tên hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
              />
            </div>

            <div className="relative w-full sm:max-w-[180px]">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2 pl-3.5 pr-10 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all cursor-pointer font-medium appearance-none"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>

                <option value="KITCHEN">KITCHEN</option>
                <option value="CASHIER">CASHIER</option>
              </select>
              <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 font-light text-sm">
              Đang tải danh sách tài khoản...
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân Viên</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Email Đăng Ký</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Vai Trò Hiện Tại</th>
                    <th className="px-5 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Phân Quyền Mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-zinc-500 font-light">
                        Không tìm thấy tài khoản nhân viên nào khớp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
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

                            <option value="KITCHEN">KITCHEN</option>
                            <option value="CASHIER">CASHIER</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-[28px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-extrabold text-white">Tạo Tài Khoản Mới</h3>
                <p className="text-[11px] text-zinc-300 font-normal mt-1">Thêm nhân viên mới vào hệ thống HiAI-MenuGo.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 animate-shake">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 block">Họ và Tên</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 block">Email Đăng Ký</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@hiaimenugo.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 block">Mật Khẩu Ban Đầu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 8 ký tự, 1 hoa, 1 số"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 block">Vai Trò Hệ Thống</label>
                <div className="relative">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/10 transition-all cursor-pointer font-medium appearance-none"
                  >

                    <option value="CASHIER">CASHIER (Thu ngân)</option>
                    <option value="KITCHEN">KITCHEN (Đầu bếp)</option>
                    <option value="MANAGER">MANAGER (Quản lý)</option>
                    <option value="ADMIN">ADMIN (Quản trị viên)</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3 h-4 w-4 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-850/40 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition-all active:scale-95"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-95 min-w-[120px]"
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Tạo tài khoản</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
