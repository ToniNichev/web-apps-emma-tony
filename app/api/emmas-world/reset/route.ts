import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

// Single hardcoded admin email rather than a general roles system --
// proportionate to a family/friends site with one person who should be able
// to clear the shared world, not a product with many admins.
const ADMIN_EMAIL = 'toni.nichev@gmail.com';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (session.email !== ADMIN_EMAIL) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await db.execute('DELETE FROM emmas_world_blocks');

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to('emmasworld').emit('emmasworld:world_reset');

  return NextResponse.json({ ok: true });
}
