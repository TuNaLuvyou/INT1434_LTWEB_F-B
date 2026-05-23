import { headers } from 'next/headers';

export function getCurrentUser() {
  const headersList = headers();
  const userId = headersList.get('X-User-Id');
  const role = headersList.get('X-User-Role');
  
  if (!userId || !role) return null;
  
  return { userId, role };
}
