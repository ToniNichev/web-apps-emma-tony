import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { rematch } from '@/app/lib/trivia-game';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by, status FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can start a rematch' }, { status: 403 });
  }
  if (room.status !== 'finished') {
    return NextResponse.json({ message: 'The match is still in progress' }, { status: 400 });
  }

  const { category } = await request.json();
  const result = await rematch(roomId, category);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
