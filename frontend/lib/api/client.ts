/**
 * client.ts — Shared HTTP helpers cho các API client (admin, integrations, platform-admin).
 * - getHeaders: tự gắn Authorization Bearer từ cookie access_token.
 * - safeFetchJson: fetch + parse JSON, không throw khi server trả HTML (an toàn cho lỗi proxy).
 */
import { getAccessTokenFromCookie } from '@/lib/auth/client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const getHeaders = (extraHeaders: Record<string, string> = {}) => {
  const token = getAccessTokenFromCookie();
  return {
    ...extraHeaders,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const safeFetchJson = async (url: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return { success: false, message: `Lỗi kết nối máy chủ (${res.status})` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi kết nối mạng' };
  }
};
