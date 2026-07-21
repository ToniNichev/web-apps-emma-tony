'use client';
import { useState } from 'react';

const STARTERS = [
  "I like how you...",
  "You're really good at...",
  "Thanks for...",
  "You always make me laugh when...",
];

export default function KindnessButton({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch('/api/kindness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId, message }),
    });
    if (res.ok) {
      setSent(true);
      setMessage('');
      setTimeout(() => { setOpen(false); setSent(false); }, 1500);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Something went wrong');
    }
    setSending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold px-5 py-2 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition mr-2"
      >
        💛 Kindness
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="brand-gradient px-5 py-4">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Send kindness</p>
              <p className="text-white font-bold text-sm leading-snug mt-0.5">They&apos;ll never know it was you 💛</p>
            </div>

            {sent ? (
              <div className="p-8 text-center">
                <p className="text-4xl mb-2">💛</p>
                <p className="text-gray-600 font-semibold text-sm">Sent!</p>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMessage(s + ' ')}
                      className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1 hover:border-amber-300 hover:text-amber-600 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Say something kind..."
                  rows={3}
                  maxLength={280}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{message.length}/280</span>
                  {error && <span className="text-xs text-red-500">{error}</span>}
                </div>
                <button
                  onClick={send}
                  disabled={sending || !message.trim()}
                  className="w-full bg-amber-400 text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-amber-500 transition disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send kindness 💛'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
