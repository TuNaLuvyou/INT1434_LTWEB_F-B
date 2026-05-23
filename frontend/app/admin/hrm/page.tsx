import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import HrmDashboard from './HrmDashboard';

export default async function HrmPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/login?reason=forbidden');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Quản lý Nhân Sự (HRM)</h1>
        <HrmDashboard currentUser={user} />
      </div>
    </div>
  );
}
