// Cache tính năng theo tenant — tách riêng module để tránh circular import
// giữa feature.guard (đọc gói) và platform-admin.service (đổi gói cần clear cache).
export interface FeatureCacheEntry {
  timestamp: number;
  features: Set<string>;
  planName: string | null;
}

export const featureCache = new Map<string, FeatureCacheEntry>();
export const FEATURE_CACHE_TTL = 60_000; // 60s

export function clearFeatureCacheForTenant(tenantId: string) {
  featureCache.delete(tenantId);
}

export function clearAllFeatureCache() {
  featureCache.clear();
}
