// Optimistic UI cho toàn bộ trang tính năng admin.
// Khi bấm vào 1 tính năng, khung trang hiện ra ngay (không chờ RSC payload),
// data thật stream về sau — loại bỏ cảm giác "giật/đứng hình" khi chuyển trang.
// Đồng thời, có loading.js boundary giúp Next.js prefetch được cả route dynamic ở production.
export default function AdminLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 sm:p-6 max-w-7xl w-full mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6 shrink-0">
        <div className="space-y-2.5">
          <div className="w-44 h-4 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="w-64 h-3 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-32 h-8 bg-zinc-800/70 rounded-xl animate-pulse" />
          <div className="w-9 h-9 bg-zinc-800 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-4 shrink-0 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-28 h-8 bg-zinc-800/70 rounded-xl animate-pulse shrink-0" />
        ))}
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-24 h-3 bg-zinc-800 rounded animate-pulse" />
              <div className="w-8 h-8 bg-zinc-800 rounded-lg animate-pulse" />
            </div>
            <div className="w-32 h-6 bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="flex-1 min-h-0 mt-4 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 flex flex-col space-y-3">
        <div className="w-40 h-4 bg-zinc-800 rounded-lg animate-pulse mb-2" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 bg-zinc-800/60 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
