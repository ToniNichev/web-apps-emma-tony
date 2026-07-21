import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import DrawGuessRoomClient from './DrawGuessRoomClient';

export const dynamic = 'force-dynamic';

export default async function DrawGuessRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { roomId } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.status, r.current_round, r.current_drawer_id, r.round_started_at, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM game_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) notFound();

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, gp.score, u.username, u.first_name, u.profile_picture
     FROM game_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.score DESC, gp.id ASC`,
    [roomId]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) notFound();

  const isDrawer = room.current_drawer_id === session.id;
  let word: string | null = null;
  if (isDrawer) {
    const [wordRows] = await db.execute('SELECT current_word FROM game_rooms WHERE id = ?', [roomId]) as any[];
    word = (wordRows as any[])[0]?.current_word ?? null;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <DrawGuessRoomClient
        roomId={Number(roomId)}
        currentUserId={session.id}
        initialRoom={{
          id: room.id,
          status: room.status,
          current_round: room.current_round,
          current_drawer_id: room.current_drawer_id,
          round_started_at: room.round_started_at,
          host_id: room.created_by,
          host_first_name: room.host_first_name,
          host_username: room.host_username,
          players: playerRows,
          my_status: me.status,
          is_drawer: isDrawer,
          word,
        }}
      />
    </main>
  );
}
