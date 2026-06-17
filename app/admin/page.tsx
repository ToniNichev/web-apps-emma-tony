import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.is_admin) redirect('/');
  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-10">
      <AdminClient isSuperAdmin={session.is_admin >= 2} />
    </main>
  );
}
