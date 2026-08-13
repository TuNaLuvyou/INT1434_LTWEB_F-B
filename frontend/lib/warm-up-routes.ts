const BATCH_SIZE = 1;
const DELAY_MS = 500;

/**
 * warmUpRoutes — gửi request RSC nhẹ nhàng để Next.js server warm-up route.
 */
export function warmUpRoutes(routes: string[]): () => void {
  let cancelled = false;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fire = async (route: string) => {
    try {
      await fetch(route, {
        headers: { RSC: "1" },
        credentials: "same-origin",
      });
    } catch {
      // Bỏ qua route lỗi
    }
  };

  const batch = () => {
    if (cancelled) return;
    if (index < routes.length) {
      fire(routes[index]);
      index++;
      timer = setTimeout(batch, DELAY_MS);
    }
  };

  // Trì hoãn 1s sau khi trang mount mới bắt đầu warm up nhẹ
  timer = setTimeout(batch, 1000);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * warmUpClientChunks — An toàn, không éo webpack compile hàng loạt cùng lúc.
 */
export function warmUpClientChunks(routes: string[]): void {
  // Bỏ qua ép compile dynamic import hàng loạt để tránh overload Webpack HMR trong dev mode
}
