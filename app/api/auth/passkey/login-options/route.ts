import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { RP_ID } from '@/app/lib/webauthn';

export async function POST() {
  // No allowCredentials — this is the discoverable/usernameless flow, the
  // browser shows a picker of whatever passkeys it has saved for this site.
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
  });

  const cookieStore = await cookies();
  cookieStore.set('webauthn_challenge', options.challenge, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300,
  });

  return NextResponse.json(options);
}
