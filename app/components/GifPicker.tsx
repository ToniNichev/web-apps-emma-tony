'use client';
import { useState, useEffect, useRef } from 'react';

interface Gif { id: string; preview: string; url: string; title: string }

export default function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  async function load(q: string) {
    setLoading(true);
    const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
    setGifs(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => { load(''); }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 400);
  }

  return (
    <div ref={ref} className="absolute bottom-12 left-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 w-72 overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={query}
          onChange={handleSearch}
          placeholder="Search GIFs…"
          className="w-full text-sm px-3 py-1.5 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
      </div>
      <div className="h-56 overflow-y-auto p-2">
        {loading ? (
          <p className="text-center text-xs text-gray-400 mt-8">Loading…</p>
        ) : gifs.length === 0 ? (
          <p className="text-center text-xs text-gray-400 mt-8">No GIFs found</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map(g => (
              <button key={g.id} onClick={() => onSelect(g.url)} className="rounded-xl overflow-hidden hover:opacity-80 transition">
                <img src={g.preview} alt={g.title} className="w-full h-20 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-gray-300 py-1">Powered by Tenor</p>
    </div>
  );
}
