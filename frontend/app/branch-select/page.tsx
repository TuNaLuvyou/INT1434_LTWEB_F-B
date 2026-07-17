"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessTokenFromCookie, logout } from '@/lib/auth/client';
import { Store, Plus, X, Loader2, Building2, AlertTriangle, CheckCircle2, LogOut, Lock } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
  isLocked?: boolean;
}

export default function BranchSelectPage() {
  const router = useRouter();
  const { user, selectTenant, fetchCurrentUser } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getHeaders = () => {
    const token = getAccessTokenFromCookie();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.data || []);
      }
    } catch (e) {
      console.error('fetchBranches error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBranches();
    } else {
      // Chưa login, đợi user load
      const timer = setTimeout(() => {
        if (!useAuthStore.getState().user) {
          router.replace('/login');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleSelect = async (branchId: string) => {
    setSelectedId(branchId);
    setError('');
    const tenantId = user?.currentTenantId || user?.tenants?.[0]?.id;
    if (!tenantId) return;
    const ok = await selectTenant(tenantId, branchId);
    if (ok) {
      router.replace('/');
    } else {
      setError('Không thể chọn chi nhánh này. Vui lòng thử lại.');
      setSelectedId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), address: newAddress.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setBranches(prev => [...prev, data.data]);
        setShowCreate(false);
        setNewName('');
        setNewAddress('');
      } else {
        setError(data.message || 'Lỗi tạo chi nhánh');
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-600/30">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Chọn chi nhánh</h1>
          <p className="text-zinc-400 text-sm mt-2">{user?.name} — {user?.tenants?.[0]?.name}</p>
          <button
            onClick={() => logout()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-red-950/30 border border-zinc-700 hover:border-red-900/50 text-xs font-bold text-zinc-300 hover:text-red-300 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {branches.length === 0 && !showCreate && (
              <div className="text-center py-8 text-zinc-500">
                <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Chưa có chi nhánh nào</p>
                <p className="text-xs mt-1">Tạo chi nhánh đầu tiên để bắt đầu</p>
              </div>
            )}

            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => !branch.isLocked && handleSelect(branch.id)}
                disabled={selectedId === branch.id || branch.isLocked}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group disabled:opacity-60 ${
                  branch.isLocked
                    ? 'bg-zinc-900/30 border-zinc-800/50 cursor-not-allowed'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-violet-500/50 hover:bg-zinc-900/80 cursor-pointer'
                }`}
              >
                <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  branch.isLocked
                    ? 'bg-zinc-800/30 border-zinc-800 text-zinc-600'
                    : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                }`}>
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-zinc-300 truncate">{branch.name}</div>
                  {branch.isLocked ? (
                    <div className="text-[11px] text-rose-500 mt-1 italic">Chi nhánh bị khoá</div>
                  ) : branch.address ? (
                    <div className="text-[11px] text-zinc-500 mt-1 truncate leading-snug">{branch.address}</div>
                  ) : (
                    <div className="text-[11px] text-zinc-600 mt-1 italic">Chưa có địa chỉ</div>
                  )}
                </div>
                {branch.isLocked ? (
                  <Lock className="h-4 w-4 text-rose-500/60 shrink-0" />
                ) : selectedId === branch.id ? (
                  <Loader2 className="h-5 w-5 text-violet-500 animate-spin shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-zinc-700 group-hover:border-violet-500 transition-colors shrink-0" />
                )}
              </button>
            ))}

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {showCreate ? (
              <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <input
                  required
                  placeholder="Tên chi nhánh"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Địa chỉ (tuỳ chọn)"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-all"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Tạo chi nhánh
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full p-3 rounded-xl border-2 border-dashed border-zinc-800 hover:border-violet-500/50 text-zinc-500 hover:text-violet-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Thêm chi nhánh mới
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
