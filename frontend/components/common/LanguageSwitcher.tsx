'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/context/i18nContext';
import { Wrench, Check, Sparkles, Bot, TrendingUp, Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      
      {/* Floating Circular Action Button with Wrench Icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-[0_8px_30px_rgb(124,58,237,0.4)] border border-violet-400/30 flex items-center justify-center transition-all cursor-pointer group active:scale-90 hover:scale-105"
        title="Cài đặt Ngôn ngữ & Công cụ AI"
      >
        <Wrench className="w-5 h-5 text-white group-hover:rotate-45 transition-transform duration-300" />
        
        {/* Active Locale Badge */}
        <span className="absolute -top-1 -right-1 h-4 px-1.5 rounded-full bg-zinc-950 text-[9px] font-black text-violet-400 uppercase flex items-center justify-center shadow-md border border-violet-500/40">
          {locale}
        </span>
      </button>

      {/* Floating Popover Menu Above Wrench Button */}
      {isOpen && (
        <div className="absolute right-0 bottom-14 mb-2 w-64 rounded-2xl bg-zinc-900/95 border border-zinc-800/90 shadow-2xl backdrop-blur-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2 select-none">
          
          {/* Section 1: Ngôn Ngữ */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                Ngôn ngữ / Language
              </span>
              <span className="text-[9px] font-mono font-bold text-violet-400 uppercase">{locale}</span>
            </div>

            <div className="space-y-1 mt-1">
              <button
                type="button"
                onClick={() => { setLocale('vi'); setIsOpen(false); }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  locale === 'vi' 
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-xs' 
                    : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🇻🇳</span>
                  <span>Tiếng Việt</span>
                </div>
                {locale === 'vi' && <Check className="w-4 h-4 text-violet-400" />}
              </button>

              <button
                type="button"
                onClick={() => { setLocale('en'); setIsOpen(false); }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  locale === 'en' 
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-xs' 
                    : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🇬🇧</span>
                  <span>English</span>
                </div>
                {locale === 'en' && <Check className="w-4 h-4 text-violet-400" />}
              </button>
            </div>
          </div>

          {/* Section 2: AI Features Slot (Phase 2 Preview) */}
          <div className="pt-2 border-t border-zinc-800/80">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Trợ Lý AI
              </span>
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                Phase 2
              </span>
            </div>

            <div className="space-y-0.5 mt-1 opacity-60">
              <div className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 flex items-center justify-between cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-amber-400/80" />
                  <span className="text-[11px]">AI Gợi Ý Combo</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-500">Sắp có</span>
              </div>

              <div className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 flex items-center justify-between cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400/80" />
                  <span className="text-[11px]">AI Dự Báo Nguyên Liệu</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-500">Sắp có</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
