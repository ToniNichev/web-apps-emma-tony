import db from './db';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export const BADGES: Badge[] = [
  { id: 'first_post',       emoji: '🌟', label: 'First Post',       description: 'Posted for the first time' },
  { id: 'week_streak',      emoji: '🔥', label: 'Week Streak',      description: '7-day posting streak' },
  { id: 'storyteller',      emoji: '📸', label: 'Storyteller',      description: 'Posted 5 stories' },
  { id: 'social_butterfly', emoji: '🦋', label: 'Social Butterfly', description: 'Following 3 or more people' },
  { id: 'fan_favorite',     emoji: '💖', label: 'Fan Favorite',     description: 'Received 10 reactions' },
  { id: 'chatterbox',       emoji: '💬', label: 'Chatterbox',       description: 'Left 10 comments' },
  { id: 'popular',          emoji: '✨', label: 'Popular',          description: '5 people follow you' },
  { id: 'media_star',       emoji: '🎬', label: 'Media Star',       description: 'Posted 5 photos or videos' },
  { id: 'night_owl',        emoji: '🦉', label: 'Night Owl',        description: 'Posted after 10pm' },
  { id: 'early_bird',       emoji: '🐦', label: 'Early Bird',       description: 'Posted before 8am' },
];

async function award(userId: number, badgeId: string) {
  await db.execute(
    'INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)',
    [userId, badgeId]
  );
}

export async function checkBadges(userId: number) {
  const [[posts], [comments], [reactions], [stories], [following], [followers]] = await Promise.all([
    db.execute('SELECT id, created_at FROM posts WHERE user_id = ?', [userId]) as any,
    db.execute('SELECT COUNT(*) as c FROM comments WHERE user_id = ?', [userId]) as any,
    db.execute('SELECT COUNT(*) as c FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [userId]) as any,
    db.execute('SELECT COUNT(*) as c FROM stories WHERE user_id = ?', [userId]) as any,
    db.execute('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?', [userId]) as any,
    db.execute('SELECT COUNT(*) as c FROM follows WHERE following_id = ?', [userId]) as any,
  ]);

  const postList = posts as any[];
  const commentCount = (comments as any[])[0].c;
  const reactionCount = (reactions as any[])[0].c;
  const storyCount = (stories as any[])[0].c;
  const followingCount = (following as any[])[0].c;
  const followerCount = (followers as any[])[0].c;

  if (postList.length >= 1) await award(userId, 'first_post');
  if (storyCount >= 5) await award(userId, 'storyteller');
  if (followingCount >= 3) await award(userId, 'social_butterfly');
  if (reactionCount >= 10) await award(userId, 'fan_favorite');
  if (commentCount >= 10) await award(userId, 'chatterbox');
  if (followerCount >= 5) await award(userId, 'popular');

  const mediaPostCount = postList.filter((p: any) => {
    // media posts are tracked via the media table but we approximate by checking if content is short
    return true; // we'll count all posts for now and check media separately
  }).length;

  // Check media posts via media table
  const [mediaPosts] = await db.execute(
    'SELECT COUNT(DISTINCT post_id) as c FROM media WHERE user_id = ?',
    [userId]
  ) as any[];
  if ((mediaPosts as any[])[0].c >= 5) await award(userId, 'media_star');

  // Night owl / early bird
  for (const post of postList) {
    const hour = new Date(post.created_at).getHours();
    if (hour >= 22 || hour < 1) await award(userId, 'night_owl');
    if (hour >= 5 && hour < 8) await award(userId, 'early_bird');
  }

  // Week streak — reuse streaks logic
  const { getPostingStreak } = await import('./streaks');
  const streak = await getPostingStreak(userId);
  if (streak >= 7) await award(userId, 'week_streak');
}

export async function getUserBadges(userId: number): Promise<Badge[]> {
  const [rows] = await db.execute(
    'SELECT badge_id FROM user_badges WHERE user_id = ? ORDER BY awarded_at ASC',
    [userId]
  ) as any[];
  const ids = new Set((rows as any[]).map((r: any) => r.badge_id));
  return BADGES.filter(b => ids.has(b.id));
}
