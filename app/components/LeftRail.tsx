import Link from 'next/link';
import { getPostingStreak } from '@/app/lib/streaks';

const LINKS = [
  { href: '/play', emoji: '🎮', label: 'Play' },
  { href: '/family-chat', emoji: '🏡', label: 'Family Chat' },
  { href: '/challenges', emoji: '🎯', label: 'Challenges' },
  { href: '/kindness', emoji: '💛', label: 'Kindness' },
  { href: '/leaderboard', emoji: '🏆', label: 'Leaderboard' },
];

export default async function LeftRail({ user }: {
  user: { id: number; username: string; first_name: string; profile_picture?: string | null };
}) {
  const streak = await getPostingStreak(user.id);

  return (
    <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-[4.5rem] self-start space-y-3">
      <Link href={`/profile/${encodeURIComponent(user.username)}`} className="card p-4 flex items-center gap-3 hover:opacity-90 transition">
        {user.profile_picture
          ? <img src={user.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          : <div className="w-11 h-11 rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0">{user.first_name?.[0] || user.username[0]}</div>
        }
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">{user.first_name}</p>
          {streak > 0
            ? <p className="text-xs text-orange-500 font-semibold">🔥 {streak} day{streak === 1 ? '' : 's'}</p>
            : <p className="text-xs text-gray-400">View profile</p>
          }
        </div>
      </Link>

      <nav className="card p-2">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-pink-50 hover:text-pink-600 transition">
            <span className="text-lg">{l.emoji}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
