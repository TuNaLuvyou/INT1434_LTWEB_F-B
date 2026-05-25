"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Calendar, 
  RefreshCw, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Clock, 
  User
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AdminTabs from "@/components/admin/AdminTabs";
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from "@/lib/api/admin";

const scheduleSchema = z.object({
  employeeId: z.string().min(1, "ID nhân viên không được để trống"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng YYYY-MM-DD"),
  startTime: z.string().min(1, "Giờ bắt đầu không được để trống"),
  endTime: z.string().min(1, "Giờ kết thúc không được để trống"),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;

export default function AdminSchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(scheduleSchema),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchedules();
      setSchedules(data?.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = async (values: any) => {
    try {
      if (editItem) {
        await updateSchedule(editItem.id, values);
      } else {
        await createSchedule(values);
      }
      closeModal();
      loadData();
    } catch (err) {
      alert("Đã xảy ra lỗi khi lưu lịch làm việc!");
    }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    reset({
      employeeId: item.employeeId,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditItem(null);
    reset({
      employeeId: "",
      date: "",
      startTime: "",
      endTime: "",
    });
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa lịch làm việc này?")) return;
    try {
      await deleteSchedule(id);
      loadData();
    } catch (err) {
      alert("Lỗi khi xóa lịch!");
    }
  };

  const filteredSchedules = schedules.filter(sch => 
    sch.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sch.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <span className="font-bold tracking-tight text-lg text-white">Quản Lý Lịch Làm Việc</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Lịch trực</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Hôm nay, 19 Tháng 5</span>
            </div>
            <button onClick={loadData} className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex justify-start">
          <AdminTabs />
        </div>

        {/* Action Bar */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Lịch Trực Ca Nhân Viên</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Lên kế hoạch ca trực, giờ bắt đầu và giờ kết thúc của toàn bộ nhân viên.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Tìm nhân viên..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>

              {/* Add New Button */}
              <button 
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm Lịch Trực</span>
              </button>
            </div>
          </div>

          {/* High-Fidelity Data Table */}
          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3">Nhân Viên</th>
                  <th className="px-5 py-3">Ngày Trực</th>
                  <th className="px-5 py-3">Giờ Bắt Đầu</th>
                  <th className="px-5 py-3">Giờ Kết Thúc</th>
                  <th className="px-5 py-3 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-zinc-500 font-light">
                      Đang tải danh sách lịch làm việc...
                    </td>
                  </tr>
                ) : filteredSchedules.map(sch => (
                  <tr key={sch.id} className="hover:bg-zinc-900/20 transition-all">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{sch.user?.name || "Chưa gán"}</div>
                      <div className="text-[10px] text-zinc-500 font-light mt-0.5">{sch.employeeId}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-200">
                      {new Date(sch.date).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-300">{sch.startTime}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-300">{sch.endTime}</td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEdit(sch)}
                          className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                          title="Sửa lịch"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(sch.id)}
                          className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/25 transition-all"
                          title="Xóa lịch"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredSchedules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-zinc-600 font-light">
                      Không tìm thấy lịch trực nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Dark Theme Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden">
            {/* Modal Glows */}
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[60px] pointer-events-none" />
            
            <h2 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              {editItem ? "Chỉnh Sửa Ca Trực" : "Thêm Lịch Trực Mới"}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">ID Nhân Viên</label>
                <input
                  type="text"
                  placeholder="Nhập ID nhân viên..."
                  {...register("employeeId")}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
                {errors.employeeId?.message && (
                  <p className="text-rose-500 text-[10px] mt-1">{String(errors.employeeId.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Ngày Trực</label>
                <input
                  type="date"
                  {...register("date")}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-all [color-scheme:dark]"
                />
                {errors.date?.message && (
                  <p className="text-rose-500 text-[10px] mt-1">{String(errors.date.message)}</p>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Bắt Đầu</label>
                  <input
                    type="time"
                    {...register("startTime")}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-all [color-scheme:dark]"
                  />
                  {errors.startTime?.message && (
                    <p className="text-rose-500 text-[10px] mt-1">{String(errors.startTime.message)}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Kết Thúc</label>
                  <input
                    type="time"
                    {...register("endTime")}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-all [color-scheme:dark]"
                  />
                  {errors.endTime?.message && (
                    <p className="text-rose-500 text-[10px] mt-1">{String(errors.endTime.message)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] disabled:opacity-60"
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
