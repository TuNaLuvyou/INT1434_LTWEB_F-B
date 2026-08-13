'use client';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineProvider() {
  useOfflineSync();
  return null;
}
