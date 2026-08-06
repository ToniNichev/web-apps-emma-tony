import Link from 'next/link';
import db from '@/app/lib/db';

export default async function RightRail({ family }: { family: number }) {
  const [[topPosters], [birthdays], [chatPreview]] = await Promise.all([
    db.execute(`
      SELECT u.id, u.username, u.first_name, u.profile_picture, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      WHERE u.verified = 1
      GROUP BY u.id
      HAVING post_count > 0
      ORDER BY post_count DESC
      LIMIT 3
    `),
    db.execute(`
      SELECT id, username, first_name, profile_picture,
        MOD(DAYOFYEAR(birthday) - DAYOFYEAR(CURDATE()) + 365, 365) as days_until
      FROM users
      WHERE birthday IS NOT NULL AND verified = 1
      HAVING days_until BETWEEN 0 AND 30
      ORDER BY days_until ASC
      LIMIT 3
    `),
    db.execute(`
      SELECT fc.content, u.first_name
      FROM family_chat_messages fc
      JOIN users u ON u.id = fc.sender_id
      ORDER BY fc.created_at DESC
      LIMIT 3
    `),
  ]) as any[];

  const posters = topPosters as any[];
  const bdays = birthdays as any[];
  const chats = [...(chatPreview as any[])].reverse();

  return (
    <aside className="hidden xl:block w-64 flex-shrink-0 sticky top-[4.5rem] self-start space-y-3">
      {posters.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🏆 Top this week</p>
          <div className="space-y-2.5">
            {posters.map((p, i) => (
              <Link key={p.id} href={`/profile/${encodeURIComponent(p.username)}`} className="flex items-center gap-2.5 hover:opacity-80 transition">
                <span className="text-sm w-4 text-gray-400">{i + 1}</span>
                {p.profile_picture
                  ? <img src={p.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                  : <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">{p.first_name[0]}</div>
                }
                <span className="text-sm text-gray-700 flex-1 truncate">{p.first_name}</span>
                <span className="text-xs text-gray-400">{p.post_count}</span>
              </Link>
            ))}
          </div>
          <Link href="/leaderboard" className="block text-xs brand-text font-semibold mt-3 hover:underline">See full leaderboard →</Link>
        </div>
      )}

      {bdays.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🎂 Upcoming birthdays</p>
          <div className="space-y-2.5">
            {bdays.map(b => (
              <Link key={b.id} href={`/profile/${encodeURIComponent(b.username)}`} className="flex items-center gap-2.5 hover:opacity-80 transition">
                {b.profile_picture
                  ? <img src={b.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                  : <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">{b.first_name[0]}</div>
                }
                <span className="text-sm text-gray-700 flex-1 truncate">{b.first_name}</span>
                <span className="text-xs text-gray-400">{b.days_until === 0 ? 'Today!' : `${b.days_until}d`}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {family !== 0 ? (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🏡 Family Chat</p>
          {chats.length === 0 ? (
            <p className="text-sm text-gray-400">No messages yet.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {chats.map((c: any, i: number) => (
                <p key={i} className="text-xs text-gray-600 truncate"><span className="font-semibold text-gray-700">{c.first_name}:</span> {c.content}</p>
              ))}
            </div>
          )}
          <Link href="/family-chat" className="block text-xs brand-text font-semibold hover:underline">Open chat →</Link>
        </div>
      ) : null}
    </aside>
  );
}
