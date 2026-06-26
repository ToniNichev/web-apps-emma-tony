import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import { getPostingStreak } from '@/app/lib/streaks';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [allUsers] = await db.execute(
    'SELECT id, username, first_name, profile_picture FROM users WHERE verified = 1'
  ) as any[];

  const [postRows] = await db.execute(`
    SELECT u.id, u.username, u.first_name, u.profile_picture, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    WHERE u.verified = 1
    GROUP BY u.id
    ORDER BY post_count DESC
    LIMIT 10
  `) as any[];

  const [reactionRows] = await db.execute(`
    SELECT u.id, u.username, u.first_name, u.profile_picture, COUNT(l.id) as reaction_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    LEFT JOIN likes l ON l.post_id = p.id AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    WHERE u.verified = 1
    GROUP BY u.id
    ORDER BY reaction_count DESC
    LIMIT 10
  `) as any[];

  // Compute streaks for all users
  const streakData = await Promise.all(
    (allUsers as any[]).map(async (u: any) => ({
      ...u,
      streak: await getPostingStreak(u.id),
    }))
  );
  const streakRows = streakData.filter(u => u.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 10);

  function Avatar({ u }: { u: any }) {
    return u.profile_picture
      ? <img src={u.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
      : <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0">{u.first_name?.[0] || u.username[0]}</div>;
  }

  function Board({ title, emoji, rows, valueKey, valueLabel }: {
    title: string; emoji: string; rows: any[]; valueKey: string; valueLabel: string;
  }) {
    const nonZero = rows.filter(r => r[valueKey] > 0);
    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <h2 className="font-bold text-gray-800">{title}</h2>
        </div>
        {nonZero.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No activity yet this week</p>
        ) : (
          nonZero.map((row, i) => (
            <Link key={row.id} href={`/profile/${encodeURIComponent(row.username)}`}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-pink-50 transition ${i < nonZero.length - 1 ? 'border-b border-gray-50' : ''} ${row.id === session!.id ? 'bg-pink-50/40' : ''}`}>
              <span className="text-xl w-7 text-center flex-shrink-0">{MEDALS[i] || `${i + 1}`}</span>
              <Avatar u={row} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{row.first_name}
                  {row.id === session!.id && <span className="ml-1 text-xs text-pink-400 font-normal">(you)</span>}
                </p>
                <p className="text-xs text-gray-400">@{row.username}</p>
              </div>
              <span className="font-bold brand-text text-sm flex-shrink-0">
                {row[valueKey]} <span className="font-normal text-gray-400 text-xs">{valueLabel}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Leaderboard 🏆</h1>
        <p className="text-sm text-gray-400 mt-1">Who's been the most active this week?</p>
      </div>

      <div className="space-y-4">
        <Board title="Most Posts" emoji="📝" rows={postRows as any[]} valueKey="post_count" valueLabel="posts" />
        <Board title="Most Reactions Received" emoji="❤️" rows={reactionRows as any[]} valueKey="reaction_count" valueLabel="reactions" />
        <Board title="Longest Streak" emoji="🔥" rows={streakRows} valueKey="streak" valueLabel={streakRows[0]?.streak === 1 ? 'day' : 'days'} />
      </div>
    </main>
  );
}
