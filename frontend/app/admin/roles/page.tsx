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
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { useAuthStore } from '@/stores/auth.store';
import AdminHeader from '@/components/admin/AdminHeader';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER';
  branchId?: string | null;
  branchName?: string | null;
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

  // Branch state
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [updatingBranchUserId, setUpdatingBranchUserId] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'MANAGER' | 'KITCHEN' | 'CASHIER'>('CASHIER');
  const [newBranchId, setNewBranchId] = useState('');
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

  // Fetch users + branches
  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetch(`${API_URL}/api/branches`, {
        headers: getHeaders(),
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => setBranches(data.data || []))
        .catch(() => {});
    }
  }, [fetchUsers, currentUser]);

  // Fetch branches khi mở modal
  useEffect(() => {
    if (isModalOpen && branches.length === 0) {
      fetch(`${API_URL}/api/branches`, {
        headers: getHeaders(),
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => setBranches(data.data || []))
        .catch(() => {});
    }
  }, [isModalOpen]);

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

  const handleBranchChange = async (userId: string, branchId: string) => {
    setUpdatingBranchUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ branchId: branchId || null }),
        credentials: 'include',
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Lỗi cập nhật chi nhánh');
      }
    } catch (error) {
      toast.error('Lỗi kết nối khi cập nhật chi nhánh');
      console.error('handleBranchChange error:', error);
    } finally {
      setUpdatingBranchUserId(null);
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
      const body: any = {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      };
      // Gán branch cho staff
      if ((newRole === 'MANAGER' || newRole === 'KITCHEN' || newRole === 'CASHIER') && newBranchId) {
        body.branchId = newBranchId;
      }

      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
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
        setNewBranchId('');
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
      <AdminHeader
        title="Quản Lý Quyền Tài Khoản"
        icon={<ShieldAlert size={13} className="stroke-[2.5]" />}
        rightSide={
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0 active:scale-95 cursor-pointer"
              aria-label="Tạo tài khoản mới"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo Tài Khoản</span>
            </button>

            <button 
              onClick={fetchUsers}
              className="h-9 w-9 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0 cursor-pointer"
              aria-label="Tải lại danh sách"
            >
              <RefreshCw className="h-4 w-4 animate-spin-once" />
            </button>
          </div>
        }
      />

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">

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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Nhân Viên</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Email Đăng Ký</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Chi Nhánh</th>
                    <th className="px-5 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Vai Trò</th>
                    <th className="px-5 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Phân Quyền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 font-light">
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
                          {(u.role === 'MANAGER' || u.role === 'KITCHEN' || u.role === 'CASHIER') ? (
                            <select
                              disabled={updatingBranchUserId === u.id}
                              value={u.branchId || ''}
                              onChange={(e) => handleBranchChange(u.id, e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-all max-w-[140px] disabled:opacity-50"
                            >
                              <option value="">Chưa gán</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-zinc-600 text-xs italic">—</span>
                          )}
                        </td>
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
                          {u.id === currentUser.id ? (
                            <span className="text-xs font-semibold text-zinc-500">{u.role}</span>
                          ) : (
                            <select
                              disabled={updatingUserId === u.id}
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all max-w-[150px] disabled:opacity-50"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="MANAGER">MANAGER</option>

                              <option value="KITCHEN">KITCHEN</option>
                              <option value="CASHIER">CASHIER</option>
                            </select>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-5xl max-h-[92vh] bg-zinc-950 border border-zinc-800/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden text-zinc-100 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <User size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-50">Tạo Tài Khoản Nhân Viên Mới</h3>
                  <p className="text-xs text-zinc-400">Cấp quyền truy cập hệ thống và gán chi nhánh hoạt động</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/80 transition-all cursor-pointer"
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2-Column Form Body */}
            <form onSubmit={handleCreateUser} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {errorMessage && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <ShieldAlert size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* LEFT COLUMN: User Credentials */}
                  <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                    <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                      <User size={16} className="text-violet-400" />
                      <span>Thông tin đăng nhập</span>
                    </h4>

                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Họ và Tên <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Nguyễn Văn A"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Email Đăng Ký <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                        <input
                          type="email"
                          required
                          placeholder="name@hiaimenugo.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Mật Khẩu Ban Đầu <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                        <input
                          type="password"
                          required
                          placeholder="Tối thiểu 8 ký tự, 1 hoa, 1 số"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Roles & Branches & Preview */}
                  <div className="space-y-5 flex flex-col justify-between">
                    <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
                      <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-violet-400" />
                        <span>Phân quyền & Chi nhánh</span>
                      </h4>

                      {/* Role Select */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Vai Trò Hệ Thống</label>
                        <div className="relative">
                          <select
                            value={newRole}
                            onChange={(e) => { setNewRole(e.target.value as any); setNewBranchId(''); }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-4 pr-10 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all cursor-pointer font-semibold appearance-none"
                          >
                            <option value="CASHIER">CASHIER (Thu ngân POS)</option>
                            <option value="KITCHEN">KITCHEN (Màn hình bếp KDS)</option>
                            <option value="MANAGER">MANAGER (Quản lý cửa hàng)</option>
                            <option value="ADMIN">ADMIN (Quản trị viên toàn quyền)</option>
                          </select>
                          <ChevronDown className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                        </div>
                      </div>

                      {/* Branch Select */}
                      {(newRole === 'MANAGER' || newRole === 'KITCHEN' || newRole === 'CASHIER') && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Chi Nhánh Áp Dụng</label>
                          <div className="relative">
                            <select
                              value={newBranchId}
                              onChange={(e) => setNewBranchId(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-4 pr-10 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all cursor-pointer font-semibold appearance-none"
                            >
                              <option value="">-- Chọn chi nhánh --</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User Profile Preview Card */}
                    <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-3xl space-y-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Xem trước thông tin nhân viên</span>
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-extrabold text-zinc-100 text-sm">{newName || "Họ và tên nhân viên"}</h5>
                          <p className="text-xs font-semibold text-zinc-400">{newEmail || "email@domain.com"}</p>
                        </div>
                        <span className="text-xs font-black bg-violet-500/15 text-violet-300 border border-violet-500/30 px-3 py-1 rounded-xl">
                          {newRole}
                        </span>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 border border-zinc-800 text-zinc-400 rounded-2xl text-xs font-bold hover:bg-zinc-900 hover:text-zinc-200 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-2xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 shadow-xl shadow-violet-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...
                    </>
                  ) : (
                    "Tạo Tài Khoản Mới"
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
