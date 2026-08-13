import { API_URL, getHeaders } from './client';

export const fetchIngredients = async (lowStockOnly = false) => {
  const url = `${API_URL}/api/ingredients${lowStockOnly ? '?lowStock=true' : ''}`;
  const res = await fetch(url, { 
    headers: getHeaders(),
    credentials: 'include' 
  });
  return res.json();
};

export const deleteIngredient = async (id: string) => {
  const res = await fetch(`${API_URL}/api/ingredients/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchInventoryLogs = async (page = 1, limit = 20) => {
  const res = await fetch(`${API_URL}/api/inventory/logs?page=${page}&limit=${limit}`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

// ── Inventory 4-tab helpers ────────────────────────────────────────────────

export const fetchBranches = async () => {
  const res = await fetch(`${API_URL}/api/branches`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchCurrentUser = async () => {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchBranchStock = async () => {
  const res = await fetch(`${API_URL}/api/ingredients/branch-stock`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  return res.json();
};

export const fetchExportedStats = async () => {
  const res = await fetch(`${API_URL}/api/ingredients/exported-stats`, {
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
  const res = await fetch(`${API_URL}/api/ingredients/transfer-to-branch`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return res.json();
};
