'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppSocket } from '@/app/components/SocketProvider';

const CANVAS_W = 500;
const CANVAS_H = 375;
const COLORS = ['#1f2937', '#ef4444', '#3b82f6', '#22c55e'];

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
  current_round: number;
  current_drawer_id: number | null;
  round_started_at: string | null;
  host_id: number;
  host_first_name: string;
  host_username: string;
  players: Player[];
  my_status: 'invited' | 'joined' | 'left';
  is_drawer: boolean;
  word: string | null;
}

interface GuessEntry {
  user_id: number;
  first_name: string;
  text: string;
  correct: boolean;
}

type Stroke = { type: 'start' | 'move'; x: number; y: number; color: string } | { type: 'end' };

export default function DrawGuessRoomClient({
  roomId, currentUserId, initialRoom,
}: {
  roomId: number;
  currentUserId: number;
  initialRoom: RoomState;
}) {
  const socket = useAppSocket();
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [roundResult, setRoundResult] = useState<{ reason: string; word: string | null; winner_id: number | null } | null>(null);
  const [guessText, setGuessText] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const isHost = room.host_id === currentUserId;
  const isDrawer = room.is_drawer;
  const canDraw = isDrawer && room.status === 'active';

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/games/draw/rooms/${roomId}`);
    if (res.ok) setRoom(await res.json());
  }, [roomId]);

  // Join the socket room for live updates while this page is open.
  useEffect(() => {
    if (!socket) return;
    socket.emit('game:join_room', { room_id: roomId });
    return () => { socket.emit('game:leave_room', { room_id: roomId }); };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;

    function onRoundStarted(data: { round: number; drawer_id: number; deadline: number }) {
      setDeadline(data.deadline);
      setGuesses([]);
      setRoundResult(null);
      clearCanvas();
      refreshRoom();
    }
    function onYourTurn(data: { room_id: number; word: string; deadline: number; round: number }) {
      if (data.room_id !== roomId) return;
      setDeadline(data.deadline);
      refreshRoom();
    }
    function onRoundEnded(data: { reason: string; word: string | null; winner_id: number | null }) {
      setDeadline(null);
      setRoundResult(data);
      refreshRoom();
    }
    function onGuess(entry: GuessEntry) {
      setGuesses(g => [...g, entry]);
    }
    function onDrawStroke({ stroke }: { stroke: Stroke }) {
      applyStroke(stroke);
    }
    function onClear() {
      clearCanvas();
    }
    // Sent once, right after game:join_room, with everything drawn so far
    // this round — without it, joining mid-round (or refreshing/reconnecting)
    // left the canvas blank until the drawer's next stroke.
    function onStrokeHistory({ strokes }: { strokes: Stroke[] }) {
      clearCanvas();
      for (const stroke of strokes) applyStroke(stroke);
    }
    function onRoomUpdated() {
      refreshRoom();
    }

    socket.on('game:round_started', onRoundStarted);
    socket.on('game:your_turn', onYourTurn);
    socket.on('game:round_ended', onRoundEnded);
    socket.on('game:guess', onGuess);
    socket.on('game:draw_stroke', onDrawStroke);
    socket.on('game:clear_canvas', onClear);
    socket.on('game:stroke_history', onStrokeHistory);
    socket.on('game:room_updated', onRoomUpdated);
    return () => {
      socket.off('game:round_started', onRoundStarted);
      socket.off('game:your_turn', onYourTurn);
      socket.off('game:round_ended', onRoundEnded);
      socket.off('game:guess', onGuess);
      socket.off('game:draw_stroke', onDrawStroke);
      socket.off('game:clear_canvas', onClear);
      socket.off('game:stroke_history', onStrokeHistory);
      socket.off('game:room_updated', onRoomUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId]);

  // Countdown ticker — secondsLeft is derived from `now` during render, this
  // effect only subscribes to the passage of time while a round is active.
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  function ctx() {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function clearCanvas() {
    const c = ctx();
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  function applyStroke(stroke: Stroke) {
    const c = ctx();
    if (!c) return;
    if (stroke.type === 'end') { lastPoint.current = null; return; }
    if (stroke.type === 'start') {
      lastPoint.current = { x: stroke.x, y: stroke.y };
      return;
    }
    // 'move'
    const from = lastPoint.current ?? { x: stroke.x, y: stroke.y };
    c.strokeStyle = stroke.color;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(stroke.x, stroke.y);
    c.stroke();
    lastPoint.current = { x: stroke.x, y: stroke.y };
  }

  function toCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  }

  function sendStroke(stroke: Stroke) {
    socket?.emit('game:draw_stroke', { room_id: roomId, stroke });
    applyStroke(stroke);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    drawingRef.current = true;
    const { x, y } = toCanvasCoords(e);
    sendStroke({ type: 'start', x, y, color });
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawingRef.current) return;
    const { x, y } = toCanvasCoords(e);
    sendStroke({ type: 'move', x, y, color });
  }
  function onPointerUp() {
    if (!canDraw || !drawingRef.current) return;
    drawingRef.current = false;
    sendStroke({ type: 'end' });
  }

  function requestClear() {
    if (!canDraw) return;
    clearCanvas();
    socket?.emit('game:clear_canvas', { room_id: roomId });
  }

  async function startRound() {
    setStarting(true);
    const res = await fetch(`/api/games/draw/rooms/${roomId}/start-round`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setStarting(false);
    if (!res.ok) alert(data.message || 'Could not start round');
  }

  async function joinRoom() {
    setJoining(true);
    const res = await fetch(`/api/games/draw/rooms/${roomId}/join`, { method: 'POST' });
    setJoining(false);
    if (res.ok) refreshRoom();
  }

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!guessText.trim()) return;
    const text = guessText.trim();
    setGuessText('');
    await fetch(`/api/games/draw/rooms/${roomId}/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: text }),
    });
  }

  if (room.my_status === 'invited') {
    return (
      <div className="card p-10 text-center space-y-4">
        <p className="text-4xl">🎨</p>
        <p className="text-gray-700 font-semibold">{room.host_first_name} invited you to play Draw &amp; Guess!</p>
        <button
          onClick={joinRoom}
          disabled={joining}
          className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join game'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold brand-text">Draw &amp; Guess 🎨</h1>
        {secondsLeft !== null && (
          <span className="text-sm font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">⏱ {secondsLeft}s</span>
        )}
      </div>

      {/* Scoreboard */}
      <div className="flex flex-wrap gap-2">
        {room.players.filter(p => p.status === 'joined').map(p => (
          <div key={p.user_id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            p.user_id === room.current_drawer_id ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {p.user_id === room.current_drawer_id && '✏️ '}{p.first_name} · {p.score}
          </div>
        ))}
      </div>

      {isDrawer && room.word && room.status === 'active' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
          <span className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Draw this: </span>
          <span className="text-lg font-bold text-amber-800">{room.word}</span>
        </div>
      )}

      {roundResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-center text-sm text-purple-700">
          {roundResult.reason === 'guessed'
            ? `🎉 ${room.players.find(p => p.user_id === roundResult.winner_id)?.first_name ?? 'Someone'} guessed it! The word was "${roundResult.word}"`
            : `⏰ Time's up! The word was "${roundResult.word}"`}
        </div>
      )}

      {/* Canvas */}
      <div className="card overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={`w-full bg-white touch-none ${canDraw ? 'cursor-crosshair' : ''}`}
          style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {canDraw && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-purple-400' : 'border-transparent'}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <button onClick={requestClear} className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Guess feed + input */}
      <div className="card p-3 space-y-2 max-h-48 overflow-y-auto">
        {guesses.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Guesses will show up here</p>}
        {guesses.map((g, i) => (
          <p key={i} className={`text-sm ${g.correct ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
            <span className="font-semibold">{g.first_name}:</span> {g.text} {g.correct && '✅'}
          </p>
        ))}
      </div>

      {!isDrawer && room.status === 'active' && !roundResult && (
        <form onSubmit={submitGuess} className="flex gap-2">
          <input
            value={guessText}
            onChange={e => setGuessText(e.target.value)}
            placeholder="Type your guess…"
            maxLength={50}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button type="submit" disabled={!guessText.trim()} className="brand-gradient text-white font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-50">
            Guess
          </button>
        </form>
      )}

      {isHost && (room.status === 'lobby' || room.status === 'finished' || (room.status === 'active' && !!roundResult)) && (
        <button
          onClick={startRound}
          disabled={starting || room.players.filter(p => p.status === 'joined').length < 2}
          className="w-full brand-gradient text-white font-semibold py-3 rounded-2xl disabled:opacity-50"
        >
          {starting ? 'Starting…' : room.current_round > 0 ? 'Start next round' : 'Start game'}
        </button>
      )}
      {isHost && room.players.filter(p => p.status === 'joined').length < 2 && (
        <p className="text-xs text-gray-400 text-center">Waiting for at least one friend to join…</p>
      )}
    </div>
  );
}
