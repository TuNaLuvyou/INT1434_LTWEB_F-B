import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface MenuCacheRecord {
  tenantId: string;
  categories: any[];
  items: any[];
  savedAt: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'SUBMIT_CART' | 'ADD_ORDER_ITEMS';
  payload: Record<string, any>;
  createdAt: number;
  retryCount: number;
}

interface OfflineDB extends DBSchema {
  'menu-cache': {
    key: string;
    value: MenuCacheRecord;
  };
  'offline-queue': {
    key: string;
    value: OfflineQueueItem;
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<OfflineDB>('hiaimenugo-offline', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('menu-cache')) {
        db.createObjectStore('menu-cache', { keyPath: 'tenantId' });
      }
      if (!db.objectStoreNames.contains('offline-queue')) {
        db.createObjectStore('offline-queue', { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
}
