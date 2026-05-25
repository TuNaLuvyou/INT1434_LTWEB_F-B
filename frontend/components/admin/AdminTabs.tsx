import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { name: 'Dashboard', href: '/admin' },
  { name: 'Quản lý nguyên liệu', href: '/admin/inventory' },
  { name: 'Chấm công', href: '/admin/attendance' },
  { name: 'Lịch làm việc', href: '/admin/schedule' },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 border border-zinc-900 bg-zinc-950/60 rounded-xl p-1 w-fit overflow-x-auto select-none">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
              isActive
                ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
