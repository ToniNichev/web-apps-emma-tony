import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const secret = process.env.JWT_SECRET!;

export interface JWTPayload {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture: string | null;
  is_admin: number;
}

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth')?.value;
  if (!token) return null;
  return verifyJWT(token);
}
