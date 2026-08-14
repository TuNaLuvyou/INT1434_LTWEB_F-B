"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { getAccessTokenFromCookie } from "@/lib/auth/client";
import { warmUpRoutes, warmUpClientChunks } from "@/lib/warm-up-routes";

// Route công khai — prefetch ngầm từ lúc khởi động (không bị middleware chặn).
const PUBLIC_ROUTES = [
  "/login",
  "/onboarding",
  "/branch-select",
  "/table",
  "/platform-admin",
];

// Route cần xác thực (middleware redirect nếu chưa có cookie access_token).
// Chỉ prefetch sau khi đã đăng nhập, nếu không sẽ bị 307 và không được compile.
//
// PHASE 1 — Lần render lớn thứ nhất: chỉ warm-up các hệ thống con (POS, KDS,
// Table, Home...) ngay khi người dùng ĐÃ chọn chi nhánh (user.currentBranchId
// tồn tại) tại /branch-select — KHÔNG phải lúc đăng nhập.
// Các tính năng trong admin KHÔNG nằm ở đây — chúng được warm-up riêng trong
// app/admin/layout.tsx khi người dùng thực sự bấm vào Admin (PHASE 2), tránh
// dồn toàn bộ rendering vào đúng lúc đăng nhập khiến chờ đợi rất lâu.
//
// NHƯNG: /admin/dashboard (điểm vào của admin) BẮT BUỘC phải nằm ở PHASE 1.
// Lý do: ở dev mode, lần bấm Admin đầu tiên là cold compile route → webpack
// HMR không hot-apply được chunk mới → window.location.reload() về URL hiện
// tại (chưa kịp commit /admin/dashboard) → văng về trang chủ, phải bấm lần 2.
// Warm sẵn route này trước khi user bấm sẽ loại bỏ hoàn toàn cú "bounce" đó.
const CORE_ROUTES = [
  "/",
  "/pos",
  "/pos/cashier",
  "/kds",
  "/table",
  "/admin/dashboard",
];

const BATCH_SIZE = 4;
const DELAY_MS = 200;

/**
 * RoutePrefetcher — prefetch mọi route trong nền (chia batch để không nghẽn
 * request chính). Route cần xác thực chỉ prefetch sau khi đăng nhập (đã có
 * cookie access_token), nhờ đó middleware cho qua và route được compile sẵn.
 *
 * Ngoài router.prefetch (tải chunks + RSC payload về client cache), ta còn:
 *  - warmUpRoutes: gửi request RSC thật để Next.js server compile & render page
 *    ngầm ở backend.
 *  - warmUpClientChunks: dynamic import page module để webpack dev compile sẵn
 *    client JS chunk (router.prefetch không hoạt động ở dev mode).
 * Nhờ đó lần bấm đầu tiên không phải chờ render/compile lần đầu nữa.
 */
export default function RoutePrefetcher() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Chỉ lấy các giá trị primitive để tránh trigger useEffect liên tục khi tham chiếu object user thay đổi
  const isAuth = Boolean(user) || Boolean(getAccessTokenFromCookie());
  const hasBranch = Boolean(user?.currentBranchId) || Boolean(user?.currentBranch?.id);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelWarmUp: (() => void) | undefined;

    const prefetchAll = (routes: string[]) => {
      let index = 0;
      const batch = () => {
        if (cancelled) return;
        const end = Math.min(index + BATCH_SIZE, routes.length);
        for (; index < end; index++) {
          try {
            router.prefetch(routes[index]);
          } catch {
            // Bỏ qua route prefetch lỗi, không ảnh hưởng ứng dụng
          }
        }
        if (index < routes.length) {
          timer = setTimeout(batch, DELAY_MS);
        }
      };
      batch();
    };

    prefetchAll(PUBLIC_ROUTES);
    if (isAuth && hasBranch) {
      prefetchAll(CORE_ROUTES);
      cancelWarmUp = warmUpRoutes(CORE_ROUTES);
      warmUpClientChunks(CORE_ROUTES);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelWarmUp?.();
    };
  }, [router, isAuth, hasBranch]); // Chỉ depend vào giá trị boolean, thay vì cả object user

  return null;
}

