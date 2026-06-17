'use client';
import { useState } from 'react';
import StoryViewer from './StoryViewer';

interface Story {
  id: number;
  user_id: number;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string | null;
  view_count: number;
  viewed: boolean;
}

interface UserStories {
  user_id: number;
  username: string;
  first_name: string;
  profile_picture: string | null;
  stories: Story[];
  has_unseen: boolean;
}

export default function StoriesBar({
  initialStories,
  currentUserId,
}: {
  initialStories: UserStories[];
  currentUserId: number;
}) {
  const others = initialStories.filter(g => g.user_id !== currentUserId);
  const [storyGroups, setStoryGroups] = useState<UserStories[]>(others);
  const [viewing, setViewing] = useState<{ groups: UserStories[]; startIndex: number } | null>(null);

  if (storyGroups.length === 0) return null;

  function onStoryViewed(storyId: number) {
    setStoryGroups(gs => gs.map(g => ({
      ...g,
      stories: g.stories.map(s => s.id === storyId ? { ...s, viewed: true } : s),
      has_unseen: g.stories.some(s => s.id !== storyId && !s.viewed),
    })));
  }

  return (
    <>
      <div className="card p-4 mb-4 overflow-x-auto">
        <div className="flex gap-4 min-w-0">
          {storyGroups.map((group, i) => (
            <div key={group.user_id} className="flex flex-col items-center gap-1 flex-shrink-0">
              <button onClick={() => setViewing({ groups: storyGroups, startIndex: i })}>
                <div className={`w-16 h-16 rounded-full p-0.5 ${group.has_unseen ? 'brand-ring' : 'bg-gray-200'}`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-0.5">
                    {group.profile_picture ? (
                      <img src={group.profile_picture} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full brand-gradient rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {group.first_name[0]}
                      </div>
                    )}
                  </div>
                </div>
              </button>
              <span className="text-xs text-gray-500 truncate w-16 text-center">{group.first_name}</span>
            </div>
          ))}
        </div>
      </div>

      {viewing && (
        <StoryViewer
          groups={viewing.groups}
          startGroupIndex={viewing.startIndex}
          currentUserId={currentUserId}
          onClose={() => setViewing(null)}
          onViewed={onStoryViewed}
        />
      )}
    </>
  );
}
