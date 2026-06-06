import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/app/lib/db';

export async function POST(request: Request) {
  const { username, email, password, first_name, last_name } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const [existing] = await db.execute(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  ) as any[];

  if ((existing as any[]).length > 0) {
    return NextResponse.json({ message: 'Email or username already taken' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await db.execute(
    'INSERT INTO users (username, email, password, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashed, first_name || '', last_name || '']
  );

  return NextResponse.json({ message: 'Account created successfully' }, { status: 201 });
}
