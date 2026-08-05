import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const publicPaths = [
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
  '/forgot-password',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  // Passkey login happens before the user has an auth cookie, same as
  // /api/auth/login above — register-options/verify are deliberately NOT
  // here, since adding a passkey requires an existing signed-in session.
  '/api/auth/passkey/login-options',
  '/api/auth/passkey/login-verify',
];

export async function proxy(request: import('next/server').NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname.startsWith('/uploads')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
