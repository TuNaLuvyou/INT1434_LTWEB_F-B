'use client';

import React, { useEffect, useState } from 'react';
import { platformAdminApi } from '../../lib/api/platform-admin';
import toast from 'react-hot-toast';

export default function PlatformAdminClient() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tenants' | 'logs'>('tenants');

  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', domain: '', ownerEmail: '', ownerName: '' });

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
      setNewTenant({ name: '', domain: '', ownerEmail: '', ownerName: '' });
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

  if (loading) return <div className="p-8 text-center">Đang tải dữ liệu Platform...</div>;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button 
          onClick={() => setTab('tenants')}
          className={`py-2 px-4 border-b-2 font-medium ${tab === 'tenants' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Quản lý Tenants
        </button>
        <button 
          onClick={() => setTab('logs')}
          className={`py-2 px-4 border-b-2 font-medium ${tab === 'logs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Audit Logs
        </button>
      </div>

      {tab === 'tenants' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Danh sách Khách thuê (Tenants)</h2>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Thêm Tenant
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateTenant} className="p-4 bg-blue-50 border-b grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên Nhà Hàng</label>
                <input required type="text" className="w-full border p-2 rounded" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Domain (Tuỳ chọn)</label>
                <input type="text" className="w-full border p-2 rounded" value={newTenant.domain} onChange={e => setNewTenant({...newTenant, domain: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Chủ (Owner)</label>
                <input required type="email" className="w-full border p-2 rounded" value={newTenant.ownerEmail} onChange={e => setNewTenant({...newTenant, ownerEmail: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tên Chủ (Owner)</label>
                <input required type="text" className="w-full border p-2 rounded" value={newTenant.ownerName} onChange={e => setNewTenant({...newTenant, ownerName: e.target.value})} />
              </div>
              <div className="md:col-span-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Huỷ</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Tạo mới</button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-gray-500">TÊN / DOMAIN</th>
                  <th className="p-4 font-medium text-gray-500">OWNER</th>
                  <th className="p-4 font-medium text-gray-500">THỐNG KÊ</th>
                  <th className="p-4 font-medium text-gray-500">GÓI CƯỚC</th>
                  <th className="p-4 font-medium text-gray-500">TRẠNG THÁI</th>
                  <th className="p-4 font-medium text-gray-500 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.domain || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      {t.owner ? (
                        <>
                          <div>{t.owner.name}</div>
                          <div className="text-xs text-gray-500">{t.owner.email}</div>
                        </>
                      ) : <span className="text-gray-400">Chưa có</span>}
                    </td>
                    <td className="p-4 text-xs space-y-1">
                      <div><span className="font-medium text-gray-700">{t.branchCount}</span> Chi nhánh</div>
                      <div><span className="font-medium text-gray-700">{t.userCount}</span> Nhân viên</div>
                      <div><span className="font-medium text-gray-700">{t.tableCount}</span> Bàn</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                        {t.subscription}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.isActive ? 'Hoạt động' : 'Đã Khoá'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleToggleStatus(t.id, t.isActive)}
                        className={`text-xs px-3 py-1 rounded border transition ${t.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                      >
                        {t.isActive ? 'Khoá' : 'Mở khoá'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Nhật ký Hệ thống (Audit Logs)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3">THỜI GIAN</th>
                  <th className="p-3">TENANT</th>
                  <th className="p-3">HÀNH ĐỘNG</th>
                  <th className="p-3">ĐỐI TƯỢNG</th>
                  <th className="p-3">CHI TIẾT</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-500">Chưa có dữ liệu</td></tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-3 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-3 font-medium">{log.tenant?.name || 'N/A'}</td>
                      <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{log.action}</span></td>
                      <td className="p-3 text-gray-600">{log.entity} {log.entityId && `(#${log.entityId.slice(0,6)})`}</td>
                      <td className="p-3 text-xs font-mono bg-gray-50 p-2 rounded overflow-hidden max-w-xs truncate">
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
    </div>
  );
}
