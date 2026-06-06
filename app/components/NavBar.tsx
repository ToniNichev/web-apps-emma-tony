'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';

interface NavBarProps {
  user: { username: string; first_name: string; profile_picture?: string | null };
}

export default function NavBar({ user }: NavBarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          Emma's Space ✨
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Link href="/messages" className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-50" title="Messages">
            💬
          </Link>
          <Link href="/search" className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-50" title="Search">
            🔍
          </Link>
          <Link
            href="/create"
            className="brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition ml-1"
          >
            + Post
          </Link>
          <Link href={`/profile/${user.username}`} className="p-1 ml-1">
            {user.profile_picture ? (
              <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold">
                {user.first_name?.[0] || user.username[0]}
              </div>
            )}
          </Link>
          <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition p-1" title="Settings">⚙️</Link>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-sm transition p-1">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
