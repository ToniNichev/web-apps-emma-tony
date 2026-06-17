import { NextResponse } from 'next/server';
import { serialize } from 'cookie';
import bcrypt from 'bcryptjs';
import db from '@/app/lib/db';
import { signJWT } from '@/app/lib/auth';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  ) as any[];

  if (!rows.length) {
    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }

  const token = signJWT({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    profile_picture: user.profile_picture,
    is_admin: user.is_admin,
  });

  const cookieOpts = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/' };

  const { password: _, ...safeUser } = user;
  const response = NextResponse.json({ user: safeUser }, { status: 200 });
  response.headers.append('Set-Cookie', serialize('auth', token, { ...cookieOpts, httpOnly: true, maxAge: 60 * 60 * 24 * 30 }));
  response.headers.append('Set-Cookie', serialize('theme', user.theme || 'bloom', { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 }));
  response.headers.append('Set-Cookie', serialize('dark', user.dark_mode ? '1' : '0', { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 }));
  return response;
}
