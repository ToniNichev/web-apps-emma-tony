import Link from 'next/link';
import { getPostingStreak } from '@/app/lib/streaks';
import SideNav from './SideNav';

// Tablet and desktop: your profile card on top of the main menu. On tablet-width screens the
// whole rail folds down to icons (the profile card to just your picture).
export default async function LeftRail({ user }: {
  user: { id: number; username: string; first_name: string; profile_picture?: string | null; family: number };
}) {
  const streak = await getPostingStreak(user.id);

  return (
    <aside className="hidden md:block md:w-[4.25rem] lg:w-56 flex-shrink-0 sticky top-[4.5rem] self-start space-y-3">
      <Link
        href={`/profile/${encodeURIComponent(user.username)}`}
        title="My profile"
        className="card p-2 lg:p-4 flex items-center justify-center lg:justify-start gap-3 hover:opacity-90 transition"
      >
        {user.profile_picture
          ? <img src={user.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          : <div className="w-11 h-11 rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0">{user.first_name?.[0] || user.username[0]}</div>
        }
        <div className="min-w-0 hidden lg:block">
          <p className="font-semibold text-sm text-gray-800 truncate">{user.first_name}</p>
          {streak > 0
            ? <p className="text-xs text-orange-500 font-semibold">🔥 {streak} day{streak === 1 ? '' : 's'}</p>
            : <p className="text-xs text-gray-400">View profile</p>
          }
        </div>
      </Link>

      <SideNav family={user.family} />
    </aside>
  );
}
