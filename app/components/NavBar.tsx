'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';

interface NavBarProps {
  user: { username: string; first_name: string; profile_picture?: string | null; is_admin?: number };
  siteName?: string;
}

function DaisyIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6"/>
          <stop offset="100%" stopColor="#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#nb-bg)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(0 16 16)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(60 16 16)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(120 16 16)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(180 16 16)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(240 16 16)"/>
      <ellipse cx="16" cy="9.5" rx="2.8" ry="5.5" fill="white" opacity="0.95" transform="rotate(300 16 16)"/>
      <circle cx="16" cy="16" r="5" fill="#fbbf24"/>
      <circle cx="16" cy="16" r="3.2" fill="#f59e0b"/>
    </svg>
  );
}

export default function NavBar({ user, siteName = "Emma's Space" }: NavBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <DaisyIcon size={30} />
          <span className="text-lg font-bold brand-text">{siteName}</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <NotificationBell />

          {/* Hidden on mobile — covered by bottom nav */}
          <Link href="/messages" className="hidden md:flex text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-50" title="Messages">
            💬
          </Link>
          <Link href="/search" className="hidden md:flex text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-50" title="Search">
            🔍
          </Link>
          <Link
            href="/create"
            className="hidden md:inline-flex brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition ml-1"
          >
            + Post
          </Link>

          {/* Profile dropdown */}
          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 rounded-full hover:ring-2 hover:ring-[color:var(--brand-color)] transition"
            >
              {user.profile_picture ? (
                <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold">
                  {user.first_name?.[0] || user.username[0]}
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="font-semibold text-sm text-gray-800">{user.first_name}</p>
                  <p className="text-xs text-gray-400">@{user.username}</p>
                </div>
                <Link
                  href={`/profile/${user.username}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <span>👤</span> My profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <span>⚙️</span> Settings
                </Link>
                {user.is_admin ? (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span>👑</span> Admin panel
                  </Link>
                ) : null}
                <div className="border-t border-gray-50 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
                  >
                    <span>🚪</span> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
