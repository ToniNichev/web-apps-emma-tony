'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PostContent from './UrlEmbed';
import { getBg } from '@/app/lib/backgrounds';
import Lightbox from './Lightbox';

interface Post {
  id: number;
  user_id: number;
  content: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  like_count: number;
  comment_count: number;
  media_urls: string | null;
  media_types: string | null;
  media_thumbnails: string | null;
  background: string | null;
  created_at: string;
  hidden?: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PostCard({
  post, currentUserId, isAdmin, isSuperAdmin,
}: {
  post: Post;
  currentUserId: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hidden, setHidden] = useState(Boolean(post.hidden));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canDelete = post.user_id === currentUserId || isAdmin;
  const mediaUrls   = post.media_urls?.split('||').filter(Boolean)        || [];
  const mediaTypes  = post.media_types?.split('||').filter(Boolean)       || [];
  const mediaThumbs = post.media_thumbnails?.split('||').filter(Boolean)  || [];
  const imageUrls   = mediaUrls.filter((_, i) => mediaTypes[i] !== 'video');

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    if (showMenu) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu]);

  async function toggleLike() {
    const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
    const data = await res.json();
    setLiked(data.liked);
    setLikeCount(c => data.liked ? c + 1 : c - 1);
  }

  async function loadComments() {
    if (!showComments) {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      setComments(await res.json());
    }
    setShowComments(v => !v);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText }),
    });
    setCommentText('');
    const res = await fetch(`/api/posts/${post.id}/comments`);
    setComments(await res.json());
    setSubmitting(false);
  }

  async function handleDelete() {
    await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    setDeleted(true);
    router.refresh();
  }

  async function handleHide() {
    const res = await fetch(`/api/posts/${post.id}/hide`, { method: 'PATCH' });
    const data = await res.json();
    setHidden(Boolean(data.hidden));
    setShowMenu(false);
  }

  if (deleted) return null;

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          urls={imageUrls}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex(i => Math.min(imageUrls.length - 1, (i ?? 0) + 1))}
        />
      )}

      <div className={`card overflow-hidden transition-opacity ${hidden ? 'opacity-60 ring-2 ring-orange-300' : ''}`}>
        {/* Hidden banner */}
        {hidden && isSuperAdmin && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs text-orange-600 font-semibold">🚫 Hidden from feed</span>
            <button onClick={handleHide} className="ml-auto text-xs text-orange-500 hover:text-orange-700 underline">Unhide</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <Link href={`/profile/${post.username}`}>
            {post.profile_picture ? (
              <img src={post.profile_picture} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold">
                {post.first_name?.[0] || post.username[0]}
              </div>
            )}
          </Link>
          <div className="flex-1">
            <Link href={`/profile/${post.username}`} className="font-semibold text-sm hover:text-pink-500 transition">
              {post.first_name} {post.last_name}
            </Link>
            <p className="text-xs text-gray-400">@{post.username} · {timeAgo(post.created_at)}</p>
          </div>

          {canDelete && (
            <div className="relative" ref={menuRef}>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleDelete} className="text-xs text-red-500 font-semibold hover:text-red-600">Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowMenu(v => !v)}
                    className="text-gray-300 hover:text-red-400 transition text-lg leading-none px-1">···</button>
                  {showMenu && (
                    <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[140px]">
                      {isSuperAdmin && (
                        <button onClick={handleHide}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 text-orange-500 transition">
                          {hidden ? '👁 Unhide post' : '🚫 Hide post'}
                        </button>
                      )}
                      <button onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-500 transition">
                        🗑 Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {post.content && post.background && mediaUrls.length === 0 ? (
          <div className={`post-bg-${post.background} px-6 py-10 min-h-44 flex items-center justify-center`}>
            <p className="text-lg font-semibold text-center leading-relaxed whitespace-pre-wrap"
              style={{
                color: getBg(post.background).darkText ? '#1f2937' : 'white',
                textShadow: getBg(post.background).darkText ? 'none' : '0 1px 3px rgba(0,0,0,0.25)',
              }}>
              {post.content}
            </p>
          </div>
        ) : post.content ? (
          <PostContent text={post.content} />
        ) : null}

        {/* Media — thumbnails in feed, full image in lightbox */}
        {mediaUrls.length > 0 && (
          <div className={`grid gap-0.5 ${mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {mediaUrls.map((url, i) =>
              mediaTypes[i] === 'video' ? (
                <video key={i} src={url} controls preload="none" className="w-full max-h-96 object-cover bg-black" />
              ) : (
                <img
                  key={i}
                  src={mediaThumbs[i] || url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover max-h-96 cursor-zoom-in"
                  onClick={() => setLightboxIndex(imageUrls.indexOf(url))}
                />
              )
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-50">
          <button onClick={toggleLike}
            className={`flex items-center gap-1.5 text-sm transition ${liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
            <span>{liked ? '❤️' : '🤍'}</span>
            <span>{likeCount}</span>
          </button>
          <button onClick={loadComments}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-400 transition">
            <span>💬</span>
            <span>{post.comment_count}</span>
          </button>
          <button
            onClick={() => { if (navigator.share) { navigator.share({ url: `${window.location.origin}/post/${post.id}` }); } else { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); } }}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-400 transition">
            <span>🔗</span>
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t border-gray-50 px-4 pb-4">
            <div className="space-y-3 mt-3 max-h-48 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {c.first_name?.[0] || c.username[0]}
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                    <span className="font-semibold text-xs text-gray-700">{c.first_name} </span>
                    <span className="text-xs text-gray-600">{c.content}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitComment} className="flex gap-2 mt-3">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-300 transition" />
              <button type="submit" disabled={submitting}
                className="brand-gradient text-white text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-60">Post</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
