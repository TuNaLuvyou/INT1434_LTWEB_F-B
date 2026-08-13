'use client';

import React, { useEffect, useState } from 'react';
import { platformAdminApi } from '../../lib/api/platform-admin';
import toast from 'react-hot-toast';
import { ArrowLeft, Server, Activity, Building, AlertTriangle, Shield, CheckCircle2, Plus, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function PlatformAdminClient() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tenants' | 'logs'>('tenants');

  // Pending changes draft state
  const [pendingChanges, setPendingChanges] = useState<Record<string, { subscription?: string; isActive?: boolean }>>({});
  const [savingChanges, setSavingChanges] = useState(false);

  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', domain: '', ownerEmail: '', ownerName: '', ownerPassword: '', ownerPhone: '' });
  
  // Edit state
  const [editingTenant, setEditingTenant] = useState<{ id: string; name: string; domain: string; ownerEmail?: string; ownerName?: string; ownerPassword?: string; ownerPhone?: string; isActive?: boolean; subscription?: string } | null>(null);
  const [editTab, setEditTab] = useState<'info' | 'owner' | 'settings'>('info');

  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantData, logData] = await Promise.all([
        platformAdminApi.getTenants(),
        platformAdminApi.getAuditLogs()
      ]);
      setTenants(tenantData);
      setAuditLogs(logData);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDraftSubscriptionChange = (tenantId: string, newPlan: string, currentPlan: string) => {
    setPendingChanges(prev => {
      const tenantDraft = prev[tenantId] || {};
      if (newPlan === currentPlan) {
        const { subscription, ...rest } = tenantDraft;
        if (Object.keys(rest).length === 0) {
          const { [tenantId]: _, ...next } = prev;
          return next;
        }
        return { ...prev, [tenantId]: rest };
      }
      return {
        ...prev,
        [tenantId]: { ...tenantDraft, subscription: newPlan }
      };
    });
  };

  const handleDraftStatusChange = (tenantId: string, currentStatus: boolean) => {
    setPendingChanges(prev => {
      const tenantDraft = prev[tenantId] || {};
      const currentDraftActive = tenantDraft.isActive !== undefined ? tenantDraft.isActive : currentStatus;
      const newStatus = !currentDraftActive;
      
      if (newStatus === currentStatus) {
        const { isActive, ...rest } = tenantDraft;
        if (Object.keys(rest).length === 0) {
          const { [tenantId]: _, ...next } = prev;
          return next;
        }
        return { ...prev, [tenantId]: rest };
      }

      return {
        ...prev,
        [tenantId]: { ...tenantDraft, isActive: newStatus }
      };
    });
  };

  const handleSaveAllChanges = async () => {
    const tenantIds = Object.keys(pendingChanges);
    if (tenantIds.length === 0) return;

    setSavingChanges(true);
    try {
      for (const id of tenantIds) {
        const change = pendingChanges[id];
        if (change.subscription !== undefined) {
          await platformAdminApi.changeSubscription(id, change.subscription);
        }
        if (change.isActive !== undefined) {
          if (change.isActive) {
            await platformAdminApi.activateTenant(id);
          } else {
            await platformAdminApi.suspendTenant(id);
          }
        }
      }
      toast.success('Lưu tất cả thay đổi thành công!');
      setPendingChanges({});
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu thay đổi');
    } finally {
      setSavingChanges(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await platformAdminApi.createTenant(newTenant);
      toast.success('Tạo Tenant thành công!');
      setIsCreating(false);
      setNewTenant({ name: '', domain: '', ownerEmail: '', ownerName: '', ownerPassword: '', ownerPhone: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <Server className="w-12 h-12 text-violet-500 animate-pulse" />
        <div className="text-zinc-400 font-medium">Đang tải dữ liệu Platform...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-violet-500/30 pb-20">
      {/* Glow Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Platform Admin
              </h1>
              <span className="text-[10px] font-medium text-rose-400 uppercase tracking-widest leading-none">
                SaaS Management Suite
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Tabs */}
        <div className="flex space-x-2 border-b border-zinc-800/80 mb-8 overflow-x-auto pb-px scrollbar-none">
          <button 
            onClick={() => setTab('tenants')}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${
              tab === 'tenants' 
                ? 'border-rose-500 text-rose-400 bg-rose-500/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Building className="w-4 h-4" />
            Quản lý Tenants
          </button>
          <button 
            onClick={() => setTab('logs')}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold tracking-wide uppercase transition-all whitespace-nowrap border-b-2 ${
              tab === 'logs' 
                ? 'border-rose-500 text-rose-400 bg-rose-500/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            Audit Logs
          </button>
        </div>

        {tab === 'tenants' && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Danh sách Khách thuê (Tenants)</h2>
              <button 
                onClick={() => setIsCreating(!isCreating)}
                className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm Tenant
              </button>
            </div>

            {/* Create Form */}
            {isCreating && (
              <form onSubmit={handleCreateTenant} className="bg-zinc-900/50 border border-rose-500/30 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-5 shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tên Nhà Hàng</label>
                  <input required type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} placeholder="VD: Phở Bát Đàn" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Domain (Tuỳ chọn)</label>
                  <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.domain} onChange={e => setNewTenant({...newTenant, domain: e.target.value})} placeholder="VD: phobatdan.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email Chủ (Owner)</label>
                  <input required type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.ownerEmail} onChange={e => setNewTenant({...newTenant, ownerEmail: e.target.value})} placeholder="owner@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tên Chủ (Owner)</label>
                  <input required type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.ownerName} onChange={e => setNewTenant({...newTenant, ownerName: e.target.value})} placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Số điện thoại</label>
                  <input type="tel" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.ownerPhone} onChange={e => setNewTenant({...newTenant, ownerPhone: e.target.value})} placeholder="09xxxxxxx" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Mật khẩu (Owner)</label>
                  <input required type="password" minLength={8} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newTenant.ownerPassword} onChange={e => setNewTenant({...newTenant, ownerPassword: e.target.value})} placeholder="Ít nhất 8 ký tự" />
                </div>
                <div className="md:col-span-3 flex justify-end space-x-3 pt-2 border-t border-zinc-800/50 mt-2">
                  <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl font-medium transition-colors cursor-pointer">Huỷ</button>
                  <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer">Tạo mới</button>
                </div>
              </form>
            )}

            {/* Form List Container */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col h-[520px]">
              
              <div className="overflow-y-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-950 border-b border-zinc-800/90 sticky top-0 z-10">
                    <tr>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Tên / Domain</th>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Chủ sở hữu</th>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Tài nguyên</th>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Gói cước</th>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Trạng thái</th>
                      <th className="p-5 font-semibold text-zinc-400 uppercase tracking-wider text-xs text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {tenants.map(t => {
                      const currentDraftSub = pendingChanges[t.id]?.subscription ?? (t.subscription || 'Starter');
                      const currentDraftActive = pendingChanges[t.id]?.isActive !== undefined ? pendingChanges[t.id].isActive : t.isActive;
                      const isRowModified = pendingChanges[t.id] !== undefined;

                      return (
                        <tr key={t.id} className={`transition-colors ${isRowModified ? 'bg-violet-950/20 border-l-4 border-l-violet-500' : 'hover:bg-zinc-800/30'}`}>
                          <td className="p-5">
                            <div className="font-bold text-zinc-100 text-base">
                              {t.name}
                            </div>
                            <div className="text-xs text-zinc-500 font-mono mt-1">{t.domain || 'Chưa thiết lập'}</div>
                          </td>
                          <td className="p-5">
                            {t.owner ? (
                              <>
                                <div className="font-medium text-zinc-200">{t.owner.name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{t.owner.email}</div>
                              </>
                            ) : <span className="text-zinc-600 italic">Chưa có</span>}
                          </td>
                          <td className="p-5 text-xs text-zinc-400 space-y-1.5">
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-400" /> <span className="text-zinc-300 font-medium">{t.branchCount}</span> / <span className="text-zinc-500">{t.limits?.BRANCH ?? '∞'}</span> Chi nhánh</div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> <span className="text-zinc-300 font-medium">{t.userCount}</span> / <span className="text-zinc-500">{t.limits?.USER ?? '∞'}</span> Nhân viên</div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> <span className="text-zinc-300 font-medium">{t.tableCount}</span> / <span className="text-zinc-500">{t.limits?.TABLE ?? '∞'}</span> Bàn</div>
                          </td>
                          <td className="p-5">
                            <select 
                              value={currentDraftSub}
                              onChange={(e) => handleDraftSubscriptionChange(t.id, e.target.value, t.subscription)}
                              className={`px-3.5 py-2 border text-xs rounded-xl font-extrabold outline-none cursor-pointer transition-all ${
                                pendingChanges[t.id]?.subscription !== undefined
                                  ? "bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-500/30 ring-2 ring-violet-400/50"
                                  : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:border-violet-500/50"
                              }`}
                            >
                              <option value="Starter" className="bg-zinc-900 text-zinc-100">Starter</option>
                              <option value="Professional" className="bg-zinc-900 text-zinc-100">Professional</option>
                              <option value="Enterprise" className="bg-zinc-900 text-zinc-100">Enterprise</option>
                            </select>
                          </td>
                          <td className="p-5">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-bold border ${currentDraftActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {currentDraftActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                              {currentDraftActive ? 'Hoạt động' : 'Đã Khoá'}
                            </span>
                          </td>
                          <td className="p-5 text-right">
                            <button 
                              onClick={() => handleDraftStatusChange(t.id, t.isActive)}
                              className={`text-xs px-4 py-2 rounded-xl border font-semibold transition-all cursor-pointer ${currentDraftActive ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50'}`}
                            >
                              {currentDraftActive ? 'Khoá Tenant' : 'Mở khoá'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Form List Footer Action Bar (Góc dưới bên phải) */}
              <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between shrink-0">
                <div className="text-xs font-semibold">
                  {Object.keys(pendingChanges).length > 0 ? (
                    <span className="text-violet-400 font-extrabold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping inline-block" />
                      Có {Object.keys(pendingChanges).length} khách thuê có thay đổi chưa lưu
                    </span>
                  ) : (
                    <span className="text-zinc-500">Tất cả thay đổi cấu hình đã được lưu</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingChanges({})}
                    disabled={Object.keys(pendingChanges).length === 0 || savingChanges}
                    className="px-5 py-2.5 border border-zinc-800 text-zinc-400 text-xs font-bold rounded-2xl hover:bg-zinc-900 hover:text-zinc-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllChanges}
                    disabled={Object.keys(pendingChanges).length === 0 || savingChanges}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white text-xs font-black rounded-2xl shadow-xl shadow-violet-600/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
                  >
                    {savingChanges && <Loader2 size={16} className="animate-spin" />}
                    {savingChanges ? "Đang lưu..." : "Lưu Thay Đổi"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold">Nhật ký Hệ thống (Audit Logs)</h2>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Thời gian</th>
                    <th className="p-4 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Tenant</th>
                    <th className="p-4 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Hành động</th>
                    <th className="p-4 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Đối tượng</th>
                    <th className="p-4 font-semibold text-zinc-400 uppercase tracking-wider text-xs">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4 text-xs font-mono text-zinc-400">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-4 font-medium text-zinc-200">{log.tenant?.name || 'Hệ thống'}</td>
                      <td className="p-4"><span className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 font-semibold">{log.action}</span></td>
                      <td className="p-4 text-xs text-zinc-400 font-mono">{log.entity}</td>
                      <td className="p-4 text-xs text-zinc-400 max-w-md truncate">{log.details ? JSON.stringify(log.details) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
