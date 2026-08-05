import Link from 'next/link';

// Mobile/tablet counterpart to the desktop LeftRail (hidden below lg) —
// same destinations, same always-visible reasoning: for a kid-facing app,
// nesting Play/Challenges/Kindness/Leaderboard behind the profile dropdown
// is worse discoverability than a Facebook/Reddit-style always-visible nav.
// Styled like the existing StoriesBar circle row so it reads as a native
// pattern instead of a new UI idiom.
const LINKS = [
  { href: '/play', emoji: '🎮', label: 'Play' },
  { href: '/challenges', emoji: '🎯', label: 'Challenges' },
  { href: '/kindness', emoji: '💛', label: 'Kindness' },
  { href: '/leaderboard', emoji: '🏆', label: 'Leaderboard' },
  { href: '/family-chat', emoji: '🏡', label: 'Family Chat' },
];

export default function QuickLinks() {
  return (
    <div className="card p-4 mb-4 overflow-x-auto lg:hidden">
      <div className="flex gap-4 min-w-0">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-16 h-16 rounded-full brand-gradient flex items-center justify-center text-2xl">
              {l.emoji}
            </div>
            <span className="text-xs text-gray-500 truncate w-16 text-center">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
