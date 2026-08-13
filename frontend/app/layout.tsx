import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import AuthInit from "@/components/auth/AuthInit";
import { Toaster } from "react-hot-toast";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { OfflineBanner } from "@/components/offline/OfflineBanner";

const beVietnam = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  subsets: ["vietnamese", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "HiAI-MenuGo - Enterprise Restaurant Suite",
  description: "Hệ thống quản trị và vận hành nhà hàng thông minh chuyên nghiệp HiAI-MenuGo",
  manifest: '/manifest.json',
};

import { I18nProvider } from "@/context/i18nContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <OfflineProvider />
          <OfflineBanner />
          <AuthInit />
          {children}
          <Toaster 
            position="top-right" 
            toastOptions={{ 
              style: { 
                background: '#18181b', 
                color: '#fff', 
                border: '1px solid #27272a',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 500
              } 
            }} 
          />
        </I18nProvider>
      </body>
    </html>
  );
}
