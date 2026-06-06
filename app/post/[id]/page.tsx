import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import NavBar from '@/app/components/NavBar';
import PostCard from '@/app/components/PostCard';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";

  const [rows] = await db.execute(`
    SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
      GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
      GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN media m ON m.post_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `, [id]) as any[];

  const post = (rows as any[])[0];
  if (!post) notFound();

  return (
    <>
      {session && <NavBar user={session} />}
      {!session && (
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Emma's Space ✨
            </a>
            <a href="/login" className="brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full">Sign in</a>
          </div>
        </nav>
      )}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <PostCard post={post} currentUserId={session?.id ?? 0} isAdmin={!!session?.is_admin} />
      </main>
    </>
  );
}
