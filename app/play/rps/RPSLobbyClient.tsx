'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Room {
  id: number;
  status: 'lobby' | 'active' | 'finished';
  created_at: string;
  host_username: string;
  host_first_name: string;
  my_status: 'invited' | 'joined' | 'left';
  opponent_first_name: string | null;
  player_count: number;
}

interface Friend {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
}

export default function RPSLobbyClient({ initialRooms, friends }: { initialRooms: Room[]; friends: Friend[] }) {
  const router = useRouter();
  const rooms = initialRooms;
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (selected === null) return;
    setCreating(true);
    setError(null);
    const res = await fetch('/api/games/rps/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_user_id: selected }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok) {
      router.push(`/play/rps/${data.id}`);
    } else {
      setError(data.message || 'Something went wrong');
    }
  }

  return (
    <div className="space-y-5">
      {!picking ? (
        <button
          onClick={() => setPicking(true)}
          className="w-full brand-gradient text-white font-semibold py-3 rounded-2xl hover:opacity-90 transition"
        >
          + Challenge a friend
        </button>
      ) : (
        <div className="card p-5 space-y-4">
          <p className="font-semibold text-sm text-gray-700">Who are you challenging? (mutual followers only)</p>
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400">Follow some friends who follow you back to challenge them.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {friends.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                    selected === f.id
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-purple-200'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full brand-gradient flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0">
                    {f.profile_picture
                      ? <img src={f.profile_picture} alt="" className="w-full h-full object-cover" />
                      : f.first_name[0]}
                  </span>
                  {f.first_name}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setPicking(false); setSelected(null); setError(null); }}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={createRoom}
              disabled={selected === null || creating}
              className="ml-auto brand-gradient text-white font-semibold px-5 py-2 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {creating ? 'Sending…' : 'Send challenge'}
            </button>
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">✊✋✌️</p>
          <p className="text-gray-400 font-medium">No matches yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map(r => (
            <Link
              key={r.id}
              href={`/play/rps/${r.id}`}
              className="flex items-center justify-between card px-4 py-3 hover:bg-purple-50 transition"
            >
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  vs {r.opponent_first_name ?? '…'}
                  {r.my_status === 'invited' && <span className="ml-2 text-xs text-purple-500 font-bold">Challenged you!</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.status === 'finished' ? 'Match finished' : r.status === 'active' ? 'In progress' : 'Waiting to start'}
                </p>
              </div>
              <span className="text-purple-400 text-sm font-semibold">
                {r.my_status === 'invited' ? 'Accept →' : 'Play →'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
