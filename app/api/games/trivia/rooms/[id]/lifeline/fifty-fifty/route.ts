import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { useFiftyFifty } from '@/app/lib/trivia-game';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const result = await useFiftyFifty(roomId, session.id);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
