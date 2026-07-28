import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { getBankHealth } from '@/app/lib/trivia';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [pending] = await db.execute(
    `SELECT id, category, question, option_a, option_b, option_c, option_d, correct_option, created_at
     FROM trivia_questions WHERE needs_review = 1 ORDER BY created_at ASC`
  ) as any[];

  return NextResponse.json({
    health: await getBankHealth(),
    pending,
  });
}
