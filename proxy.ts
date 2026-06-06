import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const publicPaths = ['/login', '/signup', '/api/auth/login', '/api/auth/signup'];

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
