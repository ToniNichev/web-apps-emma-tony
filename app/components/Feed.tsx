'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import PostCard, { type Post } from './PostCard';
import TiltCard from './TiltCard';
import Lightbox from './Lightbox';
import { POSTS_PAGE_SIZE } from '@/app/lib/constants';

export default function Feed({
  posts, currentUserId, isAdmin, isSuperAdmin, hasMore: initialHasMore,
}: {
  posts: Post[];
  currentUserId: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  hasMore?: boolean;
}) {
  const [allPosts, setAllPosts] = useState(posts);
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore));
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || allPosts.length === 0) return;
    setLoading(true);
    const lastId = allPosts[allPosts.length - 1].id;
    const res = await fetch(`/api/posts?before=${lastId}`);
    const next: Post[] = res.ok ? await res.json() : [];
    setAllPosts(prev => [...prev, ...next]);
    setHasMore(next.length === POSTS_PAGE_SIZE);
    setLoading(false);
  }, [loading, hasMore, allPosts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const gallery: string[] = [];
  for (const post of allPosts) {
    const urls  = post.media_urls?.split('||').filter(Boolean)  || [];
    const types = post.media_types?.split('||').filter(Boolean) || [];
    urls.forEach((url, i) => { if (types[i] !== 'video') gallery.push(url); });
  }

  return (
    <>
      <div className="space-y-4">
        {allPosts.map(post => (
          <TiltCard key={post.id}>
            <PostCard
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              onImageClick={url => {
                const idx = gallery.indexOf(url);
                if (idx !== -1) setLightboxIndex(idx);
              }}
            />
          </TiltCard>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="py-6 text-center">
          {loading && <span className="text-sm text-gray-400">Loading more… ✨</span>}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          urls={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex(i => Math.min(gallery.length - 1, (i ?? 0) + 1))}
        />
      )}
    </>
  );
}
