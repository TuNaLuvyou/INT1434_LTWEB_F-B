import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export const metadata = {
  title: 'Quản lý Kho Nguyên Liệu | RestoFlow',
};

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/login?reason=forbidden');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Quản lý Kho Nguyên Liệu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi tồn kho, nhập hàng và quản lý công thức món ăn (BOM)
          </p>
        </div>
        <InventoryClient />
      </div>
    </div>
  );
}
