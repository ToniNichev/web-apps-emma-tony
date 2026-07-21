import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifText(n: any) {
  switch (n.type) {
    case 'like': return 'reacted to your post';
    case 'comment': return `commented: "${n.message_preview}"`;
    case 'follow': return 'started following you';
    case 'message': return `sent you a message: "${n.message_preview}"`;
    case 'poll_vote': return 'voted on your poll';
    case 'challenge_response': return "responded to today's challenge 🎯";
    case 'kindness_note': return 'sent you kindness 💛';
    case 'game_invite': return 'invited you to play Draw & Guess 🎨';
  }
}

function notifLink(n: any) {
  if (n.type === 'message') return '/messages';
  if (n.type === 'challenge_response') return '/challenges';
  if (n.type === 'kindness_note') return '/kindness';
  if (n.type === 'game_invite') return `/play/draw/${n.message_preview}`;
  if (n.type === 'follow') return `/profile/${encodeURIComponent(n.actor_username)}`;
  if (n.post_id) return `/post/${n.post_id}`;
  return '#';
}

export default async function NotificationsPage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";
  if (!session) redirect('/login');

  const [notifs] = await db.execute(`
    SELECT n.*,
      u.username as actor_username, u.first_name as actor_first_name,
      u.last_name as actor_last_name, u.profile_picture as actor_profile_picture
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 100
  `, [session.id]) as any[];

  // Only mark as read the notifications actually shown above — an unbounded
  // UPDATE here would silently mark anything beyond LIMIT 100 as read too,
  // even though the user never saw it.
  const shownIds = (notifs as any[]).map(n => n.id);
  if (shownIds.length > 0) {
    await db.execute(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL AND id IN (${shownIds.map(() => '?').join(',')})`,
      [session.id, ...shownIds]
    );
  }

  return (
          <main className="max-w-2xl mx-auto px-4 pt-2 pb-6">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="card overflow-hidden">
          {(notifs as any[]).length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-gray-400 font-medium">No notifications yet</p>
            </div>
          ) : (
            (notifs as any[]).map((n: any) => (
              <Link
                key={n.id}
                href={notifLink(n)}
                className={`flex items-start gap-3 px-5 py-4 border-b border-gray-50 hover:bg-pink-50 transition last:border-0 ${!n.read_at ? 'bg-pink-50/40' : ''}`}
              >
                {n.type === 'kindness_note' ? (
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">💛</div>
                ) : (
                  <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                    {n.actor_profile_picture
                      ? <img src={n.actor_profile_picture} alt="" className="w-full h-full object-cover" />
                      : n.actor_first_name[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm">
                    {n.type === 'kindness_note' ? (
                      <span className="text-gray-600">Someone sent you kindness 💛</span>
                    ) : (
                      <>
                        <span className="font-semibold">{n.actor_first_name} {n.actor_last_name}</span>{' '}
                        <span className="text-gray-600">{notifText(n)}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                <span className="text-lg">
                  {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '✨' : n.type === 'poll_vote' ? '🗳️' : n.type === 'challenge_response' ? '🎯' : n.type === 'kindness_note' ? '💛' : n.type === 'game_invite' ? '🎨' : '📩'}
                </span>
              </Link>
            ))
          )}
        </div>
      </main>
  );
}
