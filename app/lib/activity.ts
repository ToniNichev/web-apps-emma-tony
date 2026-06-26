import db from './db';

export type EventType =
  | 'login'
  | 'post_created'
  | 'comment_created'
  | 'message_sent'
  | 'story_created'
  | 'media_uploaded';

// Fire-and-forget — never throws, never blocks the calling route.
export function logActivity(userId: number, eventType: EventType, preview?: string, ip?: string) {
  db.execute(
    'INSERT INTO activity_log (user_id, event_type, preview, ip) VALUES (?, ?, ?, ?)',
    [userId, eventType, preview?.substring(0, 200) || null, ip || null]
  ).catch(() => {});
}
