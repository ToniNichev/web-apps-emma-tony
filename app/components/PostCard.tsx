'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PostContent from './UrlEmbed';
import GifPicker from './GifPicker';
import { getBg } from '@/app/lib/backgrounds';
import Lightbox from './Lightbox';

export interface Post {
  id: number;
  user_id: number;
  content: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  like_count: number;
  my_reaction?: string | null;
  comment_count: number;
  poll_id?: number | null;
  media_urls: string | null;
  media_types: string | null;
  media_thumbnails: string | null;
  background: string | null;
  created_at: string;
  hidden?: number;
  right_now_session_id?: number | null;
  right_now_seconds_late?: number | null;
}

const REACTIONS = ['❤️', '🔥', '😍', '😂', '😮', '✨', '👏', '😢', '💯', '🎉', '😎', '🤩'];

interface PollOption { id: number; option_text: string; vote_count: number }

function PollBlock({ postId }: { postId: number }) {
  const [options, setOptions] = useState<PollOption[] | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}/poll`)
      .then(res => res.json())
      .then(data => {
        if (data) { setOptions(data.options); setMyVote(data.myVote); }
      });
  }, [postId]);

  async function vote(optionId: number) {
    if (voting || optionId === myVote) return;
    setVoting(true);
    const res = await fetch(`/api/posts/${postId}/poll/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    });
    const data = await res.json();
    setOptions(data.options);
    setMyVote(data.myVote);
    setVoting(false);
  }

  if (!options) return null;
  const total = options.reduce((s, o) => s + o.vote_count, 0);

  return (
    <div className="px-4 pb-2 space-y-2">
      {options.map(o => {
        const pct = total > 0 ? Math.round((o.vote_count / total) * 100) : 0;
        const isMine = myVote === o.id;
        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            disabled={voting}
            className={`relative w-full text-left rounded-xl border overflow-hidden transition ${isMine ? 'border-pink-400' : 'border-gray-200 hover:border-pink-200'}`}
          >
            {myVote !== null && (
              <div
                className={`absolute inset-y-0 left-0 ${isMine ? 'bg-pink-100' : 'bg-gray-50'}`}
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between px-3 py-2 text-sm">
              <span className={`font-medium ${isMine ? 'text-pink-600' : 'text-gray-700'}`}>
                {isMine && '✓ '}{o.option_text}
              </span>
              {myVote !== null && <span className="text-xs text-gray-400">{pct}%</span>}
            </div>
          </button>
        );
      })}
      <p className="text-xs text-gray-400">{total} vote{total === 1 ? '' : 's'}</p>
    </div>
  );
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
  post, currentUserId, isAdmin, isSuperAdmin, onImageClick,
}: {
  post: Post;
  currentUserId: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  onImageClick?: (url: string) => void;
}) {
  const router = useRouter();
  const [myReaction, setMyReaction] = useState<string | null>(post.my_reaction || null);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [reactionBreakdown, setReactionBreakdown] = useState<{ emoji: string; count: number }[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingGif, setPendingGif] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hidden, setHidden] = useState(Boolean(post.hidden));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);

  const canDelete = post.user_id === currentUserId || isAdmin;
  const mediaUrls   = post.media_urls?.split('||').filter(Boolean)        || [];
  const mediaTypes  = post.media_types?.split('||').filter(Boolean)       || [];
  // Not .filter(Boolean) — GROUP_CONCAT(COALESCE(thumbnail_url, '')) emits an
  // empty-string placeholder for media with no thumbnail so this array stays
  // index-aligned with mediaUrls/mediaTypes; filtering would drop those
  // placeholders and shift every thumbnail after them onto the wrong media.
  const mediaThumbs = post.media_thumbnails?.split('||') || [];
  const imageUrls   = mediaUrls.filter((_, i) => mediaTypes[i] !== 'video');

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) setShowReactions(false);
    }
    if (showMenu || showReactions) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu, showReactions]);

  useEffect(() => {
    if (post.like_count > 0) {
      fetch(`/api/posts/${post.id}/reactions`)
        .then(res => res.json())
        .then(setReactionBreakdown);
    }
  }, [post.id, post.like_count]);

  async function react(emoji: string) {
    setShowReactions(false);
    const prevEmoji = myReaction;
    const res = await fetch(`/api/posts/${post.id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    const nextEmoji = data.reacted ? data.emoji : null;
    setMyReaction(nextEmoji);
    setLikeCount(c => {
      if (nextEmoji && !prevEmoji) return c + 1;
      if (!nextEmoji && prevEmoji) return c - 1;
      return c;
    });
    setReactionBreakdown(prev => {
      const counts = new Map(prev.map(r => [r.emoji, r.count]));
      if (prevEmoji) counts.set(prevEmoji, (counts.get(prevEmoji) || 1) - 1);
      if (nextEmoji) counts.set(nextEmoji, (counts.get(nextEmoji) || 0) + 1);
      return Array.from(counts.entries())
        .filter(([, count]) => count > 0)
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
    });
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
    if (!commentText.trim() && !pendingGif) return;
    setSubmitting(true);
    await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText, gif_url: pendingGif }),
    });
    setCommentText('');
    setPendingGif(null);
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
      {!onImageClick && lightboxIndex !== null && (
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
          <Link href={`/profile/${encodeURIComponent(post.username)}`}>
            {post.profile_picture ? (
              <img src={post.profile_picture} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold">
                {post.first_name?.[0] || post.username[0]}
              </div>
            )}
          </Link>
          <div className="flex-1">
            <Link href={`/profile/${encodeURIComponent(post.username)}`} className="font-semibold text-sm hover:text-pink-500 transition">
              {post.first_name} {post.last_name}
            </Link>
            <p className="text-xs text-gray-400">@{post.username} · {timeAgo(post.created_at)}</p>
            {post.right_now_session_id != null && (() => {
              const secs = post.right_now_seconds_late ?? 0;
              const label = secs <= 120
                ? '⚡ on time!'
                : secs < 3600
                ? `${Math.round(secs / 60)} min late`
                : `${Math.round(secs / 3600)}h late`;
              return (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r from-pink-500 to-purple-500 text-white px-2 py-0.5 rounded-full">
                  📍 Right Now · {label}
                </span>
              );
            })()}
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
                <video key={i} src={url} poster={mediaThumbs[i] || undefined} controls preload="none" className="w-full max-h-96 object-cover bg-black" />
              ) : (
                <img
                  key={i}
                  src={mediaThumbs[i] || url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover max-h-96 cursor-zoom-in"
                  onClick={() => onImageClick ? onImageClick(url) : setLightboxIndex(imageUrls.indexOf(url))}
                />
              )
            )}
          </div>
        )}

        {/* Poll */}
        {post.poll_id && <PollBlock postId={post.id} />}

        {/* Actions */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-50">
          <div className="relative" ref={reactionsRef}>
            <button
              onClick={() => setShowReactions(v => !v)}
              className={`flex items-center gap-1.5 text-sm transition ${myReaction ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
              {reactionBreakdown.length > 0 ? (
                <span className="flex -space-x-1">
                  {reactionBreakdown.slice(0, 3).map(r => <span key={r.emoji}>{r.emoji}</span>)}
                </span>
              ) : (
                <span>🤍</span>
              )}
              <span>{likeCount}</span>
            </button>
            {showReactions && (
              <div className="absolute bottom-10 left-0 grid grid-cols-6 gap-1.5 bg-white shadow-lg border border-gray-100 rounded-2xl p-2 z-20 w-[216px]">
                {REACTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => react(e)}
                    className={`text-lg hover:scale-125 transition ${myReaction === e ? 'scale-125' : ''}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
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
                    {c.content && <span className="text-xs text-gray-600">{c.content}</span>}
                    {c.gif_url && <img src={c.gif_url} alt="" className="mt-1 rounded-lg max-h-32 max-w-full" loading="lazy" />}
                  </div>
                </div>
              ))}
            </div>
            {pendingGif && (
              <div className="relative mt-2 inline-block">
                <img src={pendingGif} alt="" className="rounded-xl max-h-24" />
                <button onClick={() => setPendingGif(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center">×</button>
              </div>
            )}
            <form onSubmit={submitComment} className="relative flex gap-2 mt-3">
              {showGifPicker && (
                <GifPicker
                  onSelect={url => { setPendingGif(url); setShowGifPicker(false); }}
                  onClose={() => setShowGifPicker(false)}
                />
              )}
              <button type="button" onClick={() => setShowGifPicker(v => !v)}
                className="text-gray-400 hover:text-pink-400 transition text-sm px-1 flex-shrink-0" title="Add GIF">
                GIF
              </button>
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
