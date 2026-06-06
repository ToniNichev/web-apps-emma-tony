'use client';
import { useRouter } from 'next/navigation';

export default function MessageButton({ otherUserId }: { otherUserId: number }) {
  const router = useRouter();

  async function startChat() {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: otherUserId }),
    });
    if (res.ok) router.push('/messages');
  }

  return (
    <button
      onClick={startChat}
      className="text-sm font-semibold px-5 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition mr-2"
    >
      Message
    </button>
  );
}
