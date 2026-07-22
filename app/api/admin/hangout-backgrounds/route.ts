import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [rows] = await db.execute(`
    SELECT r.id as room_id, r.background_url,
      h.username as host_username, h.first_name as host_first_name
    FROM hangout_rooms r
    JOIN users h ON h.id = r.created_by
    WHERE r.background_status = 'reported'
    ORDER BY r.id DESC
  `) as any[];

  return NextResponse.json(rows);
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { room_id, restore } = await request.json();
  if (!room_id) return NextResponse.json({ message: 'room_id required' }, { status: 400 });

  if (restore) {
    // Admin judged the image fine — keep it, just lift the report.
    await db.execute('UPDATE hangout_rooms SET background_status = "active" WHERE id = ?', [room_id]);
  } else {
    // Not fine — clear it entirely, room falls back to the built-in default.
    await db.execute('UPDATE hangout_rooms SET background_url = NULL, background_status = "active" WHERE id = ?', [room_id]);
  }
  await db.execute('DELETE FROM hangout_background_reports WHERE room_id = ?', [room_id]);

  return NextResponse.json({ ok: true });
}
