import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import HangoutRoomClient from './HangoutRoomClient';

export const dynamic = 'force-dynamic';

export default async function HangoutRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { roomId } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.background_url, r.background_status, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM hangout_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) notFound();

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, u.username, u.first_name, u.profile_picture,
       u.avatar_emoji, u.avatar_color, u.avatar_accessory
     FROM hangout_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.id ASC`,
    [roomId]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) notFound();

  const [objectRows] = await db.execute(
    'SELECT id, object_type, x, y, placed_by FROM hangout_room_objects WHERE room_id = ?',
    [roomId]
  ) as any[];

  const effectiveBackgroundUrl = room.background_status === 'reported' ? null : room.background_url;

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <HangoutRoomClient
        roomId={Number(roomId)}
        currentUserId={session.id}
        initialRoom={{
          id: room.id,
          host_id: room.created_by,
          host_first_name: room.host_first_name,
          host_username: room.host_username,
          background_url: effectiveBackgroundUrl,
          background_status: room.background_status,
          players: playerRows,
          objects: objectRows,
          my_status: me.status,
        }}
      />
    </main>
  );
}
