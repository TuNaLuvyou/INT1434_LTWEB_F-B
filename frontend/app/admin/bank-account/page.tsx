"use client";

import { useState, useRef } from "react";
import BankAccountTab from "../settings/BankAccountTab";
import { CreditCard } from "lucide-react";
import { useI18n } from "@/context/i18nContext";
import AdminHeader from "@/components/admin/AdminHeader";

export default function BankAccountPage() {
  const { t } = useI18n();
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Cố định toàn bộ Header & Title khi cuộn */}
      <AdminHeader
        title={`${t('bankAccount')} & VietQR`}
        icon={<CreditCard size={13} className="stroke-[2.5]" />}
        rightSide={
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">
            VietQR POS
          </span>
        }
      />

      {/* Chỉ cuộn phần nội dung bên dưới - Ẩn thanh cuộn, hiện khi cuộn và tự động ẩn khi dừng */}
      <main
        onScroll={handleScroll}
        className={`flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 max-w-7xl w-full mx-auto relative z-10 scrollbar-auto-hide ${
          isScrolling ? "is-scrolling" : ""
        }`}
      >
        <BankAccountTab />
      </main>
    </div>
  );
}
