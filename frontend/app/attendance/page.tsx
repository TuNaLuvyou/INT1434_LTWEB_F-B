import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import CheckInClient from './CheckInClient';

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/attendance');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12">
      <div className="max-w-md w-full px-4">
        <h1 className="text-3xl font-extrabold text-center mb-8 text-gray-900">
          Chấm Công Nhân Viên
        </h1>
        <CheckInClient user={user} />
      </div>
    </div>
  );
}
