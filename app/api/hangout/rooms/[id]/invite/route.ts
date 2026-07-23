import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const MAX_PLAYERS = 6; // host + up to 5 others — same cap as room creation

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM hangout_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can invite more people' }, { status: 403 });
  }

  const { invite_user_ids } = await request.json();
  const requestedIds: number[] = Array.isArray(invite_user_ids)
    ? [...new Set(invite_user_ids.map(Number).filter(Number.isInteger))].filter(uid => uid !== session.id)
    : [];
  if (requestedIds.length === 0) {
    return NextResponse.json({ message: 'Invite at least one friend' }, { status: 400 });
  }

  // Mutual follows only — same gate as room creation.
  const [mutualRows] = await db.execute(
    `SELECT u.id FROM users u
     JOIN follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
     WHERE u.id IN (${requestedIds.map(() => '?').join(',')})`,
    [session.id, session.id, ...requestedIds]
  ) as any[];
  const mutualIds = new Set((mutualRows as any[]).map(r => r.id));
  const invalid = requestedIds.filter(rid => !mutualIds.has(rid));
  if (invalid.length > 0) {
    return NextResponse.json({ message: 'You can only invite friends who follow you back' }, { status: 403 });
  }

  const [existingRows] = await db.execute(
    'SELECT user_id, status FROM hangout_room_players WHERE room_id = ?',
    [roomId]
  ) as any[];
  const existingByUser = new Map<number, string>((existingRows as any[]).map(r => [r.user_id, r.status]));
  const activeCount = (existingRows as any[]).filter(r => r.status !== 'left').length;

  // A player who left can be re-invited (their row already exists, just
  // flip it back to "invited"); anyone still invited/joined is skipped
  // rather than erroring, since re-selecting a current member is harmless.
  const brandNewIds = requestedIds.filter(rid => !existingByUser.has(rid));
  const rejoinIds = requestedIds.filter(rid => existingByUser.get(rid) === 'left');
  const toInvite = [...brandNewIds, ...rejoinIds];

  if (toInvite.length === 0) {
    return NextResponse.json({ message: 'Everyone selected is already in this room' }, { status: 400 });
  }
  if (activeCount + toInvite.length > MAX_PLAYERS) {
    return NextResponse.json({ message: `This room can hold up to ${MAX_PLAYERS} people` }, { status: 400 });
  }

  for (const inviteeId of brandNewIds) {
    await db.execute(
      'INSERT INTO hangout_room_players (room_id, user_id, status) VALUES (?, ?, "invited")',
      [roomId, inviteeId]
    );
  }
  for (const inviteeId of rejoinIds) {
    await db.execute(
      'UPDATE hangout_room_players SET status = "invited" WHERE room_id = ? AND user_id = ?',
      [roomId, inviteeId]
    );
  }
  for (const inviteeId of toInvite) {
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, message_preview) VALUES (?, ?, "hangout_invite", ?)',
      [inviteeId, session.id, String(roomId)]
    );
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:room_updated');

  return NextResponse.json({ ok: true, invited: toInvite.length });
}
