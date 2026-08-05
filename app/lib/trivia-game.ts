import db from './db';
import { getRandomQuestions, recordQuestionAsked, checkAndRegenerateIfStale, CATEGORIES, type Category } from './trivia';
import { logRiverEvent } from './river';

const ROUND_MS = 15_000;
const REVEAL_PAUSE_MS = 4_000; // time players see the answer before the next round auto-starts
// A correct answer is always worth at least POINTS_PER_CORRECT, the same
// floor as before speed scoring existed, plus up to SPEED_BONUS_MAX more for
// answering quickly — linear in the time left when the answer landed.
const POINTS_PER_CORRECT = 10;
const SPEED_BONUS_MAX = 10;
export const TOTAL_ROUNDS = 8;

type Option = 'a' | 'b' | 'c' | 'd';
const OPTION_KEYS: Option[] = ['a', 'b', 'c', 'd'];
type Lifeline = 'fifty_fifty' | 'ai_friend';

interface CurrentRound {
  round: number;
  questionId: number;
  questionCategory: Category;
  question: string;
  options: Record<Option, string>;
  correctOption: Option;
  answers: Map<number, { option: Option; answeredAt: number }>;
  deadline: number;
  timer: ReturnType<typeof setTimeout>;
  eliminatedOptions: Map<number, Option[]>; // userId -> the 2 options their 50/50 hid, this round only
}

interface MatchState {
  usedQuestionIds: Set<number>;
  current: CurrentRound | null;
  lifelinesUsed: Map<number, Set<Lifeline>>; // userId -> lifelines already spent this match
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
  stateMap().set(roomId, { usedQuestionIds: new Set(), current: null, lifelinesUsed: new Map() });

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
    eliminatedOptions: new Map(),
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
  state.current.answers.set(userId, { option, answeredAt: Date.now() });

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

async function checkLifelineEligible(roomId: number, userId: number, lifeline: Lifeline) {
  const state = stateMap().get(roomId);
  if (!state || !state.current) return { error: 'No round is active right now' } as const;
  if (state.current.answers.has(userId)) return { error: 'You already answered this round' } as const;

  const [memberRows] = await db.execute(
    'SELECT id FROM trivia_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, userId]
  ) as any[];
  if ((memberRows as any[]).length === 0) return { error: 'You are not in this room' } as const;

  let used = state.lifelinesUsed.get(userId);
  if (!used) { used = new Set(); state.lifelinesUsed.set(userId, used); }
  if (used.has(lifeline)) {
    return { error: lifeline === 'fifty_fifty' ? 'You already used 50/50 this match' : 'You already used your AI friend this match' } as const;
  }

  return { ok: true, state, used } as const;
}

// Eliminates 2 of the 3 wrong options for this player only — the other
// player's options (and the shared round state everyone else sees) are untouched.
export async function useFiftyFifty(roomId: number, userId: number) {
  const check = await checkLifelineEligible(roomId, userId, 'fifty_fifty');
  if ('error' in check) return check;
  const { state, used } = check;
  const round = state.current!;

  const wrongOptions = OPTION_KEYS.filter(o => o !== round.correctOption);
  const eliminated = [...wrongOptions].sort(() => Math.random() - 0.5).slice(0, 2);
  round.eliminatedOptions.set(userId, eliminated);
  used.add('fifty_fifty');

  return { ok: true, eliminated };
}

// Asks the local Ollama model for its best guess — same model used to
// generate the question bank. It isn't told the correct answer, so like a
// real phone-a-friend it can genuinely get it wrong.
export async function useAiFriend(roomId: number, userId: number) {
  const check = await checkLifelineEligible(roomId, userId, 'ai_friend');
  if ('error' in check) return check;
  const { state, used } = check;
  const round = state.current!;

  const prompt = `A friend just called you mid-game asking for help on this trivia question — give your best guess fast.
Question: ${round.question}
a) ${round.options.a}
b) ${round.options.b}
c) ${round.options.c}
d) ${round.options.d}

Respond with ONLY a JSON object, no other text: {"answer": "a", "reason": "one short sentence explaining your guess"}`;

  let guess: { answer: Option; reason: string } | null = null;
  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemma3:4b', messages: [{ role: 'user', content: prompt }], stream: false }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json();
      const content: string = data.message?.content ?? '';
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const parsed = JSON.parse(content.slice(start, end + 1));
        if (OPTION_KEYS.includes(parsed.answer) && typeof parsed.reason === 'string') {
          guess = { answer: parsed.answer, reason: parsed.reason.slice(0, 200) };
        }
      }
    }
  } catch {
    // guess stays null — reported below as a failed call, lifeline not spent
  }

  if (!guess) return { error: "Your AI friend didn't pick up — try again" };
  // The model call can take a few seconds; the round may have moved on by
  // the time it answers. Don't spend the lifeline on an answer that arrives too late.
  if (stateMap().get(roomId)?.current !== round) return { error: 'Too late — the round already ended' };

  used.add('ai_friend');
  return { ok: true, answer: guess.answer, reason: guess.reason };
}

async function revealRound(roomId: number) {
  const state = stateMap().get(roomId);
  if (!state || !state.current) return;
  const round = state.current;
  state.current = null; // stop accepting/double-processing answers for this round immediately

  const [roomRows] = await db.execute('SELECT category, current_round, total_rounds FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return;

  const pointsEarned: Record<number, number> = {};
  for (const [userId, { option, answeredAt }] of round.answers) {
    if (option === round.correctOption) {
      const timeLeftMs = Math.max(0, round.deadline - answeredAt);
      const speedBonus = Math.round(SPEED_BONUS_MAX * (timeLeftMs / ROUND_MS));
      const points = POINTS_PER_CORRECT + speedBonus;
      pointsEarned[userId] = points;
      await db.execute('UPDATE trivia_room_players SET score = score + ? WHERE room_id = ? AND user_id = ?', [points, roomId, userId]);
    }
  }

  await recordQuestionAsked(round.questionId);
  checkAndRegenerateIfStale(round.questionCategory).catch(() => {});

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.score, u.first_name FROM trivia_room_players gp
     JOIN users u ON u.id = gp.user_id WHERE gp.room_id = ?`,
    [roomId]
  ) as any[];
  const scores = Object.fromEntries((playerRows as any[]).map(p => [p.user_id, p.score]));
  const answersOut = Object.fromEntries([...round.answers.entries()].map(([userId, a]) => [userId, a.option]));

  const isLastRound = room.current_round >= room.total_rounds;
  let matchWinnerId: number | null = null;
  if (isLastRound) {
    const maxScore = Math.max(...(playerRows as any[]).map(p => p.score));
    const winners = (playerRows as any[]).filter(p => p.score === maxScore);
    matchWinnerId = winners.length === 1 ? winners[0].user_id : null;
    await db.execute('UPDATE trivia_rooms SET status = "finished", expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?', [roomId]);
    clearRoomState(roomId);
    if (matchWinnerId) {
      // Trivia Duel supports more than 2 players, so only name an opponent
      // when there's exactly one — otherwise "vs X" would misrepresent a
      // multi-player match.
      const others = (playerRows as any[]).filter(p => p.user_id !== matchWinnerId);
      const suffix = others.length === 1 ? ` vs ${others[0].first_name}` : '';
      logRiverEvent(matchWinnerId, 'trivia_win', `Won a Trivia Duel${suffix}`, '🧠');
    }
  }

  const io = gameIO();
  io?.to(`trivia:${roomId}`).emit('trivia:round_result', {
    round: room.current_round,
    question: round.question,
    correct_option: round.correctOption,
    correct_answer_text: round.options[round.correctOption],
    answers: answersOut,
    points_earned: pointsEarned,
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
    lifelines_used: [...(state.lifelinesUsed.get(userId) ?? [])],
    eliminated_options: state.current.eliminatedOptions.get(userId) ?? [],
  };
}
