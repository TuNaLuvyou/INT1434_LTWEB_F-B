"use client";

import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";

/**
 * useFeatureGate — đọc danh sách tính năng (features) của gói cước tenant
 * từ auth store. Store được nạp 1 lần lúc đăng nhập/selectTenant (qua /api/auth/me),
 * nên việc khóa/khôi phục UI theo gói là kiểm tra cờ cục bộ — không gọi lại API.
 */
export function useFeatureGate() {
  const user = useAuthStore((s) => s.user);
  const features = useMemo(
    () => (Array.isArray(user?.features) ? new Set(user.features) : null),
    [user?.features]
  );
  const planName = user?.planName || null;
  const loading = useMemo(() => !features, [features]);

  const hasFeature = useCallback(
    (code: string) => {
      // PLATFORM_ADMIN không thuộc tenant nào → luôn có toàn quyền
      if (user?.role === "PLATFORM_ADMIN") return true;
      if (!features) return true; // chưa nạp xong gói cước → không khóa để tránh flash
      return features.has(code) || features.has("ALL_FEATURES");
    },
    [features, user?.role]
  );

  return { features, planName, loading, hasFeature };
}