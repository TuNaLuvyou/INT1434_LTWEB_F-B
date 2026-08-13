"use client";

import type { ReactNode } from "react";

export interface AdminTabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface AdminTabsProps {
  items: AdminTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function AdminTabs({
  items,
  activeKey,
  onChange,
  className = "",
}: AdminTabsProps) {
  return (
    <div className={`flex items-center gap-1 border-b border-zinc-900 overflow-x-auto shrink-0 scrollbar-none ${className}`}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer rounded-t-xl border-b-2 ${
            activeKey === item.key
              ? "border-violet-500 text-violet-400 bg-violet-500/5"
              : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
