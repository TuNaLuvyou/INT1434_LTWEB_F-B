"use client";

import { Sparkles } from "lucide-react";

interface FeatureLockProps {
  featureName: string;
  description?: string;
  /** overlay: che cả màn hình; inline: hiển thị trong 1 khối (dùng trong tab) */
  variant?: "overlay" | "inline";
}

/**
 * FeatureLock — UI "Tính năng chưa được hỗ trợ" kèm nút nâng cấp gói,
 * dùng chung cho các trang bị giới hạn theo gói cước.
 */
export default function FeatureLock({ featureName, description, variant = "overlay" }: FeatureLockProps) {
  const content = (
    <div className="relative flex flex-col items-center gap-4 max-w-md text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-violet-400" />
      </div>
      <h3 className="text-lg font-bold text-white">Tính năng chưa được hỗ trợ</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {description ||
          `Gói cước hiện tại của bạn không hỗ trợ tính năng ${featureName}. Vui lòng nâng cấp gói cước để sử dụng tính năng này.`}
      </p>
      <a
        href="/admin/settings"
        className="mt-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
      >
        Nâng cấp ngay
      </a>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        {content}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-zinc-950/60" />
      {content}
    </div>
  );
}