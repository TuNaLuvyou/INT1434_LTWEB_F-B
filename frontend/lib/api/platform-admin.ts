import { getAccessTokenFromCookie } from '../auth/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getAccessTokenFromCookie();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Lỗi kết nối máy chủ');
  }
  return data.data;
};

export const platformAdminApi = {
  getTenants: () => fetchWithAuth('/api/platform-admin/tenants'),
  
  createTenant: (data: { name: string; domain?: string; ownerEmail: string; ownerName: string }) => 
    fetchWithAuth('/api/platform-admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  suspendTenant: (id: string) => 
    fetchWithAuth(`/api/platform-admin/tenants/${id}/suspend`, { method: 'PUT' }),
    
  activateTenant: (id: string) => 
    fetchWithAuth(`/api/platform-admin/tenants/${id}/activate`, { method: 'PUT' }),
    
  getAuditLogs: (tenantId?: string) => {
    const query = tenantId ? `?tenantId=${tenantId}` : '';
    return fetchWithAuth(`/api/platform-admin/audit-logs${query}`);
  }
};
