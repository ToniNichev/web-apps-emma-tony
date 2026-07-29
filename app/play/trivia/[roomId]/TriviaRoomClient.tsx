'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSocket } from '@/app/components/SocketProvider';
import { CATEGORIES } from '@/app/lib/trivia-categories';

type Option = 'a' | 'b' | 'c' | 'd';
const OPTION_KEYS: Option[] = ['a', 'b', 'c', 'd'];
const ALL_CATEGORIES = [...CATEGORIES, 'Mixed'] as const;
const CONFETTI_COLORS = ['#f472b6', '#a855f7', '#facc15', '#38bdf8', '#4ade80', '#fb923c'];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.6 + Math.random() * 1.6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: Math.round((Math.random() - 0.5) * 160),
  })), []);
  return (
    <div className="trivia-confetti-container" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="trivia-confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

interface Player {
  user_id: number;
  status: 'invited' | 'joined' | 'left';
  score: number;
  username: string;
  first_name: string;
  profile_picture: string | null;
}

interface RoundSnapshot {
  round: number;
  question: string;
  options: Record<Option, string>;
  deadline: number;
  already_answered: boolean;
  lifelines_used: Lifeline[];
  eliminated_options: Option[];
}

type Lifeline = 'fifty_fifty' | 'ai_friend';

interface RoomState {
  id: number;
  status: 'lobby' | 'active' | 'finished';
  category: string | null;
  current_round: number;
  total_rounds: number;
  host_id: number;
  host_first_name: string;
  host_username: string;
  players: Player[];
  my_status: 'invited' | 'joined' | 'left';
  current_round_snapshot: RoundSnapshot | null;
}

interface RoundResult {
  round: number;
  question: string;
  correct_option: Option;
  correct_answer_text: string;
  answers: Record<number, Option>;
  scores: Record<number, number>;
  match_winner_id?: number | null;
  match_finished?: boolean;
}

export default function TriviaRoomClient({
  roomId, currentUserId, initialRoom,
}: {
  roomId: number;
  currentUserId: number;
  initialRoom: RoomState;
}) {
  const socket = useAppSocket();
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [question, setQuestion] = useState<RoundSnapshot | null>(initialRoom.current_round_snapshot);
  // myAnswer is the option I actually picked, when known. answeredThisRound
  // covers the reload-mid-round case too: the server knows I've already
  // locked in an answer (current_round_snapshot.already_answered), but not
  // which one, since that's only tracked in memory alongside the round.
  const [myAnswer, setMyAnswer] = useState<Option | null>(null);
  const [answeredThisRound, setAnsweredThisRound] = useState(
    initialRoom.current_round_snapshot?.already_answered ?? false
  );
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  // Scores live here, separate from room.players[].score, because
  // room only gets refetched on a handful of events (join, start, rematch,
  // match finish) — round_started resets roundResult to null every round,
  // and without a persistent source the scoreboard would fall back to the
  // stale score from the last refetch (0-0 for most of the match).
  const [scores, setScores] = useState<Record<number, number>>(
    () => Object.fromEntries(initialRoom.players.map(p => [p.user_id, p.score]))
  );
  // lifelinesUsed persists for the whole match (reset only on rematch);
  // eliminatedOptions/aiFriendHint are per-round and clear when a new one starts.
  const [lifelinesUsed, setLifelinesUsed] = useState<Set<Lifeline>>(
    () => new Set(initialRoom.current_round_snapshot?.lifelines_used ?? [])
  );
  const [eliminatedOptions, setEliminatedOptions] = useState<Option[]>(
    initialRoom.current_round_snapshot?.eliminated_options ?? []
  );
  const [aiFriendHint, setAiFriendHint] = useState<{ answer: Option; reason: string } | null>(null);
  const [usingLifeline, setUsingLifeline] = useState<Lifeline | null>(null);
  const [lifelineError, setLifelineError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [category, setCategory] = useState<string>(ALL_CATEGORIES[ALL_CATEGORIES.length - 1]);
  const [starting, setStarting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const isHost = room.host_id === currentUserId;

  // Fires once when the match ends with this player as the sole winner —
  // not for ties or losses.
  useEffect(() => {
    if (room.status !== 'finished' || room.players.length === 0) {
      setShowConfetti(false);
      return;
    }
    const maxScore = Math.max(...room.players.map(p => p.score));
    const winners = room.players.filter(p => p.score === maxScore);
    const iWon = winners.length === 1 && winners[0].user_id === currentUserId;
    if (!iWon) return;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(t);
  }, [room.status, room.players, currentUserId]);

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/games/trivia/rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      setRoom(data);
      setScores(Object.fromEntries((data.players as Player[]).map(p => [p.user_id, p.score])));
      if (data.current_round_snapshot) {
        setQuestion(data.current_round_snapshot);
        setAnsweredThisRound(data.current_round_snapshot.already_answered);
        setLifelinesUsed(new Set(data.current_round_snapshot.lifelines_used));
        setEliminatedOptions(data.current_round_snapshot.eliminated_options);
      }
    }
  }, [roomId]);

  useEffect(() => {
    if (!socket || room.my_status !== 'joined') return;
    socket.emit('trivia:join_room', { room_id: roomId });
    return () => { socket.emit('trivia:leave_room', { room_id: roomId }); };
  }, [socket, roomId, room.my_status]);

  useEffect(() => {
    if (!socket) return;

    function onRoomUpdated() { refreshRoom(); }
    function onRoomDeleted() { router.push('/play/trivia'); }
    function onRoundStarted(data: { round: number; question: string; options: Record<Option, string>; deadline: number }) {
      // The host's own client already knows the room is active (startGame
      // calls refreshRoom on success), but this is the ONLY signal every
      // other player gets that the match has left the lobby — there's no
      // separate room_updated for that transition. Without flipping status
      // here too, everyone but the host stays stuck on the "waiting for
      // host to start" screen (the round-active UI is gated on
      // room.status === 'active') even though the question already arrived,
      // until they reload and get a fresh fetch.
      setRoom(r => (r.status === 'active' ? r : { ...r, status: 'active' }));
      setQuestion(q => ({ ...data, already_answered: false, lifelines_used: [...(q?.lifelines_used ?? [])], eliminated_options: [] }));
      setMyAnswer(null);
      setAnsweredThisRound(false);
      setRoundResult(null);
      setError(null);
      setEliminatedOptions([]);
      setAiFriendHint(null);
      setLifelineError(null);
    }
    function onRoundResult(result: RoundResult) {
      setRoundResult(result);
      setScores(result.scores);
      // question stays set — the reveal renders in the same option grid
      // (Millionaire-style: buttons recolor in place) rather than swapping
      // to a separate summary. onRoundStarted replaces it wholesale when
      // the next round begins.
      if (result.match_finished) {
        setTimeout(() => { refreshRoom(); }, 3000);
      }
    }
    function onRematch() {
      setQuestion(null);
      setMyAnswer(null);
      setAnsweredThisRound(false);
      setRoundResult(null);
      setLifelinesUsed(new Set());
      setEliminatedOptions([]);
      setAiFriendHint(null);
      setLifelineError(null);
      refreshRoom();
    }

    socket.on('trivia:room_updated', onRoomUpdated);
    socket.on('trivia:room_deleted', onRoomDeleted);
    socket.on('trivia:round_started', onRoundStarted);
    socket.on('trivia:round_result', onRoundResult);
    socket.on('trivia:rematch', onRematch);
    return () => {
      socket.off('trivia:room_updated', onRoomUpdated);
      socket.off('trivia:room_deleted', onRoomDeleted);
      socket.off('trivia:round_started', onRoundStarted);
      socket.off('trivia:round_result', onRoundResult);
      socket.off('trivia:rematch', onRematch);
    };
  }, [socket, roomId, router, refreshRoom]);

  // Countdown ticker for the round timer.
  useEffect(() => {
    if (!question) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [question]);

  async function joinRoom() {
    setJoining(true);
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/join`, { method: 'POST' });
    setJoining(false);
    if (res.ok) refreshRoom();
  }

  async function startGame() {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setStarting(false);
    if (res.ok) {
      refreshRoom();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Something went wrong');
    }
  }

  async function answer(option: Option) {
    if (answeredThisRound || !question) return;
    setMyAnswer(option);
    setAnsweredThisRound(true);
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Something went wrong');
      setMyAnswer(null);
      setAnsweredThisRound(false);
    }
  }

  async function useFiftyFifty() {
    if (usingLifeline || lifelinesUsed.has('fifty_fifty') || answeredThisRound || !question) return;
    setUsingLifeline('fifty_fifty');
    setLifelineError(null);
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/lifeline/fifty-fifty`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setUsingLifeline(null);
    if (res.ok) {
      setEliminatedOptions(data.eliminated);
      setLifelinesUsed(prev => new Set(prev).add('fifty_fifty'));
    } else {
      setLifelineError(data.message || 'Something went wrong');
    }
  }

  async function useAiFriend() {
    if (usingLifeline || lifelinesUsed.has('ai_friend') || answeredThisRound || !question) return;
    setUsingLifeline('ai_friend');
    setLifelineError(null);
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/lifeline/ai-friend`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setUsingLifeline(null);
    if (res.ok) {
      setAiFriendHint({ answer: data.answer, reason: data.reason });
      setLifelinesUsed(prev => new Set(prev).add('ai_friend'));
    } else {
      setLifelineError(data.message || 'Something went wrong');
    }
  }

  async function requestRematch() {
    setRematching(true);
    await fetch(`/api/games/trivia/rooms/${roomId}/rematch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setRematching(false);
  }

  async function leaveRoom() {
    if (!confirm(isHost ? 'Delete this match for everyone?' : 'Leave this match?')) return;
    const res = await fetch(`/api/games/trivia/rooms/${roomId}/${isHost ? '' : 'leave'}`, {
      method: isHost ? 'DELETE' : 'POST',
    });
    if (res.ok) router.push('/play/trivia');
  }

  // Invited, not yet accepted.
  if (room.my_status === 'invited') {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-5xl">🧠</p>
        <p className="text-gray-700 font-semibold">{room.host_first_name} invited you to a Trivia Duel!</p>
        <button
          onClick={joinRoom}
          disabled={joining}
          className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Accept challenge'}
        </button>
      </div>
    );
  }

  const joinedPlayers = room.players.filter(p => p.status === 'joined');

  return (
    <div className="space-y-4">
      {showConfetti && <Confetti />}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold brand-text">Trivia Duel 🧠</h1>
        <button onClick={leaveRoom} className="text-sm text-gray-400 hover:text-red-500 transition">
          {isHost ? 'Delete match' : 'Leave match'}
        </button>
      </div>

      {/* Scoreboard */}
      <div className="card p-4 flex flex-wrap gap-3 justify-center">
        {room.players.map(p => (
          <div key={p.user_id} className={`text-center px-3 py-1.5 rounded-xl ${p.user_id === currentUserId ? 'bg-purple-50' : ''}`}>
            <p className="text-xs text-gray-500">{p.user_id === currentUserId ? 'You' : p.first_name}</p>
            <p className="text-xl font-black brand-text">{scores[p.user_id] ?? p.score}</p>
          </div>
        ))}
      </div>

      {room.status === 'lobby' && (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-gray-500 text-center">
            {joinedPlayers.length} of {room.players.length} players joined
          </p>
          {isHost ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Pick a category</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${
                        category === cat ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-purple-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={startGame}
                disabled={starting || joinedPlayers.length < 2}
                className="w-full brand-gradient text-white font-semibold py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {starting ? 'Starting…' : joinedPlayers.length < 2 ? 'Waiting for players…' : 'Start game'}
              </button>
            </>
          ) : (
            <p className="text-center text-gray-400">Waiting for {room.host_first_name} to start the game…</p>
          )}
        </div>
      )}

      {room.status === 'active' && question && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">Round {question.round} of {room.total_rounds}</span>
            {!roundResult && (() => {
              const secondsLeft = Math.max(0, Math.ceil((question.deadline - now) / 1000));
              return (
                <span className={`text-2xl font-black tabular-nums ${secondsLeft <= 5 && secondsLeft > 0 ? 'text-red-500 trivia-timer-blink' : 'text-gray-500'}`}>
                  {secondsLeft}s
                </span>
              );
            })()}
          </div>
          <p className="font-semibold text-gray-800 text-center text-lg">{question.question}</p>
          {!roundResult && !answeredThisRound && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={useFiftyFifty}
                disabled={!!usingLifeline || lifelinesUsed.has('fifty_fifty')}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {usingLifeline === 'fifty_fifty' ? 'Eliminating…' : '✂️ 50/50'}
              </button>
              <button
                onClick={useAiFriend}
                disabled={!!usingLifeline || lifelinesUsed.has('ai_friend')}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {usingLifeline === 'ai_friend' ? 'Calling…' : '🤖 Ask AI friend'}
              </button>
            </div>
          )}
          {lifelineError && <p className="text-center text-xs text-red-500">{lifelineError}</p>}
          {aiFriendHint && !roundResult && (
            <p className="text-center text-xs text-purple-700 bg-purple-50 rounded-lg py-2 px-3">
              🤖 Your AI friend says <strong>{aiFriendHint.answer.toUpperCase()}</strong> — “{aiFriendHint.reason}”
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OPTION_KEYS.map(opt => {
              const isCorrect = roundResult?.correct_option === opt;
              const isMyWrongPick = !!roundResult && myAnswer === opt && !isCorrect;
              const isEliminated = !roundResult && eliminatedOptions.includes(opt);
              const pickers = roundResult
                ? room.players.filter(p => p.status === 'joined' && roundResult.answers[p.user_id] === opt)
                : [];
              const style = roundResult
                ? isCorrect
                  ? 'bg-green-100 border-green-400 text-green-800 font-semibold trivia-correct-pulse'
                  : isMyWrongPick
                    ? 'bg-red-100 border-red-400 text-red-700 font-semibold'
                    : 'border-gray-200 text-gray-400'
                : isEliminated
                  ? 'border-gray-100 text-gray-300 line-through'
                  : myAnswer === opt
                    ? 'bg-purple-100 border-purple-300 text-purple-700 font-semibold'
                    : 'border-gray-200 hover:border-purple-200';
              return (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  disabled={answeredThisRound || !!roundResult || isEliminated}
                  className={`text-left px-4 py-3 rounded-xl border text-sm transition disabled:opacity-60 ${style}`}
                >
                  <span className="font-bold mr-2">{opt.toUpperCase()}</span>{question.options[opt]}
                  {pickers.length > 0 && (
                    <span className="block text-xs mt-1 font-normal opacity-75">
                      {pickers.map(p => p.user_id === currentUserId ? 'You' : p.first_name).join(', ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!roundResult && answeredThisRound && <p className="text-center text-xs text-gray-400">Answer locked in — waiting for the others…</p>}
          {roundResult && <p className="text-center text-xs text-gray-400">Next question coming up…</p>}
          {error && <p className="text-center text-xs text-red-500">{error}</p>}
        </div>
      )}

      {room.status === 'finished' && (
        <div className="card p-8 text-center space-y-4">
          {(() => {
            const maxScore = Math.max(...room.players.map(p => p.score));
            const winners = room.players.filter(p => p.score === maxScore);
            const iWon = winners.length === 1 && winners[0].user_id === currentUserId;
            const tied = winners.length > 1;
            return (
              <>
                <p className="text-5xl">{tied ? '🤝' : iWon ? '🎉' : '😢'}</p>
                <p className="font-bold text-lg text-gray-700">
                  {tied ? "It's a tie!" : iWon ? 'You won the match!' : `${winners[0].first_name} won the match!`}
                </p>
              </>
            );
          })()}
          <div className="space-y-1.5">
            {[...room.players].sort((a, b) => b.score - a.score).map(p => (
              <div key={p.user_id} className="flex items-center justify-between text-sm px-4">
                <span className="text-gray-600">{p.user_id === currentUserId ? 'You' : p.first_name}</span>
                <span className="font-bold text-gray-800">{p.score}</span>
              </div>
            ))}
          </div>
          {isHost ? (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap justify-center gap-2">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      category === cat ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-purple-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                onClick={requestRematch}
                disabled={rematching}
                className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {rematching ? 'Starting…' : 'Play again'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Waiting for {room.host_first_name} to start a new game…</p>
          )}
        </div>
      )}
    </div>
  );
}
