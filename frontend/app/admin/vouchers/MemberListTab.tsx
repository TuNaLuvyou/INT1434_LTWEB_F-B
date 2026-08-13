'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Edit3, Award, Phone, Calendar, Loader2, Save, X, Plus, Minus, CreditCard, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  points: number;
  accumulatedPoints: number;
  updatedAt: string;
  createdAt: string;
  membershipTier: {
    id: string;
    name: string;
    discountPercent: number;
    color: string | null;
  } | null;
  _count?: {
    payments: number;
  };
}

export default function MemberListTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Edit modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [pointsMode, setPointsMode] = useState<'SET' | 'ADD' | 'SUB'>('ADD');
  const [pointsVal, setPointsVal] = useState<number | ''>('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async (searchTerm = '') => {
    setLoading(true);
    try {
      const token = getAccessTokenFromCookie();
      const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const res = await fetch(`${API}/api/customer/list${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setCustomers(json.data || []);
        }
      } else {
        toast.error('Không thể lấy danh sách thành viên');
      }
    } catch (err) {
      console.error('Fetch customers error:', err);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const openEditModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setEditName(cust.name || '');
    setPointsMode('ADD');
    setPointsVal('');
    setAdjustNote('');
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      const token = getAccessTokenFromCookie();

      let deltaPoints: number | undefined = undefined;
      let setPoints: number | undefined = undefined;

      if (pointsVal !== '' && !isNaN(Number(pointsVal))) {
        const num = Number(pointsVal);
        if (pointsMode === 'ADD') {
          deltaPoints = Math.abs(num);
        } else if (pointsMode === 'SUB') {
          deltaPoints = -Math.abs(num);
        } else {
          setPoints = Math.max(0, num);
        }
      }

      const res = await fetch(`${API}/api/customer/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim() || null,
          points: setPoints,
          deltaPoints,
          note: adjustNote.trim() || 'Admin điều chỉnh điểm thủ công'
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Cập nhật thông tin thành viên thành công!');
        setSelectedCustomer(null);
        fetchCustomers(search);
      } else {
        toast.error(json.message || 'Cập nhật thất bại');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối khi cập nhật');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats calculation
  const totalMembers = customers.length;
  const totalPoints = customers.reduce((sum, c) => sum + c.points, 0);
  const totalAccumulated = customers.reduce((sum, c) => sum + c.accumulatedPoints, 0);

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tổng số thành viên</div>
            <div className="text-2xl font-black text-white mt-1">{totalMembers.toLocaleString('vi-VN')}</div>
            <div className="text-xs text-zinc-400 mt-0.5">Đã đăng ký qua SĐT</div>
          </div>
          <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-2xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Điểm khả dụng hiện tại</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{totalPoints.toLocaleString('vi-VN')} pts</div>
            <div className="text-xs text-zinc-400 mt-0.5">Có thể tiêu dùng</div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <Award className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tổng điểm tích lũy</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{totalAccumulated.toLocaleString('vi-VN')} pts</div>
            <div className="text-xs text-zinc-400 mt-0.5">Dùng xét mốc thăng hạng</div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Container: Search & Table */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-zinc-900">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-400" />
              Danh Sách Thành Viên Tích Điểm
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tất cả khách hàng đã nhập số điện thoại khi dùng bữa hoặc thanh toán tại quán.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Tìm theo SĐT hoặc Tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono"
              />
              <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
            >
              Tìm
            </button>
            <button
              type="button"
              onClick={() => { setSearch(''); fetchCustomers(''); }}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all shrink-0 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <span className="text-xs font-semibold">Đang tải danh sách thành viên...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-xs">
            {search ? 'Không tìm thấy thành viên phù hợp với từ khóa.' : 'Chưa có thành viên nào đăng ký SĐT.'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Khách Hàng / SĐT</th>
                  <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Hạng Thành Viên</th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Điểm Khả Dụng</th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Điểm Tích Lũy</th>
                  <th className="px-4 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Lượt Đơn</th>
                  <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Cập Nhật Gần Nhất</th>
                  <th className="px-4 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/20 transition-all">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-xs shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : <Phone className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {c.name || <span className="text-zinc-500 italic font-normal">Chưa nhập tên</span>}
                          </div>
                          <div className="text-[11px] font-mono text-violet-400 font-medium">
                            {c.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.membershipTier ? (
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border border-black/20"
                          style={{
                            backgroundColor: c.membershipTier.color || '#8b5cf6',
                            color: '#000000'
                          }}
                        >
                          {c.membershipTier.name} (-{c.membershipTier.discountPercent}%)
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-[11px] italic">Thành viên thường</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-400">
                      {c.points.toLocaleString('vi-VN')} <span className="text-[10px] font-normal text-zinc-500">pts</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                      {c.accumulatedPoints.toLocaleString('vi-VN')} <span className="text-[10px] font-normal text-zinc-500">pts</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-zinc-300">
                      {c._count?.payments ?? 0} đơn
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">
                      {new Date(c.updatedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => openEditModal(c)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-800 hover:border-violet-500/40 bg-zinc-950 text-zinc-300 hover:text-violet-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Sửa điểm / Tên
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Sửa Điểm / Tên Khách Hàng */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Chỉnh Sửa Thành Viên</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">{selectedCustomer.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Tên Khách Hàng
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: Anh Nam, Chị Hương..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-semibold"
                />
              </div>

              <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Điểm hiện tại:</span>
                  <span className="font-bold text-amber-400">{selectedCustomer.points.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Tổng điểm tích lũy:</span>
                  <span className="font-bold text-emerald-400">{selectedCustomer.accumulatedPoints.toLocaleString()} pts</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Thao tác chỉnh điểm
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPointsMode('ADD')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer ${
                      pointsMode === 'ADD'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Cộng
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointsMode('SUB')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer ${
                      pointsMode === 'SUB'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Minus className="h-3.5 w-3.5" /> Trừ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointsMode('SET')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer ${
                      pointsMode === 'SET'
                        ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Đặt Cố Định
                  </button>
                </div>

                <input
                  type="number"
                  min="0"
                  value={pointsVal}
                  onChange={(e) => setPointsVal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={pointsMode === 'SET' ? 'Số điểm mới...' : 'Số điểm thay đổi...'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Ghi chú điều chỉnh
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Lý do cộng/trừ điểm (Ví dụ: Thưởng sinh nhật...)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
