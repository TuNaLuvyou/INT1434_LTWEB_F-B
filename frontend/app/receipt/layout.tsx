import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#f3f4f6', // matches bg-gray-100
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
