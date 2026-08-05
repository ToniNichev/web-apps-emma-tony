import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import { RP_NAME, RP_ID } from '@/app/lib/webauthn';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?',
    [session.id]
  ) as any[];
  const existing = rows as any[];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(String(session.id)),
    userName: session.username,
    userDisplayName: session.first_name,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.credential_id,
      transports: c.transports ? c.transports.split(',') : undefined,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  // Short-lived challenge cookie bridges the options -> verify round trip;
  // there's no server-side session storage in this app (JWT is stateless).
  const cookieStore = await cookies();
  cookieStore.set('webauthn_challenge', options.challenge, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300,
  });

  return NextResponse.json(options);
}
