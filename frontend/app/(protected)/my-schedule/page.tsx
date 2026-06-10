import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import MyScheduleClient from './MyScheduleClient';

export default async function MySchedulePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/my-schedule');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full text-2xl font-bold">
              📅
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Lịch làm việc của tôi</h1>
              <p className="text-gray-500">Xem các ca làm việc được phân công trong tương lai</p>
            </div>
          </div>
          
          <MyScheduleClient userId={user.userId} />
        </div>
      </div>
    </div>
  );
}
