'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Story {
  id: number;
  user_id: number;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  view_count: number;
  viewed: boolean;
}

interface UserStories {
  user_id: number;
  username: string;
  first_name: string;
  profile_picture: string | null;
  stories: Story[];
}

const STORY_DURATION = 5000; // ms for images

export default function StoryViewer({
  groups,
  startGroupIndex,
  currentUserId,
  onClose,
  onViewed,
}: {
  groups: UserStories[];
  startGroupIndex: number;
  currentUserId: number;
  onClose: () => void;
  onViewed: (storyId: number) => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const goNext = useCallback(() => {
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(i => i + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(g => g + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, group, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(g => g - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [storyIndex, groupIndex]);

  // Mark as viewed
  useEffect(() => {
    if (!story) return;
    fetch(`/api/stories/${story.id}/view`, { method: 'POST' });
    onViewed(story.id);
  }, [story?.id]);

  // Progress timer for images
  useEffect(() => {
    if (!story || story.media_type === 'video') return;

    clearInterval(intervalRef.current);
    setProgress(0);

    const step = 100 / (STORY_DURATION / 50);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(intervalRef.current); goNext(); return 100; }
        return p + step;
      });
    }, 50);

    return () => clearInterval(intervalRef.current);
  }, [story?.id]);

  // Video: advance when ended
  function onVideoEnded() { goNext(); }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    return h < 1 ? 'just now' : `${h}h ago`;
  }

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 bg-black z-[300] flex items-center justify-center" onClick={e => e.stopPropagation()}>
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{
                width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
            {group.profile_picture
              ? <img src={group.profile_picture} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-tr from-pink-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">{group.first_name[0]}</div>
            }
          </div>
          <span className="text-white font-semibold text-sm">{group.first_name}</span>
          <span className="text-white/60 text-xs">{timeAgo(story.created_at)}</span>
          {group.user_id === currentUserId && (
            <span className="text-white/60 text-xs">· {story.view_count} views</span>
          )}
        </div>
        <button onClick={onClose} className="text-white text-2xl leading-none">×</button>
      </div>

      {/* Media */}
      <div className="w-full h-full flex items-center justify-center">
        {story.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={story.media_url}
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            onEnded={onVideoEnded}
          />
        ) : (
          <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/* Caption */}
      {story.caption && (
        <div className="absolute bottom-8 left-0 right-0 px-6 z-10 pointer-events-none">
          <p className="text-white text-center text-sm font-medium leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            {story.caption}
          </p>
        </div>
      )}

      {/* Tap zones */}
      <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={goPrev} aria-label="Previous" />
      <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={goNext} aria-label="Next" />

      {/* Next user indicator */}
      {groupIndex < groups.length - 1 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="text-white/50 text-2xl">›</div>
        </div>
      )}
    </div>
  );
}
