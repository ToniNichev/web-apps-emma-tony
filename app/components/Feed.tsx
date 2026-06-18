'use client';
import { useState } from 'react';
import PostCard, { type Post } from './PostCard';
import Lightbox from './Lightbox';

export default function Feed({
  posts, currentUserId, isAdmin, isSuperAdmin,
}: {
  posts: Post[];
  currentUserId: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const gallery: string[] = [];
  for (const post of posts) {
    const urls  = post.media_urls?.split('||').filter(Boolean)  || [];
    const types = post.media_types?.split('||').filter(Boolean) || [];
    urls.forEach((url, i) => { if (types[i] !== 'video') gallery.push(url); });
  }

  return (
    <>
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            onImageClick={url => {
              const idx = gallery.indexOf(url);
              if (idx !== -1) setLightboxIndex(idx);
            }}
          />
        ))}
      </div>

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
