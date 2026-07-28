import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import RPSRoomClient from './RPSRoomClient';

export const dynamic = 'force-dynamic';

export default async function RPSRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { roomId } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.status, r.round, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM rps_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) notFound();

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, gp.score, u.username, u.first_name, u.profile_picture
     FROM rps_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.id ASC`,
    [roomId]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) notFound();

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <RPSRoomClient
        roomId={Number(roomId)}
        currentUserId={session.id}
        initialRoom={{
          id: room.id,
          status: room.status,
          round: room.round,
          host_id: room.created_by,
          host_first_name: room.host_first_name,
          host_username: room.host_username,
          players: playerRows,
          my_status: me.status,
        }}
      />
    </main>
  );
}
