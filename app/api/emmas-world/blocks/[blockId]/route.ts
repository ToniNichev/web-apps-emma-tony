import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { blockId } = await params;

  // Anyone signed in can remove any block, not just their own placer --
  // same collaborative-editing model as Hangout Room's object removal.
  const [result] = await db.execute(
    'DELETE FROM emmas_world_blocks WHERE id = ?',
    [blockId]
  ) as any[];
  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'Block not found' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to('emmasworld').emit('emmasworld:block_removed', { id: Number(blockId) });

  return NextResponse.json({ ok: true });
}
