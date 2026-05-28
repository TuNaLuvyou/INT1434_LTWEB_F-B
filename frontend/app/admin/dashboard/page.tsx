import DashboardClient from './DashboardClient';

export const revalidate = 60; // Chiến lược ISR: revalidate mỗi 60 giây

export const metadata = {
  title: 'Dashboard Analytics | RestoFlow',
};

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi doanh thu và hiệu suất hoạt động của nhà hàng
          </p>
        </div>
      </div>
      
      <DashboardClient />
    </div>
  );
}
