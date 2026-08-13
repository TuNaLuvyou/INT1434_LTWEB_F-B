'use client';

import { useEffect } from 'react';
import { saveMenuSnapshot } from '@/lib/offline/menuCache';

export function MenuCacheManager({ tenantId, categories, items }: { tenantId: string; categories: any[]; items: any[] }) {
  useEffect(() => {
    saveMenuSnapshot(tenantId, categories, items).catch(() => {});
  }, [tenantId, categories, items]);
  return null;
}
