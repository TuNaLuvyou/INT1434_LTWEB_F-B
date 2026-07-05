import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthInit from "@/components/auth/AuthInit";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LTWEB OS - Enterprise Restaurant Suite",
  description: "Hệ thống quản trị và vận hành nhà hàng thông minh chuyên nghiệp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
