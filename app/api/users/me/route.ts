import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import bcrypt from 'bcryptjs';
import { AVATAR_EMOJIS, AVATAR_COLORS, AVATAR_ACCESSORIES } from '@/app/lib/avatar-options';

const VALID_THEMES = ['bloom', 'ocean', 'sunset', 'forest', 'midnight'];

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { first_name, last_name, bio, profile_picture, current_password, new_password, theme, dark_mode,
          now_playing_song, now_playing_artist, birthday } = body;

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

  const { avatar_emoji, avatar_color, avatar_accessory } = body;
  if (avatar_emoji !== undefined || avatar_color !== undefined || avatar_accessory !== undefined) {
    if (avatar_emoji !== null && !AVATAR_EMOJIS.includes(avatar_emoji)) {
      return NextResponse.json({ message: 'Invalid avatar' }, { status: 400 });
    }
    if (avatar_color !== null && !AVATAR_COLORS.some(c => c.id === avatar_color)) {
      return NextResponse.json({ message: 'Invalid color' }, { status: 400 });
    }
    if (avatar_accessory !== null && !AVATAR_ACCESSORIES.includes(avatar_accessory)) {
      return NextResponse.json({ message: 'Invalid accessory' }, { status: 400 });
    }
    await db.execute(
      'UPDATE users SET avatar_emoji = ?, avatar_color = ?, avatar_accessory = ? WHERE id = ?',
      [avatar_emoji ?? null, avatar_color ?? null, avatar_accessory ?? null, session.id]
    );
    return NextResponse.json({ message: 'Avatar updated' });
  }

  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return NextResponse.json({ message: 'Invalid birthday format' }, { status: 400 });
  }

  await db.execute(
    `UPDATE users SET first_name = ?, last_name = ?, bio = ?, profile_picture = ?,
      now_playing_song = ?, now_playing_artist = ?, birthday = ? WHERE id = ?`,
    [
      first_name, last_name, bio || null, profile_picture || null,
      now_playing_song?.trim() || null, now_playing_artist?.trim() || null,
      birthday || null, session.id,
    ]
  );

  return NextResponse.json({ message: 'Profile updated' });
}
