import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { submitAnswer } from '@/app/lib/trivia-game';

const VALID_OPTIONS = ['a', 'b', 'c', 'd'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const { option } = await request.json();
  if (!VALID_OPTIONS.includes(option)) {
    return NextResponse.json({ message: 'Invalid answer' }, { status: 400 });
  }

  const result = await submitAnswer(roomId, session.id, option);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json(result);
}
