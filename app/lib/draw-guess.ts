import db from './db';
import { DRAW_WORDS } from './draw-guess-words';

const ROUND_MS = 75_000;

interface RoomState {
  drawerId: number;
  word: string;
  timer: ReturnType<typeof setTimeout>;
}

function stateMap(): Map<number, RoomState> {
  const g = globalThis as unknown as { __gameRoomState?: Map<number, RoomState> };
  if (!g.__gameRoomState) g.__gameRoomState = new Map();
  return g.__gameRoomState;
}

function gameIO() {
  return (globalThis as unknown as { __gameIO?: any }).__gameIO;
}

export function getRoomState(roomId: number) {
  return stateMap().get(roomId);
}

function clearRoomTimer(roomId: number) {
  const state = stateMap().get(roomId);
  if (state?.timer) clearTimeout(state.timer);
}

export async function startNextRound(roomId: number) {
  clearRoomTimer(roomId);

  const [playerRows] = await db.execute(
    'SELECT user_id FROM game_room_players WHERE room_id = ? AND status = "joined" ORDER BY joined_at ASC, id ASC',
    [roomId]
  ) as any[];
  const joined: number[] = (playerRows as any[]).map(p => p.user_id);
  if (joined.length < 2) return { error: 'Need at least 2 players to start' };

  const [roomRows] = await db.execute(
    'SELECT current_drawer_id, current_round FROM game_rooms WHERE id = ?',
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return { error: 'Room not found' };

  const currentIdx = room.current_drawer_id ? joined.indexOf(room.current_drawer_id) : -1;
  const nextDrawerId = joined[(currentIdx + 1) % joined.length];
  const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
  const nextRound = (room.current_round ?? 0) + 1;

  await db.execute(
    'UPDATE game_rooms SET status = "active", current_round = ?, current_drawer_id = ?, current_word = ?, round_started_at = NOW() WHERE id = ?',
    [nextRound, nextDrawerId, word, roomId]
  );

  const deadline = Date.now() + ROUND_MS;
  const timer = setTimeout(() => {
    endRound(roomId, { reason: 'timeout' }).catch(() => {});
  }, ROUND_MS);
  stateMap().set(roomId, { drawerId: nextDrawerId, word, timer });

  const io = gameIO();
  if (io) {
    io.to(`game:${roomId}`).emit('game:round_started', { round: nextRound, drawer_id: nextDrawerId, deadline });
    io.to(`user:${nextDrawerId}`).emit('game:your_turn', { room_id: roomId, word, deadline, round: nextRound });
  }

  return { drawerId: nextDrawerId, round: nextRound, deadline };
}

export async function endRound(roomId: number, info: { reason: 'guessed' | 'timeout'; winnerId?: number }) {
  clearRoomTimer(roomId);
  const state = stateMap().get(roomId);
  const word = state?.word ?? null;
  stateMap().delete(roomId);

  // Clear the word so a stale guess submitted right after the round ends
  // can't still score against the just-revealed answer.
  await db.execute('UPDATE game_rooms SET current_word = NULL WHERE id = ?', [roomId]);

  const io = gameIO();
  if (io) {
    io.to(`game:${roomId}`).emit('game:round_ended', { reason: info.reason, word, winner_id: info.winnerId ?? null });
  }
}
