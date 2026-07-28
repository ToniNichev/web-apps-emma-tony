import db from './db';
import { CATEGORIES, type Category } from './trivia-categories';
export { CATEGORIES, type Category };

// A category is considered "stale" once every active, approved question in
// it has been asked at least this many times — signals it's due for a
// top-up so players stop seeing the same questions on repeat.
const STALE_THRESHOLD = 4;
// Also top up if a category's approved pool shrinks below this floor
// (e.g. after rejecting bad AI-generated questions during review).
const MIN_POOL_SIZE = 15;
const GENERATE_BATCH_SIZE = 15;

interface RawQuestion {
  category: Category;
  question: string;
  a: string; b: string; c: string; d: string;
  correct: 'a' | 'b' | 'c' | 'd';
}

export async function getRandomQuestions(category: string, count: number, excludeIds: number[] = []) {
  const excludeClause = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
  const [rows] = await db.execute(
    `SELECT id, question, option_a, option_b, option_c, option_d, correct_option
     FROM trivia_questions
     WHERE category = ? AND active = 1 AND needs_review = 0 ${excludeClause}
     ORDER BY times_asked ASC, RAND()
     LIMIT ?`,
    [category, ...excludeIds, count]
  ) as any[];
  return rows as any[];
}

export async function recordQuestionAsked(id: number) {
  await db.execute('UPDATE trivia_questions SET times_asked = times_asked + 1, last_asked_at = NOW() WHERE id = ?', [id]);
}

export async function getBankHealth() {
  const [rows] = await db.execute(
    `SELECT category,
       COUNT(*) as approved_count,
       COALESCE(AVG(times_asked), 0) as avg_times_asked,
       COALESCE(MIN(times_asked), 0) as min_times_asked,
       (SELECT COUNT(*) FROM trivia_questions t2 WHERE t2.category = t1.category AND t2.needs_review = 1) as pending_review
     FROM trivia_questions t1
     WHERE active = 1 AND needs_review = 0
     GROUP BY category`,
    []
  ) as any[];
  const byCategory = new Map((rows as any[]).map(r => [r.category, r]));
  return CATEGORIES.map(cat => {
    const r = byCategory.get(cat);
    return {
      category: cat,
      approved_count: r?.approved_count ?? 0,
      avg_times_asked: r ? Number(r.avg_times_asked) : 0,
      min_times_asked: r?.min_times_asked ?? 0,
      pending_review: r?.pending_review ?? 0,
      stale: (r?.approved_count ?? 0) > 0 && r.min_times_asked >= STALE_THRESHOLD,
      thin: (r?.approved_count ?? 0) < MIN_POOL_SIZE,
    };
  });
}

function parseGeneratedBatch(raw: string, category: Category): RawQuestion[] {
  // Small local models don't reliably follow "output ONLY JSON" — strip any
  // stray prose/code fences before parsing.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const valid: RawQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { question, a, b, c, d, correct } = item;
    const opts = [a, b, c, d];
    if (typeof question !== 'string' || !question.trim() || question.length > 300) continue;
    if (opts.some(o => typeof o !== 'string' || !o.trim() || o.length > 150)) continue;
    if (new Set(opts.map((o: string) => o.trim().toLowerCase())).size !== 4) continue;
    if (!['a', 'b', 'c', 'd'].includes(correct)) continue;
    const norm = question.trim().toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    valid.push({ category, question: question.trim(), a, b, c, d, correct });
  }
  return valid;
}

export async function generateQuestions(category: Category, count = GENERATE_BATCH_SIZE): Promise<{ inserted: number } | { error: string }> {
  const [existingRows] = await db.execute(
    'SELECT question FROM trivia_questions WHERE category = ? ORDER BY id DESC LIMIT 40',
    [category]
  ) as any[];
  const existingList = (existingRows as any[]).map(r => `- ${r.question}`).join('\n');

  const prompt = `You are writing multiple-choice trivia questions for a quiz game played by children aged 6-12.

Category: ${category}

Write ${count} trivia questions. Requirements:
- Age-appropriate for 6-12 year olds, and only about well-established, uncontroversial facts you are confident are correct.
- Exactly 4 answer options per question, only one of which is correct.
- Do not repeat or closely resemble any of these existing questions:
${existingList || '(none yet)'}

Respond with ONLY a JSON array, no other text, in exactly this shape:
[{"question": "...", "a": "...", "b": "...", "c": "...", "d": "...", "correct": "a"}]`;

  // The local model doesn't reliably produce clean, fully-valid JSON on
  // every call — observed roughly a third of single attempts yielding zero
  // usable questions even though the prompt/parsing were fine, just
  // sampling variance. Retry a few times and accumulate across attempts
  // rather than failing on the first bad one.
  const MAX_ATTEMPTS = 3;
  const seenQuestions = new Set<string>();
  const accumulated: RawQuestion[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS && accumulated.length < count; attempt++) {
    let content: string;
    try {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemma3:4b', messages: [{ role: 'user', content: prompt }], stream: false }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      content = data.message?.content ?? '';
    } catch {
      continue;
    }

    for (const q of parseGeneratedBatch(content, category)) {
      if (seenQuestions.has(q.question.toLowerCase())) continue;
      seenQuestions.add(q.question.toLowerCase());
      accumulated.push(q);
    }
  }

  const valid = accumulated;
  if (valid.length === 0) return { error: 'AI generation failed after retries — try again' };

  // needs_review = 1: a small local model generating "facts" isn't trustworthy
  // enough to go live unreviewed, so these sit in a queue for an admin to
  // approve or reject before they can be served in a match.
  for (const q of valid) {
    await db.execute(
      `INSERT INTO trivia_questions (category, question, option_a, option_b, option_c, option_d, correct_option, source, needs_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_generated', 1)`,
      [q.category, q.question, q.a, q.b, q.c, q.d, q.correct]
    );
  }
  return { inserted: valid.length };
}

// Fire-and-forget: called after a question is served, so a category that's
// getting worn out starts topping itself up in the background without
// blocking the round that triggered the check.
export async function checkAndRegenerateIfStale(category: Category) {
  try {
    const health = await getBankHealth();
    const stats = health.find(h => h.category === category);
    if (!stats) return;
    if (stats.stale || stats.thin) {
      await generateQuestions(category, GENERATE_BATCH_SIZE);
    }
  } catch {
    // Best-effort — a failed top-up shouldn't affect the round in progress.
  }
}
