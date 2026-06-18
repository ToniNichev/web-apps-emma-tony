import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import MessagesClient from './MessagesClient';
import { cookies } from 'next/headers';
import { getSiteSettings } from '@/app/lib/site-settings';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const cookieStore = await cookies();
  const token = cookieStore.get('auth')?.value || '';
  const siteSettings = await getSiteSettings();

  const [convos] = await db.execute(`
    SELECT c.*,
      CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id,
      u.username as other_username, u.first_name as other_first_name,
      u.last_name as other_last_name, u.profile_picture as other_profile_picture,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) as unread_count
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY c.created_at DESC
  `, [session.id, session.id, session.id, session.id, session.id]) as any[];

  return (
          <main className="max-w-2xl mx-auto md:px-4 md:pt-2 md:pb-6 messages-page">
        <MessagesClient conversations={convos as any[]} currentUser={session} lunaName={siteSettings.luna_name} />
      </main>
  );
}
