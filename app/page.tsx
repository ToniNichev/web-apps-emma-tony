import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';
import { getSiteSettings } from '@/app/lib/site-settings';
import { getBg } from '@/app/lib/backgrounds';
import db from '@/app/lib/db';
import Feed from '@/app/components/Feed';
import StoriesBar from '@/app/components/StoriesBar';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth")?.value || "";
  if (!session) redirect('/login');

  const isSuperAdmin = (session.is_admin ?? 0) >= 2;
  const hiddenFilter = isSuperAdmin ? '' : 'AND (p.hidden IS NULL OR p.hidden = 0)';

  const [settings, stories, posts] = await Promise.all([
    getSiteSettings(),

    db.execute(`
      SELECT
        s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.expires_at,
        u.username, u.first_name, u.last_name, u.profile_picture,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as view_count,
        EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ?) as viewed
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE (s.expires_at IS NULL OR s.expires_at > NOW())
        AND (s.user_id = ? OR s.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        ))
      ORDER BY s.user_id = ? DESC, s.created_at DESC
    `, [session.id, session.id, session.id, session.id]),

    db.execute(`
      SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
        GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
        GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types,
        GROUP_CONCAT(DISTINCT m.thumbnail_url ORDER BY m.order_index SEPARATOR '||') as media_thumbnails
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN media m ON m.post_id = p.id
      WHERE 1=1 ${hiddenFilter}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `),
  ]);

  const storyRows = (stories as any[][])[0] as any[];
  const postRows  = (posts  as any[][])[0] as any[];

  const storyUserMap = new Map<number, any>();
  for (const row of storyRows) {
    if (!storyUserMap.has(row.user_id)) {
      storyUserMap.set(row.user_id, {
        user_id: row.user_id, username: row.username,
        first_name: row.first_name, last_name: row.last_name,
        profile_picture: row.profile_picture, stories: [], has_unseen: false,
      });
    }
    const u = storyUserMap.get(row.user_id);
    u.stories.push(row);
    if (!row.viewed) u.has_unseen = true;
  }
  const storyGroups = [
    ...(storyUserMap.has(session.id)
      ? [storyUserMap.get(session.id)]
      : [{ user_id: session.id, username: session.username, first_name: session.first_name, profile_picture: session.profile_picture || null, stories: [], has_unseen: false }]),
    ...Array.from(storyUserMap.values()).filter(g => g.user_id !== session.id),
  ];

  const bannerBg  = settings.banner_bg || 'none';
  const bgOpt     = getBg(bannerBg);
  const showBanner = settings.banner_enabled === '1' && (settings.banner_text || settings.banner_image);

  return (
    <main className="max-w-2xl mx-auto px-4 pt-2 pb-6">
      {/* Welcome banner */}
      {showBanner && (
        <div className={`mb-4 rounded-2xl overflow-hidden ${bannerBg !== 'none' ? `post-bg-${bannerBg}` : 'bg-gradient-to-r from-pink-50 to-purple-50'}`}>
          {settings.banner_image && (
            <img src={settings.banner_image} alt="" className="w-full max-h-48 object-cover" />
          )}
          {settings.banner_text && (
            <p
              className="px-6 py-4 font-semibold text-center text-sm leading-relaxed"
              style={{
                color: bgOpt.darkText ? '#1f2937' : 'white',
                textShadow: bgOpt.darkText ? 'none' : '0 1px 3px rgba(0,0,0,0.25)',
              }}
            >
              {settings.banner_text}
            </p>
          )}
        </div>
      )}

      {/* Site tagline */}
      {settings.site_tagline && (
        <p className="text-center text-sm text-gray-400 mb-3">{settings.site_tagline}</p>
      )}

      <StoriesBar initialStories={storyGroups} currentUserId={session.id} />

      {postRows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">✨</p>
          <p className="text-gray-500 font-medium">No posts yet — be the first!</p>
          <a href="/create" className="inline-block mt-4 brand-gradient text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition">
            Create a post
          </a>
        </div>
      ) : (
        <Feed
          posts={postRows}
          currentUserId={session.id}
          isAdmin={session.is_admin >= 1}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </main>
  );
}
