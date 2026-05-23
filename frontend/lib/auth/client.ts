export function setAccessToken(token: string): void {
  // max-age 900 seconds = 15 minutes
  document.cookie = `access_token=${token}; path=/; max-age=900; SameSite=Strict`;
}

export function clearAccessToken(): void {
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
}

export function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^| )access_token=([^;]+)/);
  return match ? match[2] : null;
}

export async function logout(): Promise<void> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAccessToken();
    window.location.href = '/login';
  }
}
