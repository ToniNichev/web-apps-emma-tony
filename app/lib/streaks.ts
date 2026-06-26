import db from './db';

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function getPostingStreak(userId: number): Promise<number> {
  const [rows] = await db.execute(
    'SELECT DISTINCT DATE(created_at) as d FROM posts WHERE user_id = ? ORDER BY d DESC',
    [userId]
  ) as any[];

  const dates = (rows as any[]).map(r => startOfDay(new Date(r.d)));
  if (dates.length === 0) return 0;

  const oneDay = 24 * 60 * 60 * 1000;
  const today = startOfDay(new Date());
  const daysSinceLastPost = Math.round((today.getTime() - dates[0].getTime()) / oneDay);

  // Streak is only "alive" if the most recent post was today or yesterday
  if (daysSinceLastPost > 1) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const gap = Math.round((dates[i - 1].getTime() - dates[i].getTime()) / oneDay);
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}
