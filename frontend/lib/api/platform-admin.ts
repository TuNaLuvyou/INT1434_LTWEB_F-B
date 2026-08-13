import { API_URL, getHeaders } from './client';

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: getHeaders({ 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Lỗi kết nối máy chủ');
  }
  return data.data;
};

export const platformAdminApi = {
  getTenants: () => fetchWithAuth('/api/platform-admin/tenants'),
  
  createTenant: (data: { name: string; domain?: string; ownerEmail: string; ownerName: string; ownerPassword?: string; ownerPhone?: string }) => 
    fetchWithAuth('/api/platform-admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  updateTenant: (id: string, data: { name?: string; domain?: string; ownerEmail?: string; ownerName?: string; ownerPassword?: string; ownerPhone?: string; isActive?: boolean; subscription?: string }) =>
    fetchWithAuth(`/api/platform-admin/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
  suspendTenant: (id: string) => 
    fetchWithAuth(`/api/platform-admin/tenants/${id}/suspend`, { method: 'PUT' }),
    
  activateTenant: (id: string) => 
    fetchWithAuth(`/api/platform-admin/tenants/${id}/activate`, { method: 'PUT' }),
    
  getAuditLogs: (tenantId?: string) => {
    const query = tenantId ? `?tenantId=${tenantId}` : '';
    return fetchWithAuth(`/api/platform-admin/audit-logs${query}`);
  },
  changeSubscription: (id: string, planName: string) => fetchWithAuth(`/api/platform-admin/tenants/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ planName }) })
};
