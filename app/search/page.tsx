'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
    setLoading(false);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    search(q);
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-gray-600 transition text-sm shrink-0">← Back</a>
          <input
            autoFocus
            value={query}
            onChange={handleChange}
            placeholder="Search people…"
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
          />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading && <p className="text-center text-gray-400 text-sm py-8">Searching…</p>}

        {!loading && query && results.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No one found for "{query}"</p>
        )}

        <div className="space-y-3">
          {results.map(user => (
            <Link key={user.id} href={`/profile/${user.username}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition block">
              <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                {user.profile_picture
                  ? <img src={user.profile_picture} alt="" className="w-full h-full object-cover" />
                  : (user.first_name?.[0] || user.username[0])}
              </div>
              <div>
                <p className="font-semibold text-sm">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-gray-400">@{user.username}</p>
                {user.bio && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{user.bio}</p>}
              </div>
            </Link>
          ))}
        </div>

        {!query && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 font-medium">Find people on Emma's Space</p>
          </div>
        )}
      </main>
    </div>
  );
}
