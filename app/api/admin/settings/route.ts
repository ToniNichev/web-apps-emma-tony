import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const [rows] = await db.execute('SELECT `key`, `value` FROM site_settings') as any[];
  const settings: Record<string, string> = {};
  for (const row of rows as any[]) settings[row.key] = row.value ?? '';
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const body = await request.json();
  const allowed = ['site_name','site_tagline','default_theme','banner_enabled','banner_text','banner_image','banner_bg'];
  for (const [key, value] of Object.entries(body)) {
    if (allowed.includes(key)) {
      const v = String(value ?? '');
      await db.execute(
        'INSERT INTO site_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, v, v] as any[]
      );
    }
  }
  return NextResponse.json({ ok: true });
}
