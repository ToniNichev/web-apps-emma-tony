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
  try {
    const s = await getSiteSettings();
    siteName = s.site_name || siteName;
  } catch {}

  return (
    <html lang="en" className={classes || undefined}>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <SocketProvider token={token}>
          {session && <NavBar user={session} siteName={siteName} />}
          <GlobalCallManager />
          {children}
          {session && <BottomNav user={session} />}
          {session && <ChatPanel currentUser={session} />}
        </SocketProvider>
      </body>
    </html>
  );
}
