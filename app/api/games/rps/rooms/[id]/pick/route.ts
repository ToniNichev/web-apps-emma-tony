import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { submitPick, MOVES } from '@/app/lib/rps';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const { move } = await request.json();
  if (!MOVES.includes(move)) {
    return NextResponse.json({ message: 'Invalid move' }, { status: 400 });
  }

  const result = await submitPick(roomId, session.id, move);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
