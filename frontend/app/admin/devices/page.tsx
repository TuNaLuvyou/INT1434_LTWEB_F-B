import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import DevicesClient from './DevicesClient';

export default async function DevicesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    redirect('/login?reason=forbidden');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Quản lý Thiết bị Tin cậy</h1>
        <DevicesClient />
      </div>
    </div>
  );
}
