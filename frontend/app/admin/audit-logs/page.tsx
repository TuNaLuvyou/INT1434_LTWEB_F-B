'use client';

import { useEffect, useState } from 'react';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import { Loader2, Search, Filter, Shield, Activity, Calendar } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const fetchLogs = async () => {
    try {
      const token = getAccessTokenFromCookie();
      const res = await fetch(`${API}/api/platform-admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const actions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entityId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    if (action?.includes('CREATE') || action?.includes('create')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (action?.includes('DELETE') || action?.includes('delete')) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (action?.includes('UPDATE') || action?.includes('update')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (action?.includes('LOGIN') || action?.includes('login')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50';
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      <AdminHeader
        title="Audit Logs"
        icon={<Shield className="h-3.5 w-3.5" />}
        rightSide={
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold tracking-wider uppercase">
            Activity
          </span>
        }
      />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm kiếm hành động, thực thể..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-2 pl-8 pr-4 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all"
              />
            </div>

            <div className="flex gap-1 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 overflow-x-auto flex-wrap">
              <button
                onClick={() => setActionFilter('ALL')}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  actionFilter === 'ALL' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                }`}
              >
                Tất cả
              </button>
              {actions.slice(0, 10).map(action => (
                <button
                  key={action}
                  onClick={() => setActionFilter(action)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    actionFilter === action ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  {action?.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin h-8 w-8 text-violet-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/80">
                      <th className="px-5 py-3">Thời gian</th>
                      <th className="px-5 py-3">Tenant</th>
                      <th className="px-5 py-3">Hành động</th>
                      <th className="px-5 py-3">Thực thể</th>
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-xs">
                    {filteredLogs.map((log: any, idx: number) => (
                      <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-5 py-3 font-mono text-zinc-400">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-zinc-200">{log.tenant?.name || 'N/A'}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${getActionColor(log.action)}`}>
                            {log.action?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-zinc-300">{log.entity}</td>
                        <td className="px-5 py-3 font-mono text-zinc-500 text-[10px]">{log.entityId?.slice(0, 12)}...</td>
                        <td className="px-5 py-3 text-zinc-400 max-w-[200px] truncate">
                          {log.details ? JSON.stringify(log.details).slice(0, 80) + '...' : '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-zinc-600 font-light">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Không tìm thấy audit logs nào.
                        </td>
                      </tr>
                    )}
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
