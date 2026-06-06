import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import NavBar from '@/app/components/NavBar';
import PostCard from '@/app/components/PostCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";
  if (!session) redirect('/login');

  const [posts] = await db.execute(`
    SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
      GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
      GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN media m ON m.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `) as any[];

  return (
    <>
      <NavBar user={session} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {(posts as any[]).length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-500 font-medium">No posts yet — be the first!</p>
              <a href="/create" className="inline-block mt-4 brand-gradient text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition">
                Create a post
              </a>
            </div>
          ) : (
            (posts as any[]).map(post => (
              <PostCard key={post.id} post={post} currentUserId={session.id} />
            ))
          )}
        </div>
      </main>
    </>
  );
}
