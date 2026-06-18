import db from './db';

export interface LunaMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

const HISTORY_LIMIT = 200;
const CONTEXT_LIMIT = 20;

export async function getLunaHistory(userId: number, limit = HISTORY_LIMIT): Promise<LunaMessage[]> {
  const [rows] = await db.execute(
    `SELECT role, content, image_url FROM luna_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
    [userId]
  ) as [{ role: 'user' | 'assistant'; content: string; image_url: string | null }[], unknown];
  return rows.reverse().map(r => ({
    role: r.role,
    content: r.content,
    ...(r.image_url ? { image: r.image_url } : {}),
  }));
}

export async function getLunaContext(userId: number): Promise<LunaMessage[]> {
  return getLunaHistory(userId, CONTEXT_LIMIT);
}

export async function saveLunaMessage(userId: number, role: 'user' | 'assistant', content: string, imageUrl?: string) {
  await db.execute(
    'INSERT INTO luna_messages (user_id, role, content, image_url) VALUES (?, ?, ?, ?)',
    [userId, role, content, imageUrl ?? null]
  );
  // Keep only the most recent HISTORY_LIMIT messages per user.
  await db.execute(
    `DELETE FROM luna_messages WHERE user_id = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM luna_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${HISTORY_LIMIT}) t
     )`,
    [userId, userId]
  );
}
