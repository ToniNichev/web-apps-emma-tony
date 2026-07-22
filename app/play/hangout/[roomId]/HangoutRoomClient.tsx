'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppSocket } from '@/app/components/SocketProvider';
import { HANGOUT_OBJECTS, ROOM_W, ROOM_H, BARRIER_RADIUS, emojiForType, type HangoutObjectType } from '@/app/lib/hangout-objects';
import { defaultEmojiFor, defaultColorHexFor, colorHex } from '@/app/lib/avatar-options';

const AVATAR_SIZE = 40;
const MOVE_SPEED = 240; // px/sec
const SEND_INTERVAL_MS = 100; // ~10Hz
const INTERP_MS = 100;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const OBJECT_RADIUS = 22; // roughly matches the decoration emoji's rendered size

interface Player {
  user_id: number;
  status: 'invited' | 'joined' | 'left';
  username: string;
  first_name: string;
  profile_picture: string | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
  avatar_accessory: string | null;
}

interface RoomObject {
  id: number;
  object_type: HangoutObjectType;
  x: number;
  y: number;
  placed_by: number;
}

interface Barrier {
  id: number;
  x: number;
  y: number;
}

interface RoomState {
  id: number;
  host_id: number;
  host_first_name: string;
  host_username: string;
  background_url: string | null;
  background_status: 'active' | 'reported';
  players: Player[];
  objects: RoomObject[];
  barriers: Barrier[];
  my_status: 'invited' | 'joined' | 'left';
}

interface OtherPlayer {
  fromX: number; fromY: number; toX: number; toY: number;
  startTs: number; lastUpdateTs: number;
  first_name: string; profile_picture: string | null;
}

interface ChatMessage {
  user_id: number;
  first_name: string;
  profile_picture: string | null;
  text: string;
  t: number;
}

const MAX_CHAT_MESSAGES = 50;

export default function HangoutRoomClient({
  roomId, currentUserId, initialRoom,
}: {
  roomId: number;
  currentUserId: number;
  initialRoom: RoomState;
}) {
  const socket = useAppSocket();
  const [room, setRoom] = useState(initialRoom);
  const [me, setMe] = useState({ x: ROOM_W / 2, y: ROOM_H / 2 });
  const [objects, setObjects] = useState<RoomObject[]>(initialRoom.objects);
  const [barriers, setBarriers] = useState<Barrier[]>(initialRoom.barriers);
  const [barrierMode, setBarrierMode] = useState(false);
  const [background, setBackground] = useState(initialRoom.background_url);
  const [selectedObject, setSelectedObject] = useState<HangoutObjectType | null>(null);
  const [joining, setJoining] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const [bgPrompt, setBgPrompt] = useState('');
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgError, setBgError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [others, setOthers] = useState<Map<number, OtherPlayer>>(() => new Map());
  // `now` is the single tick driving both interpolation and presence-fade math
  // during render — reading Date.now()/performance.now() directly in render
  // is impure (React may re-run render without committing); this way the
  // "current time" is an ordinary piece of state instead.
  const [now, setNow] = useState(() => Date.now());
  const stageRef = useRef<HTMLDivElement>(null);
  const heldKeys = useRef(new Set<string>());
  const lastSentAt = useRef(0);
  const isHost = room.host_id === currentUserId;

  function currentRenderPos(p: OtherPlayer) {
    const t = Math.min(1, (now - p.startTs) / INTERP_MS);
    return { x: p.fromX + (p.toX - p.fromX) * t, y: p.fromY + (p.toY - p.fromY) * t };
  }

  function opacityFor(p: OtherPlayer) {
    const age = now - p.lastUpdateTs;
    if (age < 8000) return 1;
    if (age < 15000) return 1 - (age - 8000) / 7000;
    return 0;
  }

  // Looked up fresh from room.players on every render — avatar customization
  // rarely changes and isn't carried over the movement socket payload at all,
  // so there's no staleness risk the way there was for name/picture earlier.
  function avatarPropsFor(userId: number) {
    const p = room.players.find(pl => pl.user_id === userId);
    return {
      emoji: p?.avatar_emoji || defaultEmojiFor(userId),
      color: colorHex(p?.avatar_color) || defaultColorHexFor(userId),
      accessory: p?.avatar_accessory || null,
    };
  }

  const refreshRoom = useCallback(async () => {
    const res = await fetch(`/api/hangout/rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      setRoom(data);
      setObjects(data.objects);
      setBarriers(data.barriers);
      setBackground(data.background_url);
    }
  }, [roomId]);

  // Join the socket room while this page is open.
  useEffect(() => {
    if (!socket || room.my_status !== 'joined') return;
    socket.emit('hangout:join_room', { room_id: roomId });
    return () => { socket.emit('hangout:leave_room', { room_id: roomId }); };
  }, [socket, roomId, room.my_status]);

  useEffect(() => {
    if (!socket) return;
    function onMove(data: { user_id: number; x: number; y: number; first_name: string; profile_picture: string | null }) {
      if (data.user_id === currentUserId) return;
      setOthers(prev => {
        const next = new Map(prev);
        const existing = next.get(data.user_id);
        const from = existing ? currentRenderPos(existing) : { x: data.x, y: data.y };
        next.set(data.user_id, {
          fromX: from.x, fromY: from.y, toX: data.x, toY: data.y,
          startTs: Date.now(), lastUpdateTs: Date.now(),
          first_name: data.first_name, profile_picture: data.profile_picture,
        });
        return next;
      });
    }
    function onUserLeft({ user_id }: { user_id: number }) {
      setOthers(prev => {
        if (!prev.has(user_id)) return prev;
        const next = new Map(prev);
        next.delete(user_id);
        return next;
      });
    }
    function onRoomUpdated() { refreshRoom(); }
    function onObjectPlaced(obj: RoomObject) {
      setObjects(os => [...os, obj]);
    }
    function onObjectRemoved({ id }: { id: number }) {
      setObjects(os => os.filter(o => o.id !== id));
    }
    function onBarrierPlaced(b: Barrier) {
      setBarriers(bs => [...bs, b]);
    }
    function onBarrierRemoved({ id }: { id: number }) {
      setBarriers(bs => bs.filter(b => b.id !== id));
    }
    function onBackgroundUpdated({ url }: { url: string | null }) {
      setBackground(url);
    }
    function onChat(msg: ChatMessage) {
      setMessages(ms => [...ms, msg].slice(-MAX_CHAT_MESSAGES));
    }

    socket.on('hangout:move', onMove);
    socket.on('hangout:user_left', onUserLeft);
    socket.on('hangout:room_updated', onRoomUpdated);
    socket.on('hangout:object_placed', onObjectPlaced);
    socket.on('hangout:object_removed', onObjectRemoved);
    socket.on('hangout:barrier_placed', onBarrierPlaced);
    socket.on('hangout:barrier_removed', onBarrierRemoved);
    socket.on('hangout:background_updated', onBackgroundUpdated);
    socket.on('hangout:chat', onChat);
    return () => {
      socket.off('hangout:move', onMove);
      socket.off('hangout:user_left', onUserLeft);
      socket.off('hangout:room_updated', onRoomUpdated);
      socket.off('hangout:object_placed', onObjectPlaced);
      socket.off('hangout:object_removed', onObjectRemoved);
      socket.off('hangout:barrier_placed', onBarrierPlaced);
      socket.off('hangout:barrier_removed', onBarrierRemoved);
      socket.off('hangout:background_updated', onBackgroundUpdated);
      socket.off('hangout:chat', onChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, currentUserId, refreshRoom]);

  // Keyboard movement — track held keys, move every animation frame.
  useEffect(() => {
    if (room.my_status !== 'joined') return;
    function onKeyDown(e: KeyboardEvent) { heldKeys.current.add(e.key.toLowerCase()); }
    function onKeyUp(e: KeyboardEvent) { heldKeys.current.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [room.my_status]);

  const touchDir = useRef({ x: 0, y: 0 });

  // Read inside the movement rAF loop below, not during render — kept in sync
  // via the effects underneath so the loop always checks against the latest
  // decorations/barriers without needing to be torn down and restarted every
  // time someone places or removes one.
  const obstaclesRef = useRef<{ x: number; y: number; radius: number }[]>([]);
  useEffect(() => {
    obstaclesRef.current = [
      ...objects.map(o => ({ x: o.x, y: o.y, radius: OBJECT_RADIUS })),
      ...barriers.map(b => ({ x: b.x, y: b.y, radius: BARRIER_RADIUS })),
    ];
  }, [objects, barriers]);

  // Compares distance-to-obstacle at the current vs. proposed position, not
  // just an absolute radius check — a pure radius check can permanently trap
  // a player if an obstacle ever ends up on top of them (a decoration placed
  // right where they're standing, an unlucky spawn, or a barrier drawn under
  // someone already there). Every incremental step "away" would otherwise
  // still land inside the radius and get rejected forever. Comparing to the
  // current distance means moving away is always allowed.
  function blockedByObstacle(fromX: number, fromY: number, toX: number, toY: number): boolean {
    return obstaclesRef.current.some(o => {
      const combined = AVATAR_RADIUS + o.radius;
      const distFrom = Math.hypot(fromX - o.x, fromY - o.y);
      const distTo = Math.hypot(toX - o.x, toY - o.y);
      if (distFrom >= combined) return distTo < combined;
      return distTo < distFrom;
    });
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (room.my_status !== 'joined') return;
    let raf: number;
    let last = performance.now();
    function frame(rafTime: number) {
      const dt = (rafTime - last) / 1000;
      last = rafTime;
      const keys = heldKeys.current;
      let dx = touchDir.current.x;
      let dy = touchDir.current.y;
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
      if (keys.has('arrowright') || keys.has('d')) dx += 1;
      if (keys.has('arrowup') || keys.has('w')) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        const stepX = (dx / len) * MOVE_SPEED * dt;
        const stepY = (dy / len) * MOVE_SPEED * dt;
        setMe(pos => {
          // Axis-separated collision so bumping into a decoration or a
          // marked-off barrier slides you along it instead of stopping dead.
          let nx = pos.x;
          let ny = pos.y;
          const tryX = Math.max(0, Math.min(ROOM_W, pos.x + stepX));
          if (!blockedByObstacle(pos.x, pos.y, tryX, ny)) nx = tryX;
          const tryY = Math.max(0, Math.min(ROOM_H, pos.y + stepY));
          if (!blockedByObstacle(pos.x, pos.y, nx, tryY)) ny = tryY;
          return { x: nx, y: ny };
        });
      }
      setNow(Date.now());
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [room.my_status]);

  // Send my position, throttled — only while it's actually changing.
  useEffect(() => {
    if (!socket || room.my_status !== 'joined') return;
    const now = Date.now();
    if (now - lastSentAt.current < SEND_INTERVAL_MS) return;
    lastSentAt.current = now;
    socket.emit('hangout:move', { room_id: roomId, x: me.x, y: me.y });
  }, [me, socket, roomId, room.my_status]);

  async function joinRoom() {
    setJoining(true);
    const res = await fetch(`/api/hangout/rooms/${roomId}/join`, { method: 'POST' });
    setJoining(false);
    if (res.ok) refreshRoom();
  }

  function onStageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * ROOM_W);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * ROOM_H);

    if (barrierMode) {
      // Clicking on an existing barrier removes it (paint/erase toggle);
      // clicking empty space adds a new one.
      const hit = barriers.find(b => Math.hypot(b.x - x, b.y - y) < BARRIER_RADIUS);
      if (hit) removeBarrier(hit.id);
      else placeBarrier(x, y);
      return;
    }
    if (selectedObject) placeObject(selectedObject, x, y);
  }

  async function placeObject(object_type: HangoutObjectType, x: number, y: number) {
    await fetch(`/api/hangout/rooms/${roomId}/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_type, x, y }),
    });
    setSelectedObject(null);
  }

  async function removeObject(id: number) {
    await fetch(`/api/hangout/rooms/${roomId}/objects/${id}`, { method: 'DELETE' });
  }

  async function placeBarrier(x: number, y: number) {
    await fetch(`/api/hangout/rooms/${roomId}/barriers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  }

  async function removeBarrier(id: number) {
    await fetch(`/api/hangout/rooms/${roomId}/barriers/${id}`, { method: 'DELETE' });
  }

  async function generateBackground(e: React.FormEvent) {
    e.preventDefault();
    if (!bgPrompt.trim()) return;
    setBgGenerating(true);
    setBgProgress(0);
    setBgError(null);
    try {
      const res = await fetch(`/api/hangout/rooms/${roomId}/background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: bgPrompt }),
      });
      if (!res.ok || !res.body) { setBgError('Something went wrong'); setBgGenerating(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (typeof data.progress === 'number') setBgProgress(data.progress);
            if (data.url) { setBackground(data.url); setShowBgPrompt(false); setBgPrompt(''); }
            if (data.error) setBgError(data.error);
          } catch {}
        }
      }
    } finally {
      setBgGenerating(false);
    }
  }

  async function reportBackground() {
    if (!confirm('Report this background for admin review? It will be replaced with the default for everyone until reviewed.')) return;
    await fetch(`/api/hangout/rooms/${roomId}/report-background`, { method: 'POST' });
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    setChatError(null);
    const res = await fetch(`/api/hangout/rooms/${roomId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setChatError(data.message || 'Something went wrong');
    }
  }

  function setTouchDir(x: number, y: number) {
    touchDir.current = { x, y };
  }

  if (room.my_status === 'invited') {
    return (
      <div className="card p-10 text-center space-y-4">
        <p className="text-4xl">🏡</p>
        <p className="text-gray-700 font-semibold">{room.host_first_name} invited you to their Hangout Room!</p>
        <button
          onClick={joinRoom}
          disabled={joining}
          className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join room'}
        </button>
      </div>
    );
  }

  type Renderable = { key: string; y: number; el: React.ReactNode };
  const renderables: Renderable[] = [
    ...objects.map(o => ({
      key: `obj-${o.id}`,
      y: o.y,
      el: (
        <div
          key={`obj-${o.id}`}
          className="absolute select-none group"
          style={{ left: `${(o.x / ROOM_W) * 100}%`, top: `${(o.y / ROOM_H) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: Math.round(o.y) }}
        >
          <span className="text-3xl drop-shadow">{emojiForType(o.object_type)}</span>
          <button
            onClick={() => removeObject(o.id)}
            className="opacity-0 group-hover:opacity-100 transition absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      ),
    })),
    {
      key: 'me',
      y: me.y,
      el: (
        <div
          key="me"
          className="absolute flex flex-col items-center"
          style={{ left: `${(me.x / ROOM_W) * 100}%`, top: `${(me.y / ROOM_H) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: Math.round(me.y) }}
        >
          <Avatar {...avatarPropsFor(currentUserId)} size={AVATAR_SIZE} />
          <span className="text-[10px] text-slate-800 bg-white/80 px-1.5 rounded-full mt-0.5">You</span>
        </div>
      ),
    },
    ...[...others.entries()].map(([uid, p]) => {
      const pos = currentRenderPos(p);
      const opacity = opacityFor(p);
      return {
        key: `u-${uid}`,
        y: pos.y,
        el: (
          <div
            key={`u-${uid}`}
            className="absolute flex flex-col items-center transition-opacity"
            style={{ left: `${(pos.x / ROOM_W) * 100}%`, top: `${(pos.y / ROOM_H) * 100}%`, transform: 'translate(-50%, -50%)', zIndex: Math.round(pos.y), opacity }}
          >
            <Avatar {...avatarPropsFor(uid)} size={AVATAR_SIZE} />
            <span className="text-[10px] text-slate-800 bg-white/80 px-1.5 rounded-full mt-0.5">{p.first_name}</span>
          </div>
        ),
      };
    }),
  ];
  renderables.sort((a, b) => a.y - b.y);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold brand-text">Hangout Room 🏡</h1>
        <div className="flex gap-2">
          {isHost && (
            <button onClick={() => setShowBgPrompt(v => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition">
              🖼️ Background
            </button>
          )}
          {isHost && (
            <button
              onClick={() => { setBarrierMode(v => !v); setSelectedObject(null); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                barrierMode ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              🚧 {barrierMode ? 'Done marking' : 'Block area'}
            </button>
          )}
          <button onClick={reportBackground} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
            🚩 Report
          </button>
        </div>
      </div>

      {showBgPrompt && (
        <form onSubmit={generateBackground} className="card p-4 space-y-2">
          <p className="text-xs text-gray-500">Describe a background for your room</p>
          <div className="flex gap-2">
            <input
              value={bgPrompt}
              onChange={e => setBgPrompt(e.target.value)}
              placeholder="a treehouse in a magical forest…"
              maxLength={300}
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button type="submit" disabled={!bgPrompt.trim() || bgGenerating} className="brand-gradient text-white font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-50">
              {bgGenerating ? `${Math.round(bgProgress * 100)}%` : 'Generate'}
            </button>
          </div>
          {bgError && <p className="text-xs text-red-500">{bgError}</p>}
        </form>
      )}

      <div className="card overflow-hidden">
        <div
          ref={stageRef}
          onClick={onStageClick}
          className={`relative w-full overflow-hidden ${selectedObject || barrierMode ? 'cursor-crosshair' : ''}`}
          style={{ aspectRatio: `${ROOM_W}/${ROOM_H}` }}
        >
          {background ? (
            <img src={background} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 brand-gradient opacity-20" />
          )}
          {/* Barriers are always subtly visible — an invisible wall is a
              frustrating surprise, so everyone can see why they can't walk here. */}
          {barriers.map(b => (
            <div
              key={`barrier-${b.id}`}
              className={`absolute rounded-full pointer-events-none transition-colors ${
                barrierMode ? 'bg-amber-400/30 border-2 border-amber-500/50' : 'bg-sky-400/10'
              }`}
              style={{
                left: `${(b.x / ROOM_W) * 100}%`,
                top: `${(b.y / ROOM_H) * 100}%`,
                width: BARRIER_RADIUS * 2,
                height: BARRIER_RADIUS * 2,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          {renderables.map(r => r.el)}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 overflow-x-auto">
          {HANGOUT_OBJECTS.map(o => (
            <button
              key={o.type}
              onClick={() => setSelectedObject(v => v === o.type ? null : o.type)}
              title={o.label}
              disabled={barrierMode}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition disabled:opacity-40 ${
                selectedObject === o.type ? 'bg-purple-100 ring-2 ring-purple-300' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {o.emoji}
            </button>
          ))}
          {selectedObject && !barrierMode && <span className="text-xs text-gray-400 flex-shrink-0">Tap the room to place it</span>}
          {barrierMode && <span className="text-xs text-amber-600 font-medium flex-shrink-0">Tap to mark, tap a marked spot to erase</span>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-40 overflow-y-auto p-3 space-y-1.5">
          {messages.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Say hi! 👋</p>
          )}
          {messages.map((m, i) => (
            <p key={i} className="text-sm">
              <span className="font-semibold text-gray-700">{m.first_name}:</span>{' '}
              <span className="text-gray-600">{m.text}</span>
            </p>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendChat} className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
          <input
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            placeholder="Say something…"
            maxLength={200}
            className="flex-1 border border-gray-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button type="submit" disabled={!chatText.trim()} className="brand-gradient text-white font-semibold px-4 py-1.5 rounded-full text-sm disabled:opacity-50">
            Send
          </button>
        </form>
        {chatError && <p className="text-xs text-red-500 px-3 pb-2">{chatError}</p>}
      </div>

      {/* Touch controls, mobile only */}
      <div className="md:hidden grid grid-cols-3 gap-2 w-40 mx-auto select-none">
        <div />
        <DpadButton label="↑" onDown={() => setTouchDir(0, -1)} onUp={() => setTouchDir(0, 0)} />
        <div />
        <DpadButton label="←" onDown={() => setTouchDir(-1, 0)} onUp={() => setTouchDir(0, 0)} />
        <div />
        <DpadButton label="→" onDown={() => setTouchDir(1, 0)} onUp={() => setTouchDir(0, 0)} />
        <div />
        <DpadButton label="↓" onDown={() => setTouchDir(0, 1)} onUp={() => setTouchDir(0, 0)} />
        <div />
      </div>
      <p className="hidden md:block text-center text-xs text-gray-400">Use WASD or the arrow keys to walk around</p>
    </div>
  );
}

function Avatar({ emoji, color, accessory, size }: { emoji: string; color: string; accessory: string | null; size: number }) {
  return (
    <div
      className="relative rounded-full border-2 border-white shadow flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.55 }}
    >
      {emoji}
      {accessory && (
        <span className="absolute -top-1 -right-1" style={{ fontSize: size * 0.4 }}>{accessory}</span>
      )}
    </div>
  );
}

function DpadButton({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      className="w-12 h-12 rounded-xl bg-gray-100 active:bg-purple-100 text-lg font-bold text-gray-500 flex items-center justify-center"
    >
      {label}
    </button>
  );
}
