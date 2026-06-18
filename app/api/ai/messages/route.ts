import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getLunaHistory } from '@/app/lib/luna-history';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const history = await getLunaHistory(session.id);
  return NextResponse.json(history);
}
