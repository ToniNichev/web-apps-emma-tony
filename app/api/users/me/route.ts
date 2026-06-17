import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import bcrypt from 'bcryptjs';

const VALID_THEMES = ['bloom', 'ocean', 'sunset', 'forest', 'midnight'];

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { first_name, last_name, bio, profile_picture, current_password, new_password, theme, dark_mode } = body;

  if (new_password) {
    const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [session.id]) as any[];
    const user = (rows as any[])[0];
    const valid = await bcrypt.compare(current_password || '', user.password);
    if (!valid) return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 });
    const hashed = await bcrypt.hash(new_password, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, session.id]);
    return NextResponse.json({ message: 'Password updated' });
  }

  if (theme !== undefined) {
    if (!VALID_THEMES.includes(theme)) return NextResponse.json({ message: 'Invalid theme' }, { status: 400 });
    await db.execute('UPDATE users SET theme = ? WHERE id = ?', [theme, session.id]);
    const res = NextResponse.json({ message: 'Theme updated' });
    res.cookies.set('theme', theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }

  if (dark_mode !== undefined) {
    const val = dark_mode ? 1 : 0;
    await db.execute('UPDATE users SET dark_mode = ? WHERE id = ?', [val, session.id]);
    const res = NextResponse.json({ message: 'Dark mode updated' });
    res.cookies.set('dark', val ? '1' : '0', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }

  await db.execute(
    'UPDATE users SET first_name = ?, last_name = ?, bio = ?, profile_picture = ? WHERE id = ?',
    [first_name, last_name, bio || null, profile_picture || null, session.id]
  );

  return NextResponse.json({ message: 'Profile updated' });
}
