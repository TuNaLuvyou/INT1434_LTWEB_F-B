"use client";

import type { ReactNode } from "react";

interface AdminHeaderProps {
  title: string;
  icon: ReactNode;
  badge?: string;
  rightSide?: ReactNode;
  bottomBar?: ReactNode;
  className?: string;
}

export default function AdminHeader({
  title,
  icon,
  badge = "Hệ thống HiAI-MenuGo • Admin Panel",
  rightSide,
  bottomBar,
  className = "",
}: AdminHeaderProps) {
  return (
    <header className={`border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 shrink-0 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pl-16 lg:pl-6 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-1">
              {icon}
              <span>{badge}</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent truncate pl-3">
              {title}
            </h1>
          </div>
          {rightSide && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">{rightSide}</div>
          )}
        </div>
        {bottomBar && <div className="mt-3">{bottomBar}</div>}
      </div>
    </header>
  );
}
