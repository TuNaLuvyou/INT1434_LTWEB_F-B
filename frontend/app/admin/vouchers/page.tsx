"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ticket,
  Percent,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  TrendingDown,
  UserCheck
} from "lucide-react";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

interface Voucher {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  maxUsage: number | null;
  usedCount: number;
  isActive: boolean;
  expiredAt: string | null;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form States
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUsage, setMaxUsage] = useState("");
  const [expiredAt, setExpiredAt] = useState("");

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "dd/mm/yyyy";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const fetchVouchers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/vouchers`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setVouchers(result.data || []);
      } else {
        setErrorMsg(result.message || "Không thể tải danh sách voucher.");
      }
    } catch (err) {
      console.error("[Voucher Admin] Lỗi fetch:", err);
      setErrorMsg("Lỗi kết nối server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue: Number(discountValue),
          maxUsage: maxUsage ? parseInt(maxUsage) : undefined,
          expiredAt: expiredAt ? new Date(expiredAt).toISOString() : undefined,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(result.message || "Tạo mã voucher thành công!");
        // Reset Form
        setCode("");
        setDiscountValue("");
        setMaxUsage("");
        setExpiredAt("");
        fetchVouchers();
      } else {
        setErrorMsg(result.message || "Không thể tạo voucher.");
      }
    } catch (err) {
      setErrorMsg("Lỗi kết nối server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVoucher = async (id: string, codeStr: string) => {
    if (!confirm(`Bạn chắc chắn muốn xóa hoặc vô hiệu hóa voucher "${codeStr}"?`)) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API_URL}/api/vouchers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(`Voucher "${codeStr}" đã được xử lý thành công.`);
        fetchVouchers();
      } else {
        setErrorMsg(result.message || "Không thể xóa voucher.");
      }
    } catch (err) {
      setErrorMsg("Lỗi kết nối server.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pl-16 lg:pl-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">Quản Lý Voucher</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">
                Marketing
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-3 sm:p-6 space-y-4 max-w-7xl w-full mx-auto">

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-sm text-rose-400 shrink-0">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-sm text-emerald-400 shrink-0">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 gap-6">
          {/* Form Create Voucher (Left side) */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 space-y-4 shrink-0">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-violet-400" />
                Thêm Voucher Mới
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Tạo mã ưu đãi giảm giá phần trăm hoặc số tiền cố định.</p>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              {/* Code */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Mã giảm giá (String)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: WINTER25, GIAM30"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono uppercase tracking-widest"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Loại hình giảm giá</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDiscountType("PERCENT")}
                    className={`rounded-xl border py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${discountType === "PERCENT"
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-400 font-bold"
                      : "border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Phần trăm (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("FIXED")}
                    className={`rounded-xl border py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${discountType === "FIXED"
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-400 font-bold"
                      : "border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                      }`}>
                    Số tiền cố định
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Mức giảm giá {discountType === "PERCENT" ? "(%)" : "(VND)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max={discountType === "PERCENT" ? "100" : undefined}
                    placeholder={discountType === "PERCENT" ? "Ví dụ: 15, 30" : "Ví dụ: 50000, 100000"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-zinc-500 font-mono">
                    {discountType === "PERCENT" ? "%" : "đ"}
                  </span>
                </div>
              </div>

              {/* Max Usage */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Lượt sử dụng tối đa (Bỏ trống = Vô hạn)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ví dụ: 50, 100"
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-all font-mono"
                />
              </div>

              {/* Expiration date */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Ngày hết hạn (Bỏ trống = Không hết hạn)
                </label>
                <div 
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
                    if (input) {
                      try {
                        input.showPicker();
                      } catch (err) {
                        input.focus();
                      }
                    }
                  }}
                  className="relative w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs focus-within:border-violet-500 transition-all cursor-pointer flex items-center justify-between"
                >
                  <span className="text-zinc-100 font-mono select-none">
                    {expiredAt ? formatDateString(expiredAt) : "dd/mm/yyyy"}
                  </span>
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <input
                    type="date"
                    value={expiredAt}
                    onChange={(e) => setExpiredAt(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Tạo Voucher
              </button>
            </form>
          </div>

          {/* List of Vouchers (Right side) */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 lg:col-span-2 flex flex-col space-y-4 flex-1 min-h-[400px]">
            <div className="shrink-0">
              <h2 className="text-base font-bold text-white">Danh Sách Voucher</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Quản lý các mã giảm giá đang hoạt động hoặc đã lưu vết trong hệ thống.
              </p>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500 font-light">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <span>Đang tải danh sách voucher...</span>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-600 font-light text-xs">
                <Ticket className="h-10 w-10 stroke-[1] text-zinc-700" />
                <span>Chưa có mã giảm giá nào được tạo.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent" style={{ maxHeight: '65vh' }}>
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                      <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Mã Code</th>
                      <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Mức Giảm</th>
                      <th className="px-4 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Đã Dùng / Giới Hạn</th>
                      <th className="px-4 py-3 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Ngày Hết Hạn</th>
                      <th className="px-4 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Trạng Thái</th>
                      <th className="px-4 py-3 text-center sticky top-0 bg-zinc-950/90 backdrop-blur z-10">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-xs">
                    {vouchers.map((v) => {
                      const valueNum = Number(v.discountValue);
                      const isExpired = v.expiredAt ? new Date() > new Date(v.expiredAt) : false;
                      const isExhausted = v.maxUsage !== null && v.usedCount >= v.maxUsage;
                      const active = v.isActive && !isExpired && !isExhausted;

                      return (
                        <tr key={v.id} className="hover:bg-zinc-900/10 transition-all">
                          <td className="px-4 py-3.5 font-mono font-bold text-violet-400 tracking-wider">
                            <span className="bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20">
                              {v.code}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-white">
                            {v.discountType === "PERCENT"
                              ? `${valueNum}%`
                              : formatCurrency(valueNum)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono text-zinc-300">
                            {v.usedCount} / {v.maxUsage !== null ? v.maxUsage : "∞"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-zinc-400">
                            {v.expiredAt
                              ? new Date(v.expiredAt).toLocaleDateString("vi-VN")
                              : "Không thời hạn"}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                }`}
                            >
                              {active ? "Hoạt động" : "Hết hạn/Khóa"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(v.id, v.code)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg border border-zinc-900 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-all"
                              title="Xóa/Khóa mã voucher"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
