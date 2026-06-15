import { headers } from 'next/headers';

export async function getCurrentUser() {
  const headersList = await headers();
  const userId = headersList.get('X-User-Id');
  const role = headersList.get('X-User-Role');
  
  if (!userId || !role) return null;
  
  return { userId, role };
}
