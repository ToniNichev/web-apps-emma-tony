import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';
import NavBar from '@/app/components/NavBar';
import PostCard from '@/app/components/PostCard';
import FollowButton from '@/app/components/FollowButton';
import MessageButton from '@/app/components/MessageButton';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";
  if (!session) redirect('/login');

  const { username } = await params;

  const [users] = await db.execute(
    'SELECT id, username, first_name, last_name, bio, profile_picture, cover_photo, created_at FROM users WHERE username = ?',
    [username]
  ) as any[];

  const user = (users as any[])[0];
  if (!user) notFound();

  const [posts] = await db.execute(`
    SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
      GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
      GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN media m ON m.post_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [user.id]) as any[];

  const [followerRows] = await db.execute('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]) as any[];
  const [followingRows] = await db.execute('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]) as any[];
  const [isFollowingRows] = await db.execute(
    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    [session.id, user.id]
  ) as any[];

  const followerCount = (followerRows as any[])[0].count;
  const followingCount = (followingRows as any[])[0].count;
  const isFollowing = (isFollowingRows as any[]).length > 0;
  const isOwn = session.id === user.id;

  return (
    <>
      <NavBar user={session} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile card */}
        <div className="card overflow-hidden mb-6">
          <div className="h-24 brand-gradient" />
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-12 mb-4">
              <div className="w-20 h-20 rounded-full border-4 border-white brand-gradient flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                {user.profile_picture
                  ? <img src={user.profile_picture} alt="" className="w-full h-full object-cover" />
                  : (user.first_name?.[0] || user.username[0])}
              </div>
              {!isOwn && (<><MessageButton otherUserId={user.id} /> 
<FollowButton userId={user.id} initialFollowing={isFollowing} /></>
              )}
            </div>
            <h1 className="text-xl font-bold">{user.first_name} {user.last_name}</h1>
            <p className="text-gray-400 text-sm">@{user.username}</p>
            {user.bio && <p className="text-gray-600 text-sm mt-2">{user.bio}</p>}
            <div className="flex gap-6 mt-4 text-sm">
              <div><span className="font-bold">{(posts as any[]).length}</span> <span className="text-gray-400">posts</span></div>
              <div><span className="font-bold">{followerCount}</span> <span className="text-gray-400">followers</span></div>
              <div><span className="font-bold">{followingCount}</span> <span className="text-gray-400">following</span></div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {(posts as any[]).length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-gray-400">{isOwn ? "You haven't posted yet!" : `${user.first_name} hasn't posted yet.`}</p>
              {isOwn && (
                <a href="/create" className="inline-block mt-3 brand-gradient text-white text-sm font-semibold px-5 py-2 rounded-full">
                  Create your first post
                </a>
              )}
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
