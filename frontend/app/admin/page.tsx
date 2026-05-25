"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Clock, 
  Search, 
  Calendar, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  CreditCard,
  Wallet
} from "lucide-react";
import AdminTabs from "@/components/admin/AdminTabs";

interface Transaction {
  id: string;
  tableNo: string;
  customerName: string;
  amount: number;
  time: string;
  method: "Cash" | "MoMo" | "Card";
  status: "Completed" | "Preparing" | "Cancelled";
  itemsCount: number;
}

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "ORD-9482", tableNo: "Bàn số 04", customerName: "Nguyễn Hoàng Nam", amount: 375000, time: "20:30", method: "MoMo", status: "Completed", itemsCount: 4 },
  { id: "ORD-9481", tableNo: "Mang về #04", customerName: "Lê Thị Lan", amount: 125000, time: "20:15", method: "Cash", status: "Completed", itemsCount: 1 },
  { id: "ORD-9480", tableNo: "Bàn số 11", customerName: "Phạm Văn Minh", amount: 485000, time: "19:54", method: "Card", status: "Completed", itemsCount: 5 },
  { id: "ORD-9479", tableNo: "Bàn số 02", customerName: "Trần Thanh Thảo", amount: 215000, time: "19:40", method: "MoMo", status: "Preparing", itemsCount: 3 },
  { id: "ORD-9478", tableNo: "Bàn số 09", customerName: "Vũ Đức Huy", amount: 95000, time: "19:12", method: "Cash", status: "Completed", itemsCount: 1 },
  { id: "ORD-9477", tableNo: "Mang về #03", customerName: "Đặng Hồng Nhung", amount: 180000, time: "18:45", method: "Card", status: "Cancelled", itemsCount: 2 },
  { id: "ORD-9476", tableNo: "Bàn số 07", customerName: "Ngô Quốc Khánh", amount: 560000, time: "18:22", method: "MoMo", status: "Completed", itemsCount: 6 },
];

const HOURLY_SALES = [
  { hour: "10:00", value: 1200000, height: "30%" },
  { hour: "12:00", value: 3800000, height: "78%" },
  { hour: "14:00", value: 1800000, height: "45%" },
  { hour: "16:00", value: 1500000, height: "38%" },
  { hour: "18:00", value: 4500000, height: "92%" },
  { hour: "20:00", value: 5200000, height: "100%" },
  { hour: "22:00", value: 2100000, height: "50%" },
];

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Completed" | "Preparing" | "Cancelled">("All");

  const filteredTransactions = RECENT_TRANSACTIONS.filter(t => {
    const matchesSearch = t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.tableNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: Transaction["status"]) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Preparing":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Cancelled":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
  };

  const getMethodIcon = (method: Transaction["method"]) => {
    switch (method) {
      case "Cash":
        return <DollarSign className="h-3 w-3 text-zinc-400" />;
      case "MoMo":
        return <Wallet className="h-3 w-3 text-pink-400" />;
      case "Card":
        return <CreditCard className="h-3 w-3 text-blue-400" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

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
              <span className="font-bold tracking-tight text-lg text-white">Admin Analytics</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">Management Suite</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Hôm nay, 19 Tháng 5</span>
            </div>
            <button className="h-9 w-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Admin Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex justify-start">
          <AdminTabs />
        </div>

        {/* Row 1: KPI Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-medium">Doanh Thu Hôm Nay</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-2xl font-bold tracking-tight text-white">{formatCurrency(20350000)}</h3>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+12.4% so với hôm qua</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-medium">Đơn Hàng Đã Giao</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <ShoppingBag className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-2xl font-bold tracking-tight text-white">124 Đơn</h3>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+8.2% so với hôm qua</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-medium">Thời Gian Chế Biến TB</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-2xl font-bold tracking-tight text-white">11.4 Phút</h3>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />
                <span>Nhanh hơn 1.2p</span>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-medium">Khách Hàng Mới</span>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Users className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-2xl font-bold tracking-tight text-white">48 Khách</h3>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+15.3% so với hôm qua</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Left: Sales by Hours */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 lg:col-span-2 space-y-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Doanh Thu Theo Giờ</h2>
                <p className="text-xs text-zinc-400 font-light mt-0.5">Thống kê doanh số bán hàng trong ngày hôm nay.</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-violet-400 font-bold">
                Live Data
              </span>
            </div>

            {/* Custom Premium pure CSS Bar Chart */}
            <div className="flex items-end justify-between h-48 pt-6 border-b border-zinc-900 px-4">
              {HOURLY_SALES.map((data, index) => (
                <div key={index} className="flex flex-col items-center gap-2 group w-full relative">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 bg-zinc-900 text-[10px] font-mono font-bold text-white px-2 py-1 rounded border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-10">
                    {formatCurrency(data.value)}
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: data.height }}
                    className="w-8 sm:w-10 rounded-t-lg bg-gradient-to-t from-violet-600/20 to-violet-500 hover:from-violet-500 hover:to-fuchsia-400 transition-all duration-300 relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                  </div>
                  {/* Hour Label */}
                  <span className="text-[10px] text-zinc-500 font-mono mt-1">{data.hour}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Right: Sales Channels & Payments */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Phương Thức Thanh Toán</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Phân tích tỷ trọng dòng tiền hôm nay.</p>
            </div>

            {/* Horizontal progress visualization */}
            <div className="space-y-4 py-4">
              {/* MoMo */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-pink-500" />
                    Ví điện tử MoMo
                  </span>
                  <span className="font-mono text-zinc-400">45% (9.157k)</span>
                </div>
                <div className="h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-600 to-rose-500 rounded-full" style={{ width: "45%" }} />
                </div>
              </div>

              {/* Card */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Thẻ ngân hàng (Card)
                  </span>
                  <span className="font-mono text-zinc-400">35% (7.122k)</span>
                </div>
                <div className="h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" style={{ width: "35%" }} />
                </div>
              </div>

              {/* Cash */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Tiền mặt (Cash)
                  </span>
                  <span className="font-mono text-zinc-400">20% (4.071k)</span>
                </div>
                <div className="h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: "20%" }} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-900 text-[11px] text-zinc-500 font-light leading-relaxed">
              Tổng quan thanh toán được tính toán tự động dựa trên giao dịch POS đồng bộ.
            </div>
          </div>
        </div>

        {/* Row 3: Recent Transactions Data Table */}
        <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Giao Dịch Gần Đây</h2>
              <p className="text-xs text-zinc-400 font-light mt-0.5">Danh sách các hóa đơn vừa được thực hiện trong ngày.</p>
            </div>

            {/* Filter Tools */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Mã đơn, tên khách..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-1.5 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>

              {/* Status Selectors */}
              <div className="flex gap-1.5 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 shrink-0">
                {(["All", "Completed", "Preparing", "Cancelled"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      statusFilter === f 
                        ? "bg-violet-600 text-white" 
                        : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                    }`}
                  >
                    {f === "All" ? "Tất cả" : f === "Completed" ? "Đã xong" : f === "Preparing" ? "Đang làm" : "Đã hủy"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* High-Fidelity Data Table */}
          <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                  <th className="px-5 py-3">Mã Đơn Hàng</th>
                  <th className="px-5 py-3">Khách Hàng / Bàn</th>
                  <th className="px-5 py-3">Thời Gian</th>
                  <th className="px-5 py-3 text-center">Số Món</th>
                  <th className="px-5 py-3">Tổng Hóa Đơn</th>
                  <th className="px-5 py-3 text-center">Thanh Toán</th>
                  <th className="px-5 py-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {filteredTransactions.map(trans => (
                  <tr key={trans.id} className="hover:bg-zinc-900/20 transition-all">
                    <td className="px-5 py-3.5 font-mono font-bold text-white">{trans.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-200">{trans.customerName}</div>
                      <div className="text-[10px] text-zinc-500 font-light mt-0.5">{trans.tableNo}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-400">{trans.time}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-zinc-300">{trans.itemsCount}</td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-zinc-200">{formatCurrency(trans.amount)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 w-fit mx-auto font-medium">
                        {getMethodIcon(trans.method)}
                        <span>{trans.method}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusStyle(trans.status)}`}>
                        {trans.status === "Completed" ? "Thành công" : trans.status === "Preparing" ? "Đang nấu" : "Đã hủy"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-zinc-600 font-light">
                      Không tìm thấy giao dịch nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
