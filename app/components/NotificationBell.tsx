'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppSocket } from './SocketProvider';

interface Notification {
  id: number;
  type: 'like' | 'comment' | 'follow' | 'message' | 'poll_vote' | 'challenge_response' | 'kindness_note' | 'game_invite' | 'hangout_invite' | 'rps_invite' | 'trivia_invite';
  actor_first_name: string;
  actor_username: string;
  actor_profile_picture: string | null;
  post_id: number | null;
  message_preview: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function notifText(n: Notification) {
  switch (n.type) {
    case 'like': return 'reacted to your post';
    case 'comment': return `commented: "${n.message_preview}"`;
    case 'follow': return 'started following you';
    case 'message': return `sent you a message: "${n.message_preview}"`;
    case 'poll_vote': return 'voted on your poll';
    case 'challenge_response': return `responded to today's challenge 🎯`;
    case 'kindness_note': return 'sent you kindness 💛';
    case 'game_invite': return 'invited you to play Draw & Guess 🎨';
    case 'hangout_invite': return 'invited you to the Hangout Room 🏡';
    case 'rps_invite': return 'challenged you to Rock-Paper-Scissors ✊';
    case 'trivia_invite': return 'invited you to a Trivia Duel 🧠';
  }
}

function notifLink(n: Notification) {
  if (n.type === 'message') return '/messages';
  if (n.type === 'follow') return `/profile/${n.actor_username}`;
  if (n.type === 'challenge_response') return '/challenges';
  if (n.type === 'kindness_note') return '/kindness';
  if (n.type === 'game_invite') return `/play/draw/${n.message_preview}`;
  if (n.type === 'hangout_invite') return `/play/hangout/${n.message_preview}`;
  if (n.type === 'rps_invite') return `/play/rps/${n.message_preview}`;
  if (n.type === 'trivia_invite') return `/play/trivia/${n.message_preview}`;
  if (n.post_id) return `/post/${n.post_id}`;
  return '#';
}

function showBrowserNotif(n: Notification) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
  const body = n.type === 'kindness_note' ? 'Someone sent you kindness 💛' : `${n.actor_first_name} ${notifText(n)}`;
  try {
    new Notification("Emma's Space 🌸", { body, icon: '/icon.svg' });
  } catch {}
}

export default function NotificationBell() {
  const socket = useAppSocket();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const seenIds = useRef<Set<number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.read_at).length;

  async function load(showNew = false) {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data: Notification[] = await res.json();
    if (showNew) {
      for (const n of data) {
        if (!seenIds.current.has(n.id) && !n.read_at) showBrowserNotif(n);
      }
    }
    for (const n of data) seenIds.current.add(n.id);
    setNotifs(data);
  }

  async function markRead() {
    // Only the top 10 are actually rendered in the dropdown — don't mark the
    // rest of the fetched batch (or anything beyond it) as read too.
    const shownIds = notifs.slice(0, 10).map(n => n.id);
    if (shownIds.length === 0) return;

    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: shownIds }),
    });
    if (!res.ok) return; // don't show "read" locally if it wasn't actually persisted
    const shown = new Set(shownIds);
    setNotifs(ns => ns.map(n => shown.has(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n));
  }

  useEffect(() => {
    // Request permission then do initial load
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    load(false);

    // Poll every 30s for new notifications
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNotification(n: Notification) {
      setNotifs(prev => [n, ...prev]);
      seenIds.current.add(n.id);
      showBrowserNotif(n);
    }
    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
  }, [socket]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle() {
    setOpen(v => !v);
    if (!open && unread > 0) markRead();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-50"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 brand-gradient text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-80 card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-sm">Notifications</span>
            <Link href="/notifications" className="text-xs text-pink-500 hover:text-pink-600" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No notifications yet</p>
            )}
            {notifs.slice(0, 10).map(n => (
              <Link
                key={n.id}
                href={notifLink(n)}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-pink-50 transition ${!n.read_at ? 'bg-pink-50/50' : ''}`}
              >
                {n.type === 'kindness_note' ? (
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">💛</div>
                ) : (
                  <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                    {n.actor_profile_picture
                      ? <img src={n.actor_profile_picture} alt="" className="w-full h-full object-cover" />
                      : n.actor_first_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {n.type === 'kindness_note' ? (
                      <span className="text-gray-600">Someone sent you kindness 💛</span>
                    ) : (
                      <>
                        <span className="font-semibold">{n.actor_first_name}</span>{' '}
                        <span className="text-gray-600">{notifText(n)}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read_at && <div className="w-2 h-2 rounded-full bg-pink-400 mt-1.5 flex-shrink-0" />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
