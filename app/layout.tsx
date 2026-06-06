import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from 'next/headers';
import "./globals.css";
import SocketProvider from './components/SocketProvider';
import GlobalCallManager from './components/GlobalCallManager';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Emma's Space",
  description: "Emma's personal space for sharing life, creativity, and adventures",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth')?.value || '';

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <SocketProvider token={token}>
          <GlobalCallManager />
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
