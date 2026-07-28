import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { startMatch } from '@/app/lib/trivia-game';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by, status FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can start the game' }, { status: 403 });
  }
  if (room.status !== 'lobby') {
    return NextResponse.json({ message: 'This match has already started' }, { status: 400 });
  }

  const { category } = await request.json();
  const result = await startMatch(roomId, category);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
