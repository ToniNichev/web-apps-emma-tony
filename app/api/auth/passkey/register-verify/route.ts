import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import { RP_ID, ORIGIN } from '@/app/lib/webauthn';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { response, nickname } = await request.json();

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;
  cookieStore.delete('webauthn_challenge');
  if (!expectedChallenge) {
    return NextResponse.json({ message: 'That took too long — try again' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not verify passkey' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ message: 'Could not verify passkey' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await db.execute(
    `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, transports, nickname)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      credential.id,
      Buffer.from(credential.publicKey).toString('base64'),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      credential.transports?.join(',') || null,
      (nickname || '').trim().slice(0, 100) || null,
    ]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
