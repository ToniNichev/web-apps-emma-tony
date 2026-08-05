import { NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import db from '@/app/lib/db';
import { signJWT } from '@/app/lib/auth';
import { RP_ID, ORIGIN } from '@/app/lib/webauthn';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { logActivity } from '@/app/lib/activity';

export async function POST(request: Request) {
  if (!rateLimit(getClientIp(request), 10, 15 * 60 * 1000)) {
    return NextResponse.json({ message: 'Too many attempts. Please wait a while.' }, { status: 429 });
  }

  const response = await request.json();

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;
  cookieStore.delete('webauthn_challenge');
  if (!expectedChallenge) {
    return NextResponse.json({ message: 'That took too long — try again' }, { status: 400 });
  }

  const [rows] = await db.execute(
    'SELECT * FROM webauthn_credentials WHERE credential_id = ?',
    [response.id]
  ) as any[];
  const cred = (rows as any[])[0];
  if (!cred) return NextResponse.json({ message: 'Passkey not recognized' }, { status: 401 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64')),
        counter: Number(cred.counter),
        transports: cred.transports ? cred.transports.split(',') : undefined,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not verify passkey' }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ message: 'Could not verify passkey' }, { status: 401 });
  }

  await db.execute(
    'UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW() WHERE id = ?',
    [verification.authenticationInfo.newCounter, cred.id]
  );

  const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [cred.user_id]) as any[];
  const user = (userRows as any[])[0];
  if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 401 });

  // Mirrors app/api/auth/login/route.ts's cookie issuance exactly — a
  // passkey login should end up in the identical signed-in state as a
  // password login.
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

  logActivity(user.id, 'login', undefined, getClientIp(request));
  const { password: _, ...safeUser } = user;
  const res = NextResponse.json({ user: safeUser }, { status: 200 });
  res.headers.append('Set-Cookie', serialize('auth', token, { ...cookieOpts, httpOnly: true, maxAge: 60 * 60 * 24 * 30 }));
  res.headers.append('Set-Cookie', serialize('theme', user.theme || 'bloom', { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 }));
  res.headers.append('Set-Cookie', serialize('dark', user.dark_mode ? '1' : '0', { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 }));
  return res;
}
