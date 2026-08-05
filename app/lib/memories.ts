import db from './db';

// Family-wide "on this day" — matches the home feed's existing philosophy of
// showing everyone's posts (not just people you follow), which also gives a
// far better hit rate while the app itself is only months old and "1 year
// ago" alone would turn up nothing. Offsets are common social-app anchors
// rather than a strict day-for-day calendar match.
const OFFSETS = [
  { days: 7, label: '1 week ago' },
  { days: 30, label: '1 month ago' },
  { days: 90, label: '3 months ago' },
  { days: 180, label: '6 months ago' },
  { days: 365, label: '1 year ago' },
  { days: 730, label: '2 years ago' },
];

export async function getOnThisDayPosts(viewerId: number, isSuperAdmin: boolean) {
  const hiddenFilter = isSuperAdmin ? '' : 'AND (p.hidden IS NULL OR p.hidden = 0)';
  const today = new Date();
  const memories: any[] = [];

  for (const offset of OFFSETS) {
    const target = new Date(today);
    target.setDate(target.getDate() - offset.days);
    const dateStr = target.toISOString().slice(0, 10);

    const [rows] = await db.execute(`
      SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
        (SELECT emoji FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) as my_reaction,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
        GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
        GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types,
        GROUP_CONCAT(DISTINCT COALESCE(m.thumbnail_url, '') ORDER BY m.order_index SEPARATOR '||') as media_thumbnails
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN media m ON m.post_id = p.id
      WHERE DATE(p.created_at) = ? ${hiddenFilter}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [viewerId, dateStr]) as any[];

    for (const row of rows as any[]) {
      memories.push({ ...row, memory_label: offset.label });
    }
  }
  return memories;
}
