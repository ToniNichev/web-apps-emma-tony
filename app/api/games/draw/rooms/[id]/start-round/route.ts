import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { startNextRound } from '@/app/lib/draw-guess';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM game_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can start a round' }, { status: 403 });
  }

  const result = await startNextRound(roomId);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
