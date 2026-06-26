'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Session { id: number; scheduled_for: string; already_posted: boolean }

export default function RightNowBanner() {
  const [session, setSession] = useState<Session | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const router = useRouter();

  const check = useCallback(async () => {
    const res = await fetch('/api/right-now');
    const data = res.ok ? await res.json() : null;
    setSession(data);
    if (data) {
      const elapsed = (Date.now() - new Date(data.scheduled_for).getTime()) / 1000;
      setSecondsLeft(Math.max(0, 120 - Math.floor(elapsed)));
    }
  }, []);

  useEffect(() => {
    check();
    const poll = setInterval(check, 30000);
    return () => clearInterval(poll);
  }, [check]);

  useEffect(() => {
    if (!session) return;
    const tick = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setSession(null); clearInterval(tick); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session?.id]);

  if (!session) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');

  if (session.already_posted) {
    return (
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 px-5 py-3 flex items-center gap-3 text-white">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-bold text-sm">You're in the Right Now!</p>
          <p className="text-xs opacity-90">You posted in time — nice one ⚡</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl overflow-hidden animate-pulse-slow">
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">📍</span>
            <div>
              <p className="font-black text-white text-lg tracking-tight">RIGHT NOW!</p>
              <p className="text-white/80 text-xs">What are you doing right now? Post it!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-mono font-bold text-2xl">{mins}:{secs}</p>
            <p className="text-white/70 text-xs">left to post</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/create?rightNow=${session.id}`)}
          className="mt-3 w-full bg-white text-purple-600 font-bold text-sm py-2.5 rounded-xl hover:bg-white/90 transition"
        >
          ⚡ Post Right Now!
        </button>
      </div>
    </div>
  );
}
