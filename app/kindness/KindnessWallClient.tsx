'use client';
import { useState } from 'react';

interface Note {
  id: number;
  message: string;
  created_at: string;
}

const CARD_STYLES = [
  'bg-pink-50 border-pink-100',
  'bg-purple-50 border-purple-100',
  'bg-amber-50 border-amber-100',
  'bg-sky-50 border-sky-100',
  'bg-emerald-50 border-emerald-100',
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function KindnessWallClient({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [reported, setReported] = useState<Set<number>>(new Set());

  async function report(id: number) {
    setMenuOpen(null);
    const res = await fetch(`/api/kindness/${id}/report`, { method: 'POST' });
    if (res.ok) {
      setReported(s => new Set(s).add(id));
      setNotes(ns => ns.filter(n => n.id !== id));
    }
  }

  if (notes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-4xl mb-3">💌</p>
        <p className="text-gray-400 font-medium">No notes yet</p>
        <p className="text-gray-400 text-sm mt-1">When friends send you kindness, it&apos;ll show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reported.size > 0 && (
        <p className="text-xs text-gray-400 text-center">Thanks — we&apos;ll take a look at that note.</p>
      )}
      {notes.map((n, i) => (
        <div key={n.id} className={`relative border rounded-2xl px-5 py-4 ${CARD_STYLES[i % CARD_STYLES.length]}`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-700 leading-relaxed flex-1">💛 {n.message}</p>
            <button
              onClick={() => setMenuOpen(v => (v === n.id ? null : n.id))}
              className="text-gray-400 hover:text-gray-600 transition text-sm leading-none px-1"
              aria-label="Note options"
            >
              •••
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">{timeAgo(n.created_at)}</p>

          {menuOpen === n.id && (
            <div className="absolute right-3 top-9 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
              <button
                onClick={() => report(n.id)}
                className="block w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition whitespace-nowrap"
              >
                Report note
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
