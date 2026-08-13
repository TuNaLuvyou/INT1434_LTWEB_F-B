export function setAccessToken(token: string): void {
  // max-age 900 seconds = 15 minutes
  document.cookie = `access_token=${token}; path=/; max-age=900; SameSite=Strict`;
}

function clearAccessToken(): void {
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
}

export function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^| )access_token=([^;]+)/);
  return match ? match[2] : null;
}

/**
 * Giải mã JWT payload (không verify — chỉ đọc thông tin trong token).
 * Trả về null nếu token không hợp lệ. Dùng để lấy userId/role/tenantId/branchId.
 */
export function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    const token = getAccessTokenFromCookie();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAccessToken();
    window.location.replace('/login');
  }
}
