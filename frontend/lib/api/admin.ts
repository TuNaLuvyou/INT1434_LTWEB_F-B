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

export const fetchInventoryLogs = async (page = 1, limit = 20) => {
  const res = await fetch(`${API}/api/inventory/logs?page=${page}&limit=${limit}`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

// ── Inventory 4-tab helpers ────────────────────────────────────────────────

export const fetchBranches = async () => {
  const res = await fetch(`${API}/api/branches`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchCurrentUser = async () => {
  const res = await fetch(`${API}/api/auth/me`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchBranchStock = async () => {
  const res = await fetch(`${API}/api/ingredients/branch-stock`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchExportedStats = async () => {
  const res = await fetch(`${API}/api/ingredients/exported-stats`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const transferIngredientToBranch = async (payload: {
  ingredientId: string;
  branchId: string;
  quantity: number;
  note?: string;
}) => {
  const res = await fetch(`${API}/api/ingredients/transfer-to-branch`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return res.json();
};

