import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '@/app/lib/db';

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token) {
    return NextResponse.json({ message: 'Reset token is required' }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json({ message: 'Password must be at least 6 characters long' }, { status: 400 });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return NextResponse.json({ message: 'This password reset link has expired. Please request a new one.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Invalid password reset link. Please request a new one.' }, { status: 400 });
  }

  if (decoded.purpose !== 'password-reset') {
    return NextResponse.json({ message: 'Invalid password reset link.' }, { status: 400 });
  }

  const { email } = decoded;
  const hashed = await bcrypt.hash(password, 12);

  const [result] = await db.execute(
    'UPDATE users SET password = ? WHERE email = ?',
    [hashed, email]
  ) as any[];

  if (result.affectedRows === 0) {
    return NextResponse.json({ message: 'Account not found. Please sign up for a new account.' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Your password has been reset successfully. You can now log in with your new password.' }, { status: 200 });
}
