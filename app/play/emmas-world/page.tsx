import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import EmmasWorldClient from './EmmasWorldClient';

export const dynamic = 'force-dynamic';

// Kept in sync with app/api/emmas-world/reset/route.ts's ADMIN_EMAIL --
// this only controls whether the button renders, the API route re-checks
// server-side regardless.
const ADMIN_EMAIL = 'toni.nichev@gmail.com';

// Emma's World is a single shared space, not per-room like Hangout/RPS/Trivia
// -- no room id, no DB lookups here. The Unity build itself fetches the
// world's persisted blocks (GET /api/emmas-world/blocks) once it connects.
export default async function EmmasWorldPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <main className="max-w-5xl mx-auto px-4 pt-4 pb-8">
      <h1 className="text-xl font-bold brand-text mb-3">Emma&apos;s World</h1>
      <EmmasWorldClient isAdmin={session.email === ADMIN_EMAIL} />
    </main>
  );
}
