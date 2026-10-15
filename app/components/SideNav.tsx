'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The main menu on tablet and desktop, Instagram-style: every section always visible down
// the left, icon and label, with the page you're on highlighted. On a tablet-width screen it
// folds to an icon-only rail (names show on hover) instead of disappearing; phones use the
// bottom bar instead.
export const NAV_LINKS = [
  { href: '/', emoji: '🏠', label: 'Home' },
  { href: '/play', emoji: '🎮', label: 'Play' },
  { href: '/family-chat', emoji: '🏡', label: 'Family Chat', familyOnly: true },
  { href: '/challenges', emoji: '🎯', label: 'Challenges' },
  { href: '/kindness', emoji: '💛', label: 'Kindness' },
  { href: '/leaderboard', emoji: '🏆', label: 'Leaderboard' },
  { href: '/messages', emoji: '💬', label: 'Messages' },
  { href: '/search', emoji: '🔍', label: 'Search' },
];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export default function SideNav({ family }: { family: number }) {
  const pathname = usePathname() ?? '';
  const links = NAV_LINKS.filter(l => !l.familyOnly || family !== 0);

  return (
    <nav className="card p-2 space-y-0.5">
      {links.map(l => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            title={l.label}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
              active ? 'nav-active font-semibold' : 'font-medium text-gray-600 hover:bg-pink-50 hover:text-pink-600'
            }`}
          >
            <span className="text-lg leading-none">{l.emoji}</span>
            <span className="hidden lg:inline">{l.label}</span>
          </Link>
        );
      })}
      <Link
        href="/create"
        title="New post"
        className="mt-2 flex items-center justify-center gap-2 brand-gradient text-white text-sm font-semibold rounded-full h-10 hover:opacity-90 transition"
      >
        <span className="text-lg leading-none">+</span>
        <span className="hidden lg:inline">Post</span>
      </Link>
    </nav>
  );
}
