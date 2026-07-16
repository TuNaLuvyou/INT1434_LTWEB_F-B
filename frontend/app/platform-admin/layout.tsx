import { RoleGate } from '../../components/auth/RoleGate';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  // Tạm thời cho ADMIN cũng vào được để tiện test
  return (
    <RoleGate allowedRoles={['PLATFORM_ADMIN', 'ADMIN']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Platform Admin Control</h1>
            <div className="text-sm text-gray-500">HiAI-MenuGo SaaS</div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </RoleGate>
  );
}
