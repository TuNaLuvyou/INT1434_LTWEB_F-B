'use client';

import { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Edit2, Save, Loader2, RefreshCw, Sparkles, X, Eye, Percent, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface MembershipTier {
  id: string;
  name: string;
  minPoints: number;
  discountPercent: number;
  color?: string;
}

export default function MembershipTab() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // General point settings
  const [pointEarnRate, setPointEarnRate] = useState<number>(10000);
  const [pointRedeemRate, setPointRedeemRate] = useState<number>(100);
  const [pointResetPeriodMonths, setPointResetPeriodMonths] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinPoints, setFormMinPoints] = useState<number | ''>('');
  const [formDiscountPercent, setFormDiscountPercent] = useState<number | ''>('');
  const [formColor, setFormColor] = useState('#ffd700');
  const [isSubmittingTier, setIsSubmittingTier] = useState(false);

  const fetchTiers = async () => {
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/membership-tiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTiers(json.data || []);
        }
      }
    } catch (err) {
      console.error('Fetch tiers error:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/system/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPointEarnRate(json.data.pointEarnRate ?? 10000);
          setPointRedeemRate(json.data.pointRedeemRate ?? 100);
          setPointResetPeriodMonths(json.data.pointResetPeriodMonths !== null && json.data.pointResetPeriodMonths !== undefined ? String(json.data.pointResetPeriodMonths) : '');
        }
      }
    } catch (err) {
      console.error('Fetch config error:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchTiers(), fetchConfig()]);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/system/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pointEarnRate: Number(pointEarnRate),
          pointRedeemRate: Number(pointRedeemRate),
          pointResetPeriodMonths: pointResetPeriodMonths.trim() === '' ? null : Number(pointResetPeriodMonths),
        }),
      });

      if (res.ok) {
        toast.success('Đã lưu cấu hình tích điểm & reset!');
      } else {
        toast.error('Lưu cấu hình thất bại.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu cấu hình.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const openCreateModal = () => {
    setEditingTier(null);
    setFormName('');
    setFormMinPoints('');
    setFormDiscountPercent('');
    setFormColor('#ffd700');
    setIsModalOpen(true);
  };

  const openEditModal = (tier: MembershipTier) => {
    setEditingTier(tier);
    setFormName(tier.name);
    setFormMinPoints(tier.minPoints);
    setFormDiscountPercent(tier.discountPercent);
    setFormColor(tier.color || '#ffd700');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTier(null);
  };

  const handleSaveTier = async () => {
    if (!formName.trim()) {
      toast.error('Vui lòng nhập tên hạng thành viên.');
      return;
    }
    if (formMinPoints === '' || formMinPoints < 0) {
      toast.error('Điểm tối thiểu không hợp lệ.');
      return;
    }
    if (formDiscountPercent === '' || formDiscountPercent < 0 || formDiscountPercent > 100) {
      toast.error('% Giảm giá phải nằm trong khoảng từ 0 đến 100.');
      return;
    }

    setIsSubmittingTier(true);
    try {
      const token = getAccessTokenFromCookie();
      const url = editingTier ? `${API}/api/membership-tiers/${editingTier.id}` : `${API}/api/membership-tiers`;
      const method = editingTier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName.trim(),
          minPoints: Number(formMinPoints),
          discountPercent: Number(formDiscountPercent),
          color: formColor,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(editingTier ? 'Đã cập nhật hạng thành viên!' : 'Đã thêm hạng thành viên mới!');
        closeModal();
        fetchTiers();
      } else {
        toast.error(json.message || 'Lỗi xử lý hạng thành viên.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra.');
    } finally {
      setIsSubmittingTier(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hạng thành viên này?')) return;
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/membership-tiers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã xóa hạng thành viên.');
        fetchTiers();
      } else {
        toast.error(json.message || 'Không thể xóa.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-3" />
        <span className="text-xs font-semibold">Đang tải cấu hình hạng thành viên...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 1. Danh sách Hạng Thành Viên */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-zinc-900">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Cấu Hình Hạng Thành Viên & Giảm Giá Bill
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Khách hàng tích đủ mốc điểm sẽ tự động thăng hạng và được giảm % trực tiếp trên hóa đơn.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm Hạng Mới
          </button>
        </div>

        {tiers.length === 0 ? (
          <div className="text-center py-12 bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 space-y-2">
            <Award className="w-10 h-10 text-zinc-700 mx-auto" />
            <p className="text-zinc-400 font-medium text-xs">Chưa có hạng thành viên nào được tạo.</p>
            <p className="text-zinc-600 text-[11px]">Bấm "Thêm Hạng Mới" để tạo các mốc như Bạc, Vàng, Kim Cương...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="relative rounded-2xl border border-zinc-800/80 p-5 space-y-4 bg-zinc-950/60 hover:border-violet-500/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-black text-black shadow-sm"
                    style={{ backgroundColor: tier.color || '#e2e8f0' }}
                  >
                    {tier.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tier)}
                      className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTier(tier.id)}
                      className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-zinc-500 font-medium">Mốc điểm đạt hạng:</div>
                  <div className="text-xl font-black text-white font-mono">
                    {tier.minPoints.toLocaleString('vi-VN')} <span className="text-xs font-normal text-zinc-500">pts</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Ưu đãi giảm:</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg font-mono">
                    -{tier.discountPercent}% Bill
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Cấu hình quy đổi điểm & Reset điểm */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-6 space-y-6">
        <div className="pb-2 border-b border-zinc-900">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4.5 h-4.5 text-violet-400" />
            Quy Đổi Điểm & Thời Gian Tự Động Reset Điểm
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Thiết lập quy tắc tích điểm khi mua hàng và chu kỳ hết hạn điểm.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Tỷ lệ tích điểm (VNĐ / 1 điểm)
            </label>
            <input
              type="number"
              value={pointEarnRate}
              onChange={(e) => setPointEarnRate(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono font-bold"
              placeholder="10000"
            />
            <p className="text-[11px] text-zinc-500 mt-1">VD: 10.000 VNĐ tiêu dùng = 1 điểm tích lũy.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Tỷ lệ tiêu điểm (VNĐ / 1 điểm)
            </label>
            <input
              type="number"
              value={pointRedeemRate}
              onChange={(e) => setPointRedeemRate(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono font-bold"
              placeholder="100"
            />
            <p className="text-[11px] text-zinc-500 mt-1">VD: 1 điểm = 100 VNĐ khi đổi thành tiền giảm giá.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Chu kỳ reset điểm (Số tháng)
            </label>
            <input
              type="number"
              value={pointResetPeriodMonths}
              onChange={(e) => setPointResetPeriodMonths(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono font-bold"
              placeholder="Để trống = Không reset"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Để trống nếu không muốn tự động reset điểm tích lũy.</p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-900">
          <button
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] cursor-pointer"
          >
            {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu Thiết Lập Quy Đổi Điểm
          </button>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh Sửa Hạng Thành Viên (Chuẩn giao diện Hệ Thống) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-zinc-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingTier ? 'Chỉnh Sửa Hạng Thành Viên' : 'Thêm Hạng Thành Viên Mới'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {editingTier ? 'Cập nhật thông tin mốc điểm và ưu đãi hạng.' : 'Tạo mới hạng thành viên và cấu hình mức giảm giá.'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Card 1: Thông tin hạng thành viên */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 text-xs font-bold text-white">
                    <Award className="w-4 h-4 text-violet-400" />
                    <span>Thông tin hạng thành viên</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      TÊN HẠNG <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ví dụ: Vàng, Kim Cương, VIP..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-semibold transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      MỐC ĐIỂM TỐI THIỂU *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formMinPoints}
                        onChange={(e) => setFormMinPoints(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono font-bold transition-all"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-zinc-500 font-mono font-semibold">pts</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Ưu đãi & Cấu hình giao diện */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 text-xs font-bold text-white">
                    <Percent className="w-4 h-4 text-emerald-400" />
                    <span>Ưu đãi & Thể hiện giao diện</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      NGƯỠNG % GIẢM GIÁ BILL *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formDiscountPercent}
                        onChange={(e) => setFormDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-10 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono font-bold transition-all"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-zinc-500 font-mono font-semibold">%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      MÀU BADGE HẠNG
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Đồng', color: '#cd7f32' },
                        { name: 'Bạc', color: '#c0c0c0' },
                        { name: 'Vàng', color: '#ffd700' },
                        { name: 'Kim Cương', color: '#38bdf8' },
                        { name: 'Ngọc Bích', color: '#34d399' },
                        { name: 'Tím', color: '#a855f7' },
                      ].map((chip) => (
                        <button
                          key={chip.color}
                          type="button"
                          onClick={() => setFormColor(chip.color)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                            formColor.toLowerCase() === chip.color.toLowerCase()
                              ? 'border-white scale-105 shadow-sm'
                              : 'border-zinc-800 opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: chip.color, color: '#000000' }}
                        >
                          {chip.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="color"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-800 bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Card: Live Preview */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">XEM TRƯỚC HẠNG THÀNH VIÊN</div>
                  <div className="text-xs font-bold text-white mt-1">
                    {formName ? formName : 'Tên hạng'}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Mốc điểm: <span className="font-mono text-white font-bold">{formMinPoints ? Number(formMinPoints).toLocaleString() : 0} pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-3.5 py-1.5 rounded-full text-xs font-black text-black shadow-md uppercase tracking-wider"
                    style={{ backgroundColor: formColor || '#ffd700' }}
                  >
                    {formName || 'TÊN HẠNG'}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                    -{formDiscountPercent || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-zinc-900 bg-zinc-950 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveTier}
                disabled={isSubmittingTier}
                className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingTier && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu Cập Nhật
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
