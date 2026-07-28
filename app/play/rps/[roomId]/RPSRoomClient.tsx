'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSocket } from '@/app/components/SocketProvider';

const WINS_NEEDED = 3;
const MOVES: { id: Move; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '✊', label: 'Rock' },
  { id: 'paper', emoji: '✋', label: 'Paper' },
  { id: 'scissors', emoji: '✌️', label: 'Scissors' },
];
const REVEAL_MS = 2500;

type Move = 'rock' | 'paper' | 'scissors';

function emojiFor(move: Move) {
  return MOVES.find(m => m.id === move)?.emoji ?? '❓';
}

interface Player {
  user_id: number;
  status: 'invited' | 'joined' | 'left';
  score: number;
  username: string;
  first_name: string;
  profile_picture: string | null;
}

interface RoomState {
  id: number;
  status: 'lobby' | 'active' | 'finished';
  round: number;
  host_id: number;
  host_first_name: string;
  host_username: string;
  players: Player[];
  my_status: 'invited' | 'joined' | 'left';
}

interface RoundResult {
  round: number;
  moves: Record<number, Move>;
  winner_id: number | null;
  scores: Record<number, number>;
  match_winner_id: number | null;
}

export default function RPSRoomClient({
  roomId, currentUserId, initialRoom,
}: {
  roomId: number;
  currentUserId: number;
  initialRoom: RoomState;
}) {
  const socket = useAppSocket();
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [myPick, setMyPick] = useState<Move | null>(null);
  const [opponentPicked, setOpponentPicked] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [picking, setPicking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = room.host_id === currentUserId;
  const me = room.players.find(p => p.user_id === currentUserId);
  const opponent = room.players.find(p => p.user_id !== currentUserId);

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/games/rps/rooms/${roomId}`);
    if (res.ok) setRoom(await res.json());
  }, [roomId]);

  useEffect(() => {
    if (!socket || room.my_status !== 'joined') return;
    socket.emit('rps:join_room', { room_id: roomId });
    return () => { socket.emit('rps:leave_room', { room_id: roomId }); };
  }, [socket, roomId, room.my_status]);

  useEffect(() => {
    if (!socket) return;

    function onRoomUpdated() { refreshRoom(); }
    function onRoomDeleted() { router.push('/play/rps'); }
    function onOpponentPicked() { setOpponentPicked(true); }
    function onRoundResult(result: RoundResult) {
      setRoundResult(result);
      setOpponentPicked(false);
      setTimeout(() => {
        setMyPick(null);
        setRoundResult(null);
        refreshRoom();
      }, REVEAL_MS);
    }
    function onRematch() {
      setMyPick(null);
      setOpponentPicked(false);
      setRoundResult(null);
      refreshRoom();
    }

    socket.on('rps:room_updated', onRoomUpdated);
    socket.on('rps:room_deleted', onRoomDeleted);
    socket.on('rps:opponent_picked', onOpponentPicked);
    socket.on('rps:round_result', onRoundResult);
    socket.on('rps:rematch', onRematch);
    return () => {
      socket.off('rps:room_updated', onRoomUpdated);
      socket.off('rps:room_deleted', onRoomDeleted);
      socket.off('rps:opponent_picked', onOpponentPicked);
      socket.off('rps:round_result', onRoundResult);
      socket.off('rps:rematch', onRematch);
    };
  }, [socket, roomId, router, refreshRoom]);

  async function joinRoom() {
    setJoining(true);
    const res = await fetch(`/api/games/rps/rooms/${roomId}/join`, { method: 'POST' });
    setJoining(false);
    if (res.ok) refreshRoom();
  }

  async function pick(move: Move) {
    if (myPick || picking) return;
    setPicking(true);
    setError(null);
    setMyPick(move);
    const res = await fetch(`/api/games/rps/rooms/${roomId}/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move }),
    });
    setPicking(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Something went wrong');
      setMyPick(null);
    }
  }

  async function requestRematch() {
    setRematching(true);
    await fetch(`/api/games/rps/rooms/${roomId}/rematch`, { method: 'POST' });
    setRematching(false);
  }

  async function leaveRoom() {
    if (!confirm("Leave this match? It'll end for both of you.")) return;
    const res = await fetch(`/api/games/rps/rooms/${roomId}/leave`, { method: 'POST' });
    if (res.ok) router.push('/play/rps');
  }

  // Invited, not yet accepted.
  if (room.my_status === 'invited') {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-5xl">✊✋✌️</p>
        <p className="text-gray-700 font-semibold">{room.host_first_name} challenged you to Rock-Paper-Scissors!</p>
        <button
          onClick={joinRoom}
          disabled={joining}
          className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {joining ? 'Accepting…' : 'Accept challenge'}
        </button>
      </div>
    );
  }

  // Waiting for the opponent to accept.
  if (room.status === 'lobby') {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-5xl">⏳</p>
        <p className="text-gray-500">Waiting for {opponent?.first_name ?? 'your friend'} to accept the challenge…</p>
        <button onClick={leaveRoom} className="text-sm text-red-400 hover:text-red-600 transition">Cancel challenge</button>
      </div>
    );
  }

  const myScore = roundResult ? roundResult.scores[currentUserId] : (me?.score ?? 0);
  const oppScore = opponent ? (roundResult ? roundResult.scores[opponent.user_id] : opponent.score) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold brand-text">Rock-Paper-Scissors ✊</h1>
        <button onClick={leaveRoom} className="text-sm text-gray-400 hover:text-red-500 transition">Leave match</button>
      </div>

      <div className="card p-5 flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-sm text-gray-400">You</p>
          <p className="text-3xl font-black brand-text">{myScore}</p>
        </div>
        <p className="text-gray-300 text-sm">first to {WINS_NEEDED}</p>
        <div className="text-center">
          <p className="text-sm text-gray-400">{opponent?.first_name ?? '…'}</p>
          <p className="text-3xl font-black text-gray-500">{oppScore}</p>
        </div>
      </div>

      {room.status === 'finished' ? (
        <div className="card p-8 text-center space-y-4">
          <p className="text-5xl">{myScore > oppScore ? '🎉' : '😢'}</p>
          <p className="font-bold text-lg text-gray-700">
            {myScore > oppScore ? 'You won the match!' : `${opponent?.first_name ?? 'Your opponent'} won the match`}
          </p>
          {isHost ? (
            <button
              onClick={requestRematch}
              disabled={rematching}
              className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {rematching ? 'Starting…' : 'Play again'}
            </button>
          ) : (
            <p className="text-sm text-gray-400">Waiting for {room.host_first_name} to start a new game…</p>
          )}
        </div>
      ) : roundResult ? (
        <div className="card p-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-8 text-6xl">
            <span>{emojiFor(roundResult.moves[currentUserId])}</span>
            <span className="text-2xl text-gray-300">vs</span>
            <span>{opponent ? emojiFor(roundResult.moves[opponent.user_id]) : ''}</span>
          </div>
          <p className="font-bold text-lg">
            {roundResult.winner_id === null
              ? "It's a tie!"
              : roundResult.winner_id === currentUserId
                ? 'You win this round! 🎉'
                : `${opponent?.first_name ?? 'Opponent'} wins this round`}
          </p>
        </div>
      ) : (
        <div className="card p-8 text-center space-y-5">
          {myPick ? (
            <>
              <p className="text-6xl">{emojiFor(myPick)}</p>
              <p className="text-gray-400">{opponentPicked ? 'Revealing…' : `Waiting for ${opponent?.first_name ?? 'opponent'}…`}</p>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">Make your move!</p>
              <div className="flex items-center justify-center gap-4">
                {MOVES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => pick(m.id)}
                    disabled={picking}
                    className="w-20 h-20 rounded-2xl bg-purple-50 hover:bg-purple-100 active:scale-95 flex items-center justify-center text-4xl transition disabled:opacity-50"
                    title={m.label}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
