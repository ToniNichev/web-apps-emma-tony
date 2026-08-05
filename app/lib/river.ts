import db from './db';

// The "highlights" river: durable, celebratory events that would otherwise
// vanish once their moment passes (game wins live in in-memory match state
// and get cleaned up with the room; badges/kindness are visible only at the
// instant they happen). Deliberately excludes posts (already permanent on
// the profile), logins, and anything from activity_log (that's the
// superadmin oversight log — IPs and DM previews, not for user display).
export type RiverEventType = 'badge' | 'trivia_win' | 'rps_win' | 'kindness_received';

// Fire-and-forget — never throws, never blocks the caller.
export function logRiverEvent(userId: number, eventType: RiverEventType, summary: string, emoji: string) {
  db.execute(
    'INSERT INTO river_events (user_id, event_type, summary, emoji) VALUES (?, ?, ?, ?)',
    [userId, eventType, summary, emoji]
  ).catch(() => {});
}

export async function getRiverEvents(userId: number, limit = 15) {
  const [rows] = await db.execute(
    `SELECT event_type, summary, emoji, created_at FROM river_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limit}`,
    [userId]
  ) as [{ event_type: RiverEventType; summary: string; emoji: string | null; created_at: string }[], unknown];
  return rows;
}
