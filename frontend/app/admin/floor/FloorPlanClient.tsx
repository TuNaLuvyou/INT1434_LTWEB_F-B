'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Users, 
  Clock, 
  AlertCircle,
  Table as TableIcon,
  BellRing,
  Trash2,
  Edit2
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import TableModal from '@/components/floor/TableModal';

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

interface FloorPlanClientProps {
  initialTables: Table[];
  errorMsg: string | null;
}

export default function FloorPlanClient({ initialTables, errorMsg: initialError }: FloorPlanClientProps) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modal states
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'add' | 'edit'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Custom toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Lấy token và thiết lập Socket.io kết nối room "floor-plan"
  const token = typeof window !== 'undefined' ? (getAccessTokenFromCookie() || undefined) : undefined;
  const { socket, isConnected } = useSocket({
    room: 'floor-plan',
    token,
  });

  // 2. Đăng ký nhận thông báo thay đổi trạng thái bàn ăn qua Socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTableStatusChanged = (payload: { tableId: string; status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'; label?: string }) => {
      setTables((prev) => 
        prev.map((t) => 
          t.id === payload.tableId 
            ? { ...t, status: payload.status, label: payload.label || t.label } 
            : t
        )
      );
      
      // Hiển thị toast báo cập nhật
      const tableObj = tables.find(t => t.id === payload.tableId);
      const statuses = { AVAILABLE: 'Trống', OCCUPIED: 'Đang phục vụ', RESERVED: 'Đã đặt trước' };
      showToast({
        type: 'success',
        message: `Mạng lưới: Bàn số ${tableObj?.tableNumber || ''} đã chuyển sang "${statuses[payload.status]}"`,
      });
    };

    socket.on('table:status-changed', handleTableStatusChanged);
    return () => {
      socket.off('table:status-changed', handleTableStatusChanged);
    };
  }, [socket, isConnected, tables]);

  // Helper hiển thị Toast thông báo
  const showToast = useCallback((t: { type: 'success' | 'error'; message: string }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // 3. Tải lại danh sách bàn ăn thủ công từ Backend
  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = getAccessTokenFromCookie();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/tables`, {
        headers: {
          'Authorization': `Bearer ${accessToken || ''}`,
        },
      });
      if (!res.ok) throw new Error('Không thể đồng bộ dữ liệu với máy chủ.');
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setTables(result.data);
      } else {
        throw new Error('Dữ liệu bàn ăn không hợp lệ.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Lỗi kết nối sơ đồ bàn ăn.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Lọc danh sách bàn ăn dựa trên trạng thái và từ khóa tìm kiếm
  const filteredTables = tables.filter((table) => {
    const matchesSearch = 
      table.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      table.tableNumber.toString().includes(searchQuery);
    
    const matchesStatus = 
      statusFilter === 'ALL' || 
      table.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // 5. Thống kê bàn
  const totalCount = tables.length;
  const availableCount = tables.filter(t => t.status === 'AVAILABLE').length;
  const occupiedCount = tables.filter(t => t.status === 'OCCUPIED').length;
  const reservedCount = tables.filter(t => t.status === 'RESERVED').length;

  // 6. Xử lý phản hồi thành công từ CRUD Modal
  const handleModalSuccess = (updatedTable: Table, action: 'add' | 'edit' | 'delete') => {
    if (action === 'add') {
      setTables((prev) => [...prev, updatedTable].sort((a, b) => a.tableNumber - b.tableNumber));
    } else if (action === 'edit') {
      setTables((prev) => prev.map((t) => t.id === updatedTable.id ? { ...t, ...updatedTable } : t));
    } else if (action === 'delete') {
      setTables((prev) => prev.filter((t) => t.id !== updatedTable.id));
    }
  };

  const handleOpenAddModal = () => {
    setSelectedTable(null);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (table: Table) => {
    setSelectedTable(table);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const statusBadges = {
    AVAILABLE: { label: 'Trống', borderClass: 'border-emerald-800/80 bg-emerald-950/20 text-emerald-400' },
    OCCUPIED: { label: 'Đang phục vụ', borderClass: 'border-red-800/80 bg-red-950/20 text-red-400' },
    RESERVED: { label: 'Đã đặt', borderClass: 'border-amber-800/80 bg-amber-950/20 text-amber-400' }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 select-none">
      
      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-xl backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-zinc-950/90 border-emerald-500/30 text-emerald-400' 
              : 'bg-zinc-950/90 border-red-500/30 text-red-400'
          }`}>
            <div className={`h-2 w-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
            <p className="text-xs font-bold font-sans tracking-wide leading-none">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-3 shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/25">
            <TableIcon className="text-white h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white">SƠ ĐỒ BÀN ĂN</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                isConnected 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800' 
                  : 'bg-zinc-950/40 text-zinc-500 border-zinc-800'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                {isConnected ? 'Mạng Realtime' : 'Mất kết nối'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Quản lý không gian phục vụ và tạo mã QR Code bàn ăn.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={fetchTables}
            className="h-10 px-4 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900/80 text-zinc-200 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold shadow-md cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Đồng bộ
          </button>
          
          <button 
            onClick={handleOpenAddModal}
            className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md shadow-emerald-950/20 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5 stroke-[3]" />
            THÊM BÀN MỚI
          </button>
        </div>
      </header>

      {/* ─── QUICK METRICS STATS BAR ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
        <div className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900 shadow-sm flex items-center gap-4 hover:border-zinc-800 transition-all">
          <div className="h-12 w-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
            <span className="font-mono font-bold text-base text-white">{totalCount}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Tổng số bàn</p>
            <h4 className="text-sm font-extrabold text-zinc-300 mt-1">Hệ thống</h4>
          </div>
        </div>

        <div className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900 shadow-sm flex items-center gap-4 hover:border-zinc-800 transition-all">
          <div className="h-12 w-12 rounded-2xl bg-emerald-950/60 border border-emerald-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-md">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Bàn còn trống</p>
            <h4 className="text-sm font-extrabold text-zinc-300 mt-1">{availableCount} bàn trống</h4>
          </div>
        </div>

        <div className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900 shadow-sm flex items-center gap-4 hover:border-zinc-800 transition-all">
          <div className="h-12 w-12 rounded-2xl bg-red-950/60 border border-red-900 text-red-400 flex items-center justify-center shrink-0 shadow-md">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Đang phục vụ</p>
            <h4 className="text-sm font-extrabold text-zinc-300 mt-1">{occupiedCount} bàn có khách</h4>
          </div>
        </div>

        <div className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900 shadow-sm flex items-center gap-4 hover:border-zinc-800 transition-all">
          <div className="h-12 w-12 rounded-2xl bg-amber-950/60 border border-amber-900 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Đã đặt trước</p>
            <h4 className="text-sm font-extrabold text-zinc-300 mt-1">{reservedCount} đã đặt</h4>
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH BOX ─── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/20 p-4 rounded-2xl border border-zinc-900/80 shrink-0">
        
        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'Tất cả bàn' },
            { id: 'AVAILABLE', label: 'Còn trống' },
            { id: 'OCCUPIED', label: 'Đang phục vụ' },
            { id: 'RESERVED', label: 'Đặt trước' }
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20' 
                    : 'bg-zinc-900/40 text-zinc-500 hover:text-white hover:bg-zinc-900/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Tìm theo số bàn hoặc tên..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:bg-zinc-950/60 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* ─── ERROR STATE ─── */}
      {error && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-3xl p-6 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-red-950 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-red-400 text-sm">Lỗi đồng bộ dữ liệu</h3>
            <p className="text-xs text-red-300 leading-relaxed px-4">{error}</p>
          </div>
          <button 
            onClick={fetchTables}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Thử lại
          </button>
        </div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {!loading && !error && filteredTables.length === 0 && (
        <div className="bg-zinc-900/30 rounded-3xl border border-zinc-900 p-16 text-center max-w-md mx-auto space-y-5">
          <div className="h-14 w-14 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
            <TableIcon className="h-7 w-7" />
          </div>
          <div className="space-y-1 max-w-xs mx-auto">
            <h3 className="font-bold text-zinc-200 text-sm">Không tìm thấy bàn ăn</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {tables.length === 0 
                ? 'Hệ thống nhà hàng chưa được thiết lập bất kỳ bàn ăn nào. Hãy thêm bàn ăn đầu tiên ngay!' 
                : 'Không có bàn nào phù hợp với bộ lọc tìm kiếm hiện tại của bạn.'}
            </p>
          </div>
          {tables.length === 0 && (
            <button 
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Tạo bàn ăn đầu tiên
            </button>
          )}
        </div>
      )}

      {/* ─── GRID TABLE MAP ─── */}
      {!loading && !error && filteredTables.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {filteredTables.map((table) => {
            const badge = statusBadges[table.status];
            
            return (
              <button
                key={table.id}
                onClick={() => handleOpenViewModal(table)}
                aria-label={`Bàn số ${table.tableNumber} - ${badge.label}`}
                className="group relative text-left block w-full overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-900/40 p-6 transition-all duration-300 hover:scale-[1.01] hover:border-zinc-800 hover:bg-zinc-900/60 shadow-xl cursor-pointer"
              >
                {/* Visual Glow Highlight */}
                <div className={`absolute -right-24 -top-24 h-48 w-48 rounded-full opacity-0 blur-[60px] transition-all duration-500 group-hover:opacity-15 group-hover:-translate-x-6 group-hover:translate-y-6 ${
                  table.status === 'AVAILABLE' ? 'bg-emerald-500' : table.status === 'OCCUPIED' ? 'bg-red-500' : 'bg-amber-500'
                }`} />

                <div className="space-y-4 relative z-10">
                  {/* Status Badge & Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">
                      BÀN #{table.tableNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${badge.borderClass}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Table Label */}
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                      {table.label}
                    </h3>
                    
                    {table.status === 'OCCUPIED' && table.activeSession ? (
                      <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        Đang chuẩn bị {table.activeSession.orderItemsCount} món ăn
                      </p>
                    ) : (
                      <p className="text-[10px] text-zinc-600 font-medium">Bấm vào để xem mã QR</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend bar */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-zinc-900 text-xs font-semibold text-zinc-500 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
          <span>Xanh lá: Còn trống</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/40" />
          <span>Đỏ: Đang phục vụ khách</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
          <span>Vàng: Đã đặt trước</span>
        </div>
      </div>

      {/* ─── TABLE DETAILED CRUD MODAL ─── */}
      {isModalOpen && (
        <TableModal
          table={selectedTable}
          mode={modalMode}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleModalSuccess}
          onToast={showToast}
        />
      )}

    </div>
  );
}
