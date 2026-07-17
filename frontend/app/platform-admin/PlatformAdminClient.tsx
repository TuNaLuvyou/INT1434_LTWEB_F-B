'use client';

import React, { useEffect, useState } from 'react';
import { platformAdminApi } from '../../lib/api/platform-admin';
import toast from 'react-hot-toast';
import { ArrowLeft, Server, Activity, Users, Building, AlertTriangle, Shield, CheckCircle2, Search, Plus } from 'lucide-react';
import Link from 'next/link';

export default function PlatformAdminClient() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tenants' | 'logs'>('tenants');

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

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    try {
      await platformAdminApi.updateTenant(editingTenant.id, { 
        name: editingTenant.name, 
        domain: editingTenant.domain,
        ownerEmail: editingTenant.ownerEmail,
        ownerName: editingTenant.ownerName,
        ownerPassword: editingTenant.ownerPassword,
        ownerPhone: editingTenant.ownerPhone,
        isActive: editingTenant.isActive,
        subscription: editingTenant.subscription
      });
      toast.success('Cập nhật thông tin thành công!');
      setEditingTenant(null);
      setEditTab('info');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Bạn có chắc muốn ${currentStatus ? 'KHOÁ' : 'MỞ KHOÁ'} tenant này?`)) return;
    
    try {
      if (currentStatus) {
        await platformAdminApi.suspendTenant(id);
      } else {
        await platformAdminApi.activateTenant(id);
      }
      toast.success('Cập nhật trạng thái thành công');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleChangeSubscription = async (id: string, planName: string) => {
    if (!confirm(`Bạn có chắc muốn chuyển Tenant này sang gói ${planName}?`)) return;
    try {
      await platformAdminApi.changeSubscription(id, planName);
      toast.success('Đổi gói cước thành công');
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-violet-500/30">
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
                className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-rose-600/20"
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
                  <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Huỷ</button>
                  <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-emerald-600/20">Tạo mới</button>
                </div>
              </form>
            )}

            {/* Data Table */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-900 border-b border-zinc-800">
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
                    {tenants.map(t => (
                      <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-5">
                          <div 
                            className="font-bold text-zinc-100 text-base cursor-pointer hover:text-rose-400 transition-colors"
                            onClick={() => {
                              setEditingTenant({ 
                                id: t.id, 
                                name: t.name, 
                                domain: t.domain || '', 
                                ownerEmail: t.owner?.email, 
                                ownerName: t.owner?.name, 
                                ownerPhone: t.owner?.phone || '',
                                ownerPassword: '',
                                isActive: t.isActive,
                                subscription: t.subscription || 'Starter'
                              });
                              setEditTab('info');
                            }}
                            title="Nhấn để sửa thông tin"
                          >
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
                            value={t.subscription}
                            onChange={(e) => {
                              // If changed, call API
                              if (e.target.value !== t.subscription) {
                                handleChangeSubscription(t.id, e.target.value);
                              }
                            }}
                            className="px-2 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs rounded-lg font-bold outline-none cursor-pointer focus:ring-2 focus:ring-violet-500"
                          >
                            <option value="Starter" className="bg-zinc-900 text-zinc-100">Starter</option>
                            <option value="Professional" className="bg-zinc-900 text-zinc-100">Professional</option>
                            <option value="Enterprise" className="bg-zinc-900 text-zinc-100">Enterprise</option>
                          </select>
                        </td>
                        <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-bold border ${t.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                            {t.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            {t.isActive ? 'Hoạt động' : 'Đã Khoá'}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <button 
                            onClick={() => handleToggleStatus(t.id, t.isActive)}
                            className={`text-xs px-4 py-2 rounded-xl border font-semibold transition-all ${t.isActive ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50'}`}
                          >
                            {t.isActive ? 'Khoá Tenant' : 'Mở khoá'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-zinc-500 italic">Chưa có dữ liệu lịch sử</td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4 text-xs text-zinc-400 font-mono">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                        <td className="p-4 font-medium text-zinc-200">{log.tenant?.name || <span className="text-zinc-600 italic">Hệ thống</span>}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-[11px] font-bold tracking-wide uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400 font-medium text-xs">
                          {log.entity} <span className="text-zinc-600 font-mono ml-1">{log.entityId && `(#${log.entityId.slice(0,6)})`}</span>
                        </td>
                        <td className="p-4 text-xs font-mono bg-zinc-950 text-zinc-500 rounded-lg my-2 mx-2 border border-zinc-800 overflow-hidden max-w-xs truncate block p-2">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-100">Cập nhật thông tin cửa hàng</h3>
            </div>
            
            <div className="flex border-b border-zinc-800/80 px-5 pt-3 gap-6">
              <button type="button" onClick={() => setEditTab('info')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${editTab === 'info' ? 'border-rose-500 text-rose-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Cửa hàng</button>
              <button type="button" onClick={() => setEditTab('owner')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${editTab === 'owner' ? 'border-rose-500 text-rose-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Chủ sở hữu</button>
            </div>

            <form onSubmit={handleUpdateTenant} className="p-5">
              
              <div className="min-h-[220px]">
                {editTab === 'info' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Tên Cửa Hàng</label>
                      <input required type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.name} onChange={e => setEditingTenant({...editingTenant, name: e.target.value})} placeholder="Tên cửa hàng" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Tên miền (Domain)</label>
                      <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.domain} onChange={e => setEditingTenant({...editingTenant, domain: e.target.value})} placeholder="VD: demo.hiaimenugo.com" />
                    </div>
                  </div>
                )}

                {editTab === 'owner' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Tên Chủ (Owner)</label>
                      <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.ownerName || ''} onChange={e => setEditingTenant({...editingTenant, ownerName: e.target.value})} placeholder="Nguyễn Văn A" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Email Chủ (Owner)</label>
                      <input type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.ownerEmail || ''} onChange={e => setEditingTenant({...editingTenant, ownerEmail: e.target.value})} placeholder="owner@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Số điện thoại</label>
                      <input type="tel" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.ownerPhone || ''} onChange={e => setEditingTenant({...editingTenant, ownerPhone: e.target.value})} placeholder="09xxxxxxx" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Mật khẩu mới (Tuỳ chọn)</label>
                      <input type="password" minLength={8} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={editingTenant.ownerPassword || ''} onChange={e => setEditingTenant({...editingTenant, ownerPassword: e.target.value})} placeholder="Để trống nếu không muốn đổi" />
                    </div>
                  </div>
                )}

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/50 mt-4">
                <button type="button" onClick={() => setEditingTenant(null)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Huỷ</button>
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-rose-600/20">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
