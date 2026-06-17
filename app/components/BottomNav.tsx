'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav({ user }: {
  user: { username: string; profile_picture?: string | null; first_name: string };
}) {
  const pathname = usePathname();

  function active(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center h-14">

        {/* Home */}
        <Link href="/" className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active('/') ? 'brand-text' : 'text-gray-400'}`}>
          <svg className="w-6 h-6" fill={active('/') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Search */}
        <Link href="/search" className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active('/search') ? 'brand-text' : 'text-gray-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <span className="text-[10px] font-medium">Search</span>
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

        {/* Profile */}
        <Link href={`/profile/${user.username}`} className={`flex-1 flex flex-col items-center gap-0.5 py-1 transition ${active(`/profile/${user.username}`) ? 'brand-text' : 'text-gray-400'}`}>
          {user.profile_picture ? (
            <img src={user.profile_picture} alt="" className={`w-6 h-6 rounded-full object-cover ${active(`/profile/${user.username}`) ? 'ring-2 ring-[color:var(--brand-color)]' : ''}`} />
          ) : (
            <div className={`w-6 h-6 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold ${active(`/profile/${user.username}`) ? 'ring-2 ring-[color:var(--brand-color)]' : ''}`}>
              {user.first_name?.[0] || user.username[0]}
            </div>
          )}
          <span className="text-[10px] font-medium">Profile</span>
        </Link>

      </div>
    </nav>
  );
}
