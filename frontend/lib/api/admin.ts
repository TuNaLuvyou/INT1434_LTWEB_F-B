const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const fetchIngredients = async (lowStockOnly = false) => {
  const url = `${API}/api/ingredients${lowStockOnly ? '?lowStock=true' : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  return res.json();
};

export const deleteIngredient = async (id: string) => {
  const res = await fetch(`${API}/api/ingredients/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
};

export const fetchAttendanceToday = async () => {
  const res = await fetch(`${API}/api/attendance/today`, { credentials: 'include' });
  return res.json();
};

export const fetchAttendanceHistory = async () => {
  const res = await fetch(`${API}/api/attendance/history`, { credentials: 'include' });
  return res.json();
};

export const approveAttendance = async (id: string) => {
  const res = await fetch(`${API}/api/attendance/${id}/approve`, {
    method: 'PATCH',
    credentials: 'include',
  });
  return res.json();
};

export const fetchAttendanceReport = async () => {
  const res = await fetch(`${API}/api/attendance/report`, { credentials: 'include' });
  return res.blob();
};

export const fetchSchedules = async () => {
  const res = await fetch(`${API}/api/schedule`, { credentials: 'include' });
  return res.json();
};

export const createSchedule = async (data: any) => {
  const res = await fetch(`${API}/api/schedule`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateSchedule = async (id: string, data: any) => {
  const res = await fetch(`${API}/api/schedule/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteSchedule = async (id: string) => {
  const res = await fetch(`${API}/api/schedule/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
};
