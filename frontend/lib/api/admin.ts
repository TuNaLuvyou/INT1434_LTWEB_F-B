import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const getHeaders = (extraHeaders: Record<string, string> = {}) => {
  const token = getAccessTokenFromCookie();
  return {
    ...extraHeaders,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const fetchIngredients = async (lowStockOnly = false) => {
  const url = `${API}/api/ingredients${lowStockOnly ? '?lowStock=true' : ''}`;
  const res = await fetch(url, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.json();
};

export const deleteIngredient = async (id: string) => {
  const res = await fetch(`${API}/api/ingredients/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchAttendanceToday = async () => {
  const res = await fetch(`${API}/api/attendance/today`, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.json();
};

export const fetchAttendanceHistory = async () => {
  const res = await fetch(`${API}/api/attendance/history`, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.json();
};

export const approveAttendance = async (id: string) => {
  const res = await fetch(`${API}/api/attendance/${id}/approve`, {
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ isApproved: true }),
    credentials: 'include',
  });
  return res.json();
};

export const fetchAttendanceReport = async () => {
  const res = await fetch(`${API}/api/attendance/report`, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.blob();
};

export const fetchSchedules = async () => {
  const res = await fetch(`${API}/api/schedules`, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.json();
};

export const createSchedule = async (data: any) => {
  const res = await fetch(`${API}/api/schedules`, {
    method: 'POST',
    credentials: 'include',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateSchedule = async (id: string, data: any) => {
  const res = await fetch(`${API}/api/schedules/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteSchedule = async (id: string) => {
  const res = await fetch(`${API}/api/schedules/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};
