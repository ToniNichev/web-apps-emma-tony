import db from './db';
import { getRandomQuestions, recordQuestionAsked, checkAndRegenerateIfStale, CATEGORIES, type Category } from './trivia';

const ROUND_MS = 15_000;
const REVEAL_PAUSE_MS = 4_000; // time players see the answer before the next round auto-starts
const POINTS_PER_CORRECT = 10;
export const TOTAL_ROUNDS = 8;

type Option = 'a' | 'b' | 'c' | 'd';

interface CurrentRound {
  round: number;
  questionId: number;
  questionCategory: Category;
  question: string;
  options: Record<Option, string>;
  correctOption: Option;
  answers: Map<number, Option>;
  deadline: number;
  timer: ReturnType<typeof setTimeout>;
}

interface MatchState {
  usedQuestionIds: Set<number>;
  current: CurrentRound | null;
}

function stateMap(): Map<number, MatchState> {
  const g = globalThis as unknown as { __triviaRoomState?: Map<number, MatchState> };
  if (!g.__triviaRoomState) g.__triviaRoomState = new Map();
  return g.__triviaRoomState;
}

function gameIO() {
  return (globalThis as unknown as { __gameIO?: any }).__gameIO;
}

export function clearRoomState(roomId: number) {
  const state = stateMap().get(roomId);
  if (state?.current?.timer) clearTimeout(state.current.timer);
  stateMap().delete(roomId);
}

async function pickQuestion(category: string, usedIds: Set<number>): Promise<{ row: any; category: Category } | null> {
  if (category === 'Mixed') {
    // Spread the pull roughly evenly across categories rather than letting
    // whichever category happens first in the query dominate.
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
    for (const cat of shuffled) {
      const rows = await getRandomQuestions(cat, 1, [...usedIds]);
      if (rows.length > 0) return { row: rows[0], category: cat };
    }
    return null;
  }
  const rows = await getRandomQuestions(category, 1, [...usedIds]);
  return rows.length > 0 ? { row: rows[0], category: category as Category } : null;
}

export async function startMatch(roomId: number, category: string) {
  const [playerRows] = await db.execute(
    'SELECT user_id FROM trivia_room_players WHERE room_id = ? AND status = "joined"',
    [roomId]
  ) as any[];
  if ((playerRows as any[]).length < 2) return { error: 'Need at least 2 players to start' };

  const categories: string[] = [...CATEGORIES, 'Mixed'];
  if (!categories.includes(category)) return { error: 'Invalid category' };

  clearRoomState(roomId);
  stateMap().set(roomId, { usedQuestionIds: new Set(), current: null });

  await db.execute(
    'UPDATE trivia_rooms SET status = "active", category = ?, current_round = 0, total_rounds = ?, expires_at = NULL WHERE id = ?',
    [category, TOTAL_ROUNDS, roomId]
  );

  const result = await startNextRound(roomId);
  if (result && 'error' in result) return result;
  return { ok: true };
}

export async function startNextRound(roomId: number) {
  const [roomRows] = await db.execute('SELECT category, current_round, total_rounds FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return { error: 'Room not found' };

  const state = stateMap().get(roomId);
  if (!state) return { error: 'Match state missing' };

  const picked = await pickQuestion(room.category, state.usedQuestionIds);
  if (!picked) return { error: 'No more questions available in this category' };
  const { row: q, category: questionCategory } = picked;

  const nextRound = room.current_round + 1;
  const deadline = Date.now() + ROUND_MS;

  const timer = setTimeout(() => {
    revealRound(roomId).catch(() => {});
  }, ROUND_MS);

  state.current = {
    round: nextRound,
    questionId: q.id,
    questionCategory,
    question: q.question,
    options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
    correctOption: q.correct_option,
    answers: new Map(),
    deadline,
    timer,
  };
  state.usedQuestionIds.add(q.id);

  await db.execute('UPDATE trivia_rooms SET current_round = ? WHERE id = ?', [nextRound, roomId]);

  const io = gameIO();
  io?.to(`trivia:${roomId}`).emit('trivia:round_started', {
    round: nextRound,
    total_rounds: room.total_rounds,
    question: q.question,
    options: state.current.options,
    deadline,
  });

  return { ok: true };
}

export async function submitAnswer(roomId: number, userId: number, option: Option) {
  const state = stateMap().get(roomId);
  if (!state || !state.current) return { error: 'No round is active right now' };

  const [memberRows] = await db.execute(
    'SELECT id FROM trivia_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, userId]
  ) as any[];
  if ((memberRows as any[]).length === 0) return { error: 'You are not in this room' };

  if (state.current.answers.has(userId)) return { error: 'You already answered this round' };
  state.current.answers.set(userId, option);

  const [joinedRows] = await db.execute(
    'SELECT COUNT(*) as n FROM trivia_room_players WHERE room_id = ? AND status = "joined"',
    [roomId]
  ) as any[];
  const joinedCount = (joinedRows as any[])[0].n;

  if (state.current.answers.size >= joinedCount) {
    clearTimeout(state.current.timer);
    await revealRound(roomId);
  }

  return { ok: true };
}

async function revealRound(roomId: number) {
  const state = stateMap().get(roomId);
  if (!state || !state.current) return;
  const round = state.current;
  state.current = null; // stop accepting/double-processing answers for this round immediately

  const [roomRows] = await db.execute('SELECT category, current_round, total_rounds FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return;

  for (const [userId, option] of round.answers) {
    if (option === round.correctOption) {
      await db.execute('UPDATE trivia_room_players SET score = score + ? WHERE room_id = ? AND user_id = ?', [POINTS_PER_CORRECT, roomId, userId]);
    }
  }

  await recordQuestionAsked(round.questionId);
  checkAndRegenerateIfStale(round.questionCategory).catch(() => {});

  const [playerRows] = await db.execute(
    'SELECT user_id, score FROM trivia_room_players WHERE room_id = ?',
    [roomId]
  ) as any[];
  const scores = Object.fromEntries((playerRows as any[]).map(p => [p.user_id, p.score]));
  const answersOut = Object.fromEntries([...round.answers.entries()]);

  const isLastRound = room.current_round >= room.total_rounds;
  let matchWinnerId: number | null = null;
  if (isLastRound) {
    const maxScore = Math.max(...(playerRows as any[]).map(p => p.score));
    const winners = (playerRows as any[]).filter(p => p.score === maxScore);
    matchWinnerId = winners.length === 1 ? winners[0].user_id : null;
    await db.execute('UPDATE trivia_rooms SET status = "finished", expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?', [roomId]);
    clearRoomState(roomId);
  }

  const io = gameIO();
  io?.to(`trivia:${roomId}`).emit('trivia:round_result', {
    round: room.current_round,
    question: round.question,
    correct_option: round.correctOption,
    correct_answer_text: round.options[round.correctOption],
    answers: answersOut,
    scores,
    match_winner_id: isLastRound ? matchWinnerId : undefined,
    match_finished: isLastRound,
  });

  if (!isLastRound) {
    setTimeout(() => {
      startNextRound(roomId).catch(() => {});
    }, REVEAL_PAUSE_MS);
  }
}

export async function rematch(roomId: number, category: string) {
  await db.execute('UPDATE trivia_room_players SET score = 0 WHERE room_id = ?', [roomId]);
  const result = await startMatch(roomId, category);
  if ('error' in result) return result;

  const io = gameIO();
  io?.to(`trivia:${roomId}`).emit('trivia:rematch');
  return { ok: true };
}

// For a client joining or reconnecting mid-round — without this they'd see
// nothing until the next round started, same class of bug fixed earlier for
// Hangout presence and Draw & Guess strokes.
export function getRoundSnapshot(roomId: number, userId: number) {
  const state = stateMap().get(roomId);
  if (!state?.current) return null;
  return {
    round: state.current.round,
    question: state.current.question,
    options: state.current.options,
    deadline: state.current.deadline,
    already_answered: state.current.answers.has(userId),
  };
}
