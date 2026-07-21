import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import KindnessWallClient from './KindnessWallClient';

export const dynamic = 'force-dynamic';

export default async function KindnessPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [notes] = await db.execute(
    'SELECT id, message, created_at FROM kindness_notes WHERE recipient_id = ? AND hidden = 0 ORDER BY created_at DESC',
    [session.id]
  ) as any[];

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Kindness Wall 💛</h1>
        <p className="text-sm text-gray-400 mt-1">Kind notes friends have sent you — sender stays a secret.</p>
      </div>

      <KindnessWallClient initialNotes={notes} />
    </main>
  );
}
