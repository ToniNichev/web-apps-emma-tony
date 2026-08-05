import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import FamilyChatClient from './FamilyChatClient';

export const dynamic = 'force-dynamic';

export default async function FamilyChatPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [rows] = await db.execute(`
    SELECT * FROM (
      SELECT fc.id, fc.sender_id, fc.content, fc.created_at, u.username, u.first_name, u.profile_picture
      FROM family_chat_messages fc
      JOIN users u ON u.id = fc.sender_id
      ORDER BY fc.created_at DESC, fc.id DESC
      LIMIT 100
    ) recent
    ORDER BY created_at ASC, id ASC
  `) as any[];

  return (
    <main className="max-w-2xl mx-auto px-4 pt-2 pb-6">
      <FamilyChatClient initialMessages={rows as any[]} currentUserId={session.id} />
    </main>
  );
}
