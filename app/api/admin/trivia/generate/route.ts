import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { generateQuestions, CATEGORIES } from '@/app/lib/trivia';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { category } = await request.json();
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
  }

  const result = await generateQuestions(category);
  if ('error' in result) return NextResponse.json({ message: result.error }, { status: 502 });

  return NextResponse.json(result);
}
