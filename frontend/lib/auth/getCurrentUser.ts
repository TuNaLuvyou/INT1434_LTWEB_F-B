import { cookies } from 'next/headers';

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value || cookieStore.get('accessToken')?.value;
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonPayload);

    if (!payload.userId || !payload.role) return null;

    return {
      userId: payload.userId as string,
      role: payload.role as string,
      tenantId: payload.tenantId as string,
      branchId: payload.branchId as string,
    };
  } catch (e) {
    return null;
  }
}
