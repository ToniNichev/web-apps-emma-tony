'use client';
import { useState } from 'react';

export default function FollowButton({ userId, initialFollowing }: { userId: number; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: userId }),
    });
    const data = await res.json();
    setFollowing(data.following);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-sm font-semibold px-5 py-2 rounded-full transition ${
        following
          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          : 'brand-gradient text-white hover:opacity-90'
      } disabled:opacity-60`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
