import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Cài đặt hệ thống | HiAI-MenuGo',
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'PLATFORM_ADMIN')) {
    redirect('/login?reason=forbidden');
  }

  return <SettingsClient />;
}
