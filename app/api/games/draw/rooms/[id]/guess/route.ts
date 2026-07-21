import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { endRound } from '@/app/lib/draw-guess';
import { checkBadges } from '@/app/lib/badges';

const MAX_LENGTH = 50;
const POINTS_PER_WIN = 10;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const { guess } = await request.json();
  const trimmed = (guess ?? '').trim();
  if (!trimmed) return NextResponse.json({ message: 'Guess cannot be empty' }, { status: 400 });
  if (trimmed.length > MAX_LENGTH) return NextResponse.json({ message: `Keep it under ${MAX_LENGTH} characters` }, { status: 400 });

  const [roomRows] = await db.execute(
    'SELECT status, current_word, current_drawer_id FROM game_rooms WHERE id = ?',
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.status !== 'active' || !room.current_word) {
    return NextResponse.json({ message: 'No round is active right now' }, { status: 400 });
  }
  if (room.current_drawer_id === session.id) {
    return NextResponse.json({ message: "The drawer can't guess their own word" }, { status: 403 });
  }

  const [memberRows] = await db.execute(
    'SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, session.id]
  ) as any[];
  if ((memberRows as any[]).length === 0) {
    return NextResponse.json({ message: 'You are not in this room' }, { status: 403 });
  }

  if (!(await isPromptSafe(trimmed))) {
    return NextResponse.json({ message: "That guess isn't allowed here. Try again! 🎨" }, { status: 400 });
  }

  const correct = trimmed.toLowerCase() === String(room.current_word).toLowerCase();
  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;

  if (correct) {
    await db.execute(
      'UPDATE game_room_players SET score = score + ? WHERE room_id = ? AND user_id = ?',
      [POINTS_PER_WIN, roomId, session.id]
    );
    io?.to(`game:${roomId}`).emit('game:guess', {
      user_id: session.id, first_name: session.first_name, text: trimmed, correct: true,
    });
    await endRound(roomId, { reason: 'guessed', winnerId: session.id });
    checkBadges(session.id).catch(() => {});
  } else {
    io?.to(`game:${roomId}`).emit('game:guess', {
      user_id: session.id, first_name: session.first_name, text: trimmed, correct: false,
    });
  }

  return NextResponse.json({ correct });
}
