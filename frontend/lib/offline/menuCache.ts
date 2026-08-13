import { getDB } from './db';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function saveMenuSnapshot(tenantId: string, categories: any[], items: any[]) {
  const db = await getDB();
  await db.put('menu-cache', { tenantId, categories, items, savedAt: Date.now() });
}

export async function getMenuSnapshot(tenantId: string) {
  const db = await getDB();
  return db.get('menu-cache', tenantId) ?? null;
}

export async function isMenuCacheValid(tenantId: string): Promise<boolean> {
  const cache = await getMenuSnapshot(tenantId);
  if (!cache) return false;
  return Date.now() - cache.savedAt < CACHE_TTL_MS;
}
