import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import RPSLobbyClient from './RPSLobbyClient';

export const dynamic = 'force-dynamic';

export default async function RPSLobbyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [rooms] = await db.execute(
    `SELECT r.id, r.status, r.created_at,
       h.username as host_username, h.first_name as host_first_name,
       gp.status as my_status,
       o.first_name as opponent_first_name,
       (SELECT COUNT(*) FROM rps_room_players WHERE room_id = r.id AND status = 'joined') as player_count
     FROM rps_room_players gp
     JOIN rps_rooms r ON r.id = gp.room_id
     JOIN users h ON h.id = r.created_by
     LEFT JOIN rps_room_players op ON op.room_id = r.id AND op.user_id != ?
     LEFT JOIN users o ON o.id = op.user_id
     WHERE gp.user_id = ?
     ORDER BY r.created_at DESC`,
    [session.id, session.id]
  ) as any[];

  const [friends] = await db.execute(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture
     FROM users u
     JOIN follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
     ORDER BY u.first_name ASC`,
    [session.id, session.id]
  ) as any[];

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Rock-Paper-Scissors ✊</h1>
        <p className="text-sm text-gray-400 mt-1">Challenge a friend — first to 3 wins!</p>
      </div>
      <RPSLobbyClient initialRooms={rooms} friends={friends} />
    </main>
  );
}
