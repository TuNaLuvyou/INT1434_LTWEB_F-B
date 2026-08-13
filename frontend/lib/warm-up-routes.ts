const BATCH_SIZE = 3;
const DELAY_MS = 150;

/**
 * warmUpRoutes — gửi request RSC (RSC: 1) tới từng route để Next.js server
 * render page ngầm ở backend:
 *  - Dev: trigger on-demand compilation sẵn phần server render.
 *  - Prod: warm server render + sẵn RSC payload cho lần điều hướng sau.
 *
 * Request chỉ dùng để "làm nóng" — response bị bỏ qua hoàn toàn.
 * Trả về hàm hủy để dọn timer khi component unmount.
 */
export function warmUpRoutes(routes: string[]): () => void {
  let cancelled = false;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fire = async (route: string) => {
    try {
      const res = await fetch(route, {
        headers: { RSC: "1" },
        credentials: "same-origin",
      });
      // Đọc hết body để đảm bảo server hoàn tất render (không hủy giữa chừng)
      await res.text();
    } catch {
      // Bỏ qua route lỗi — không ảnh hưởng ứng dụng
    }
  };

  const batch = () => {
    if (cancelled) return;
    const end = Math.min(index + BATCH_SIZE, routes.length);
    for (; index < end; index++) {
      fire(routes[index]);
    }
    if (index < routes.length) {
      timer = setTimeout(batch, DELAY_MS);
    }
  };

  batch();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Route → module client của page (dynamic import).
 * Ở dev mode, webpack compile client chunk theo yêu cầu — `router.prefetch()`
 * không kích hoạt compile ở dev, và request RSC chỉ warm server render.
 * Cách ép compile + tải sẵn client JS: dynamic import chính module của page.
 *
 * Lưu ý: các route là Server Component (settings, pos/cashier) phải import
 * phần client bên trong (SettingsClient / CashierClient), không import page.
 */
const CLIENT_CHUNK_LOADERS: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/app/page"),
  "/pos": () => import("@/app/pos/page"),
  "/pos/cashier": () => import("@/app/pos/CashierClient"),
  "/kds": () => import("@/app/kds/page"),
  "/table": () => import("@/app/table/page"),
  "/admin/dashboard": () => import("@/app/admin/dashboard/page"),
  "/admin/menu": () => import("@/app/admin/menu/page"),
  "/admin/inventory": () => import("@/app/admin/inventory/page"),
  "/admin/vouchers": () => import("@/app/admin/vouchers/page"),
  "/admin/z-report": () => import("@/app/admin/z-report/page"),
  "/admin/integrations": () => import("@/app/admin/integrations/page"),
  "/admin/roles": () => import("@/app/admin/roles/page"),
  "/admin/bank-account": () => import("@/app/admin/bank-account/page"),
  "/admin/audit-logs": () => import("@/app/admin/audit-logs/page"),
  "/admin/invoices": () => import("@/app/admin/invoices/page"),
  // settings page là Server Component → import client part
  "/admin/settings": () => import("@/app/admin/settings/SettingsClient"),
};

/**
 * warmUpClientChunks — ép webpack dev compile & trình duyệt tải sẵn client
 * JS chunk của từng route (dynamic import page module). Nhờ đó lần bấm đầu
 * tiên không còn bị "giật" vì phải chờ compile client-side.
 * Không trả về hàm hủy — module đã tải thì giữ nguyên trong cache trình duyệt.
 */
export function warmUpClientChunks(routes: string[]): void {
  for (const route of routes) {
    const loader = CLIENT_CHUNK_LOADERS[route];
    if (!loader) continue;
    loader().catch(() => {
      // Bỏ qua chunk lỗi — không ảnh hưởng ứng dụng
    });
  }
}
