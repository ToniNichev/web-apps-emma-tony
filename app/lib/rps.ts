import db from './db';

type Move = 'rock' | 'paper' | 'scissors';
export const MOVES: Move[] = ['rock', 'paper', 'scissors'];
export const WINS_NEEDED = 3; // best of 5

interface RoomState {
  picks: Map<number, Move>; // userId -> move for the round in progress
}

function stateMap(): Map<number, RoomState> {
  const g = globalThis as unknown as { __rpsRoomState?: Map<number, RoomState> };
  if (!g.__rpsRoomState) g.__rpsRoomState = new Map();
  return g.__rpsRoomState;
}

function gameIO() {
  return (globalThis as unknown as { __gameIO?: any }).__gameIO;
}

function beats(a: Move, b: Move): boolean {
  return (a === 'rock' && b === 'scissors') ||
         (a === 'paper' && b === 'rock') ||
         (a === 'scissors' && b === 'paper');
}

export function clearRoomState(roomId: number) {
  stateMap().delete(roomId);
}

export async function submitPick(roomId: number, userId: number, move: Move) {
  const [roomRows] = await db.execute('SELECT status, round FROM rps_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'active') return { error: 'Match is not active' };

  const [playerRows] = await db.execute(
    'SELECT user_id, status, score FROM rps_room_players WHERE room_id = ?',
    [roomId]
  ) as any[];
  const players = playerRows as any[];
  const me = players.find(p => p.user_id === userId);
  if (!me || me.status !== 'joined') return { error: 'You are not in this match' };
  const opponent = players.find(p => p.user_id !== userId);
  if (!opponent || opponent.status !== 'joined') return { error: 'Waiting for opponent to join' };

  if (!stateMap().has(roomId)) stateMap().set(roomId, { picks: new Map() });
  const roomState = stateMap().get(roomId)!;

  if (roomState.picks.has(userId)) return { error: 'You already picked this round' };

  // Everything from here through the opponent-picked check is synchronous
  // (no awaits) so it can't interleave with a concurrent request from the
  // opponent — both requests can never both observe "opponent hasn't
  // picked yet" for the same round.
  roomState.picks.set(userId, move);
  const opponentId = opponent.user_id;
  const opponentMove = roomState.picks.get(opponentId);

  if (!opponentMove) {
    const io = gameIO();
    io?.to(`user:${opponentId}`).emit('rps:opponent_picked', { room_id: roomId });
    return { waiting: true };
  }

  roomState.picks.clear();

  let winnerId: number | null = null;
  if (move !== opponentMove) {
    winnerId = beats(move, opponentMove) ? userId : opponentId;
  }

  if (winnerId) {
    await db.execute('UPDATE rps_room_players SET score = score + 1 WHERE room_id = ? AND user_id = ?', [roomId, winnerId]);
  }
  const nextRound = room.round + 1;

  const myScore = (me.score as number) + (winnerId === userId ? 1 : 0);
  const oppScore = (opponent.score as number) + (winnerId === opponentId ? 1 : 0);
  const matchWinnerId = myScore >= WINS_NEEDED ? userId : oppScore >= WINS_NEEDED ? opponentId : null;

  await db.execute(
    'UPDATE rps_rooms SET round = ?, status = ? WHERE id = ?',
    [nextRound, matchWinnerId ? 'finished' : 'active', roomId]
  );
  if (matchWinnerId) clearRoomState(roomId);

  const io = gameIO();
  io?.to(`rps:${roomId}`).emit('rps:round_result', {
    round: nextRound,
    moves: { [userId]: move, [opponentId]: opponentMove },
    winner_id: winnerId,
    scores: { [userId]: myScore, [opponentId]: oppScore },
    match_winner_id: matchWinnerId,
  });

  return { ok: true };
}

export async function rematch(roomId: number) {
  clearRoomState(roomId);
  await db.execute('UPDATE rps_rooms SET status = "active", round = 0 WHERE id = ?', [roomId]);
  await db.execute('UPDATE rps_room_players SET score = 0 WHERE room_id = ?', [roomId]);

  const io = gameIO();
  io?.to(`rps:${roomId}`).emit('rps:rematch');
}
