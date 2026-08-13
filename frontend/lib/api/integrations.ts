import { API_URL, getHeaders, safeFetchJson } from './client';

// ── API Keys ─────────────────────────────────────────────────────────────

export const fetchApiKeys = async () => {
  return safeFetchJson(`${API_URL}/api/api-keys`, {
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const createApiKey = async (data: { name: string; expiresAt?: string }) => {
  return safeFetchJson(`${API_URL}/api/api-keys`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

export const revokeApiKey = async (id: string) => {
  return safeFetchJson(`${API_URL}/api/api-keys/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const updateApiKey = async (id: string, data: { name?: string; expiresAt?: string | null; isActive?: boolean }) => {
  return safeFetchJson(`${API_URL}/api/api-keys/${id}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

export const deleteApiKey = async (id: string) => {
  return safeFetchJson(`${API_URL}/api/api-keys/${id}/permanent`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
};

// ── Webhooks ─────────────────────────────────────────────────────────────

export const fetchWebhooks = async () => {
  return safeFetchJson(`${API_URL}/api/webhooks`, {
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const createWebhook = async (data: { name: string; url: string; events: string[]; secret?: string }) => {
  return safeFetchJson(`${API_URL}/api/webhooks`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

export const updateWebhook = async (id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) => {
  return safeFetchJson(`${API_URL}/api/webhooks/${id}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

export const deleteWebhook = async (id: string) => {
  return safeFetchJson(`${API_URL}/api/webhooks/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const fetchWebhookDeliveries = async (webhookId: string) => {
  return safeFetchJson(`${API_URL}/api/webhooks/${webhookId}/deliveries`, {
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const retryWebhookDelivery = async (deliveryId: string) => {
  return safeFetchJson(`${API_URL}/api/webhooks/deliveries/${deliveryId}/retry`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  });
};

export const testWebhook = async (id: string) => {
  return safeFetchJson(`${API_URL}/api/webhooks/${id}/test`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  });
};
