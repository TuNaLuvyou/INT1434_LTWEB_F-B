'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { subDays, format, isValid, parseISO } from 'date-fns';

export default function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const defaultFrom = subDays(new Date(), 30);
  const defaultTo = new Date();

  const currentFrom = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : defaultFrom;
  const currentTo = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : defaultTo;

  const [activeTab, setActiveTab] = useState<'7days' | '30days' | '90days' | 'custom'>(() => {
    if (!fromParam) return '30days';
    const diff = (currentTo.getTime() - currentFrom.getTime()) / (1000 * 3600 * 24);
    if (Math.round(diff) === 7) return '7days';
    if (Math.round(diff) === 30) return '30days';
    if (Math.round(diff) === 90) return '90days';
    return 'custom';
  });

  const updateUrl = useCallback((from: Date, to: Date, tab: '7days' | '30days' | '90days' | 'custom') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from.toISOString());
    params.set('to', to.toISOString());
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const setRange = (days: number, tab: '7days' | '30days' | '90days') => {
    const to = new Date();
    const from = subDays(to, days);
    updateUrl(from, to, tab);
  };

  const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
    if (!value) return;
    const newDate = new Date(value);
    if (!isValid(newDate)) return;
    
    if (type === 'from') {
      updateUrl(newDate, currentTo, 'custom');
    } else {
      updateUrl(currentFrom, newDate, 'custom');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
        <button
          onClick={() => setRange(7, '7days')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === '7days' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          7 ngày
        </button>
        <button
          onClick={() => setRange(30, '30days')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === '30days' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          30 ngày
        </button>
        <button
          onClick={() => setRange(90, '90days')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === '90days' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          90 ngày
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'custom' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Tùy chọn
        </button>
      </div>

      {activeTab === 'custom' && (
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={format(currentFrom, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('from', e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
          />
          <span className="text-zinc-500">-</span>
          <input 
            type="date" 
            value={format(currentTo, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('to', e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
          />
        </div>
      )}
    </div>
  );
}
