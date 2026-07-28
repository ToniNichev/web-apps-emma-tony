import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import { getRoundSnapshot } from '@/app/lib/trivia-game';
import TriviaRoomClient from './TriviaRoomClient';

export const dynamic = 'force-dynamic';

export default async function TriviaRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { roomId } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.status, r.category, r.current_round, r.total_rounds, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM trivia_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) notFound();

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, gp.score, u.username, u.first_name, u.profile_picture
     FROM trivia_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.id ASC`,
    [roomId]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) notFound();

  const currentRoundSnapshot = room.status === 'active' ? getRoundSnapshot(Number(roomId), session.id) : null;

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <TriviaRoomClient
        roomId={Number(roomId)}
        currentUserId={session.id}
        initialRoom={{
          id: room.id,
          status: room.status,
          category: room.category,
          current_round: room.current_round,
          total_rounds: room.total_rounds,
          host_id: room.created_by,
          host_first_name: room.host_first_name,
          host_username: room.host_username,
          players: playerRows,
          my_status: me.status,
          current_round_snapshot: currentRoundSnapshot,
        }}
      />
    </main>
  );
}
