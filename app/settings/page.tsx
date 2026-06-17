import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";
  if (!session) redirect('/login');

  const [rows] = await db.execute(
    'SELECT first_name, last_name, bio, profile_picture, username, theme, dark_mode FROM users WHERE id = ?',
    [session.id]
  ) as any[];
  const user = (rows as any[])[0];

  return (
          <main className="max-w-2xl mx-auto px-4 pt-2 pb-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <SettingsClient user={user} />
      </main>
  );
}
