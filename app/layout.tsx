import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from 'next/headers';
import "./globals.css";
import { getSession } from './lib/auth';
import { getSiteSettings } from './lib/site-settings';
import SocketProvider from './components/SocketProvider';
import GlobalCallManager from './components/GlobalCallManager';
import NavBar from './components/NavBar';
import ChatPanel from './components/ChatPanel';
import BottomNav from './components/BottomNav';
import LeftRail from './components/LeftRail';
import RightRail from './components/RightRail';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Emma's Space",
  description: "Emma's personal space for sharing life, creativity, and adventures",
};

const VALID_THEMES = ['bloom', 'ocean', 'sunset', 'forest', 'midnight'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token    = cookieStore.get('auth')?.value  || '';
  const rawTheme = cookieStore.get('theme')?.value || 'bloom';
  const darkMode = cookieStore.get('dark')?.value  === '1';
  const session  = await getSession();

  const theme = VALID_THEMES.includes(rawTheme) ? rawTheme : 'bloom';
  const classes = [
    theme !== 'bloom' ? `theme-${theme}` : '',
    darkMode ? 'dark' : '',
  ].filter(Boolean).join(' ');

  let siteName = "Emma's Space";
  let maintenanceMode = false;
  try {
    const s = await getSiteSettings();
    siteName = s.site_name || siteName;
    maintenanceMode = s.maintenance_mode === '1';
  } catch {}

  if (maintenanceMode) {
    return (
      <html lang="en" className={classes || undefined}>
        <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
          <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
            <div className="text-7xl mb-4">🌙💤✨</div>
            <h1 className="text-2xl font-bold brand-text mb-2">Taking a little break!</h1>
            <p className="text-gray-500 max-w-sm">{siteName} is temporarily closed for some updates. Check back soon! 💕</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={classes || undefined}>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <SocketProvider token={token}>
          {session && <NavBar user={session} siteName={siteName} />}
          <GlobalCallManager />
          {session ? (
            <div className="max-w-7xl mx-auto lg:px-4 flex gap-6 items-start">
              <LeftRail user={session} />
              <div className="flex-1 min-w-0">{children}</div>
              <RightRail />
            </div>
          ) : children}
          {session && <BottomNav user={session} />}
          {session && <ChatPanel currentUser={session} />}
        </SocketProvider>
      </body>
    </html>
  );
}
