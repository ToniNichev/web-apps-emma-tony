'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_LINKS, isActive } from './SideNav';

// Phones: the most-used sections as tabs, and a More tab that slides up a sheet with
// everything else, so no page is more than two taps away.
const TAB_HREFS = ['/', '/play', '/messages'];

export default function BottomNav({ user }: {
  user: { username: string; profile_picture?: string | null; first_name: string; family: number; is_admin: number };
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  function active(href: string) {
    return isActive(pathname, href);
  }

  const profileHref = `/profile/${encodeURIComponent(user.username)}`;
  const moreLinks = [
    { href: profileHref, emoji: '👤', label: 'My profile' },
    ...NAV_LINKS.filter(l => !TAB_HREFS.includes(l.href) && (!l.familyOnly || user.family !== 0)),
    { href: '/notifications', emoji: '🔔', label: 'Notifications' },
    { href: '/settings', emoji: '⚙️', label: 'Settings' },
    ...(user.is_admin ? [{ href: '/admin', emoji: '👑', label: 'Admin' }] : []),
  ];
  const moreActive = moreLinks.some(l => active(l.href));

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="card absolute left-3 right-3 p-3"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-xs transition ${
                    active(l.href) ? 'nav-active font-semibold' : 'font-medium text-gray-600 hover:bg-pink-50'
                  }`}
                >
                  <span className="text-2xl leading-none">{l.emoji}</span>
                  {l.label}
                </Link>
              ))}
            </div>
            <button
              onClick={signOut}
              className="mt-2 w-full rounded-2xl py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition"
            >
              🚪 Sign out
            </button>
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-bar border-t border-gray-100 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center h-14">

          {/* Home */}
          <Link href="/" className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active('/') ? 'brand-text' : 'text-gray-400'}`}>
            <svg className="w-6 h-6" fill={active('/') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {/* Play — swapped in for Search: low-value in a small family circle,
              while the games are probably the single biggest draw for kids.
              Search is still reachable at /search, just not a fixed tab. */}
          <Link href="/play" className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active('/play') ? 'brand-text' : 'text-gray-400'}`}>
            <span className="text-xl leading-none">🎮</span>
            <span className="text-[10px] font-medium">Play</span>
          </Link>

          {/* Create — centre accent button */}
          <Link href="/create" className="flex-1 flex justify-center items-center py-1">
            <div className="brand-gradient w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl font-light shadow-md -mt-4">
              +
            </div>
          </Link>

          {/* Messages */}
          <Link href="/messages" className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active('/messages') ? 'brand-text' : 'text-gray-400'}`}>
            <svg className="w-6 h-6" fill={active('/messages') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="text-[10px] font-medium">Messages</span>
          </Link>

          {/* More — everything that isn't a tab, in a sheet that slides up */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            aria-expanded={moreOpen}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${moreOpen || moreActive ? 'brand-text' : 'text-gray-400'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>

        </div>
      </nav>
    </>
  );
}
