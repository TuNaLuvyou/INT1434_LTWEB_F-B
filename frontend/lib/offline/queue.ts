import { getDB, OfflineQueueItem } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function enqueueAction(
  type: OfflineQueueItem['type'],
  payload: Record<string, any>
): Promise<string> {
  const db = await getDB();
  const id = uuidv4();
  const item: OfflineQueueItem = { id, type, payload, createdAt: Date.now(), retryCount: 0 };
  await db.put('offline-queue', item);
  return id;
}

export async function getQueue(): Promise<OfflineQueueItem[]> {
  const db = await getDB();
  return db.getAll('offline-queue');
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-queue', id);
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('offline-queue', id);
  if (item) await db.put('offline-queue', { ...item, retryCount: item.retryCount + 1 });
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('offline-queue');
}
