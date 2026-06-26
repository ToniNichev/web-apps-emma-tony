import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/app/lib/db';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

export async function POST(request: Request) {
  if (!rateLimit(getClientIp(request), 10, 15 * 60 * 1000)) {
    return NextResponse.json({ message: 'Too many attempts. Please wait a while.' }, { status: 429 });
  }

  const { username, email, password, first_name, last_name, invite_code } = await request.json();

  if (!username || !email || !password || !invite_code) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const [inviteRows] = await db.execute(
    'SELECT id FROM invites WHERE code = ? AND used_by IS NULL',
    [invite_code.trim()]
  ) as any[];
  if (!(inviteRows as any[]).length) {
    return NextResponse.json({ message: 'Invalid or already-used invite code' }, { status: 400 });
  }
  const inviteId = (inviteRows as any[])[0].id;

  const [existing] = await db.execute(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  ) as any[];
  if ((existing as any[]).length > 0) {
    return NextResponse.json({ message: 'Email or username already taken' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const [result] = await db.execute(
    'INSERT INTO users (username, email, password, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashed, first_name || '', last_name || '']
  ) as any[];

  const newUserId = (result as any).insertId;
  await db.execute(
    'UPDATE invites SET used_by = ?, used_at = NOW() WHERE id = ?',
    [newUserId, inviteId]
  );

  return NextResponse.json({ message: 'Account created successfully' }, { status: 201 });
}
