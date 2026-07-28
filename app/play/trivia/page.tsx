import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import TriviaLobbyClient from './TriviaLobbyClient';

export const dynamic = 'force-dynamic';

export default async function TriviaLobbyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [rooms] = await db.execute(
    `SELECT r.id, r.status, r.category, r.created_at,
       h.username as host_username, h.first_name as host_first_name,
       gp.status as my_status,
       (SELECT COUNT(*) FROM trivia_room_players WHERE room_id = r.id AND status = 'joined') as player_count
     FROM trivia_room_players gp
     JOIN trivia_rooms r ON r.id = gp.room_id
     JOIN users h ON h.id = r.created_by
     WHERE gp.user_id = ?
     ORDER BY r.created_at DESC`,
    [session.id]
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
        <h1 className="text-2xl font-bold brand-text">Trivia Duel 🧠</h1>
        <p className="text-sm text-gray-400 mt-1">Invite friends and test your knowledge — 8 questions, most correct wins!</p>
      </div>
      <TriviaLobbyClient initialRooms={rooms} friends={friends} />
    </main>
  );
}
