import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import ChallengesClient from './ChallengesClient';

export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);

  const [challengeRows] = await db.execute(
    `SELECT dc.id, dc.prompt, dc.emoji, dc.active_date,
       (SELECT COUNT(*) FROM challenge_responses cr WHERE cr.challenge_id = dc.id) as response_count,
       (SELECT id FROM challenge_responses cr WHERE cr.challenge_id = dc.id AND cr.user_id = ?) as my_response_id
     FROM daily_challenges dc
     ORDER BY dc.active_date DESC`,
    [session.id]
  ) as any[];

  const challenges = challengeRows as any[];

  // Load responses for all challenges
  const withResponses = await Promise.all(
    challenges.map(async (c: any) => {
      const [responses] = await db.execute(
        `SELECT cr.id, cr.content, cr.media_url, cr.media_type, cr.created_at,
           u.username, u.first_name, u.profile_picture
         FROM challenge_responses cr
         JOIN users u ON u.id = cr.user_id
         WHERE cr.challenge_id = ?
         ORDER BY cr.created_at ASC`,
        [c.id]
      ) as any[];
      return { ...c, responses };
    })
  );

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Challenge History 🎯</h1>
        <p className="text-sm text-gray-400 mt-1">Every daily challenge, all in one place.</p>
      </div>

      <ChallengesClient
        challenges={withResponses}
        currentUserId={session.id}
        today={today}
      />
    </main>
  );
}
