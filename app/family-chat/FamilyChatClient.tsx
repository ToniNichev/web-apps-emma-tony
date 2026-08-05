'use client';
import { useState, useEffect, useRef } from 'react';
import { useAppSocket } from '@/app/components/SocketProvider';

interface Message {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
  username: string;
  first_name: string;
  profile_picture: string | null;
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

export default function FamilyChatClient({ initialMessages, currentUserId }: {
  initialMessages: Message[];
  currentUserId: number;
}) {
  const socket = useAppSocket();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!socket) return;
    function onNew(msg: Message) {
      setMessages(ms => ms.some(m => m.id === msg.id) ? ms : [...ms, msg]);
    }
    socket.on('family_chat:new_message', onNew);
    return () => { socket.off('family_chat:new_message', onNew); };
  }, [socket]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setText('');
    const res = await fetch('/api/family-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSending(false);
    if (res.ok) {
      const msg = await res.json();
      setMessages(ms => ms.some(m => m.id === msg.id) ? ms : [...ms, msg]);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message || 'Something went wrong');
      setText(content);
    }
  }

  return (
    <div className="card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="p-4 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <span className="text-xl">🏡</span>
        <p className="font-bold text-gray-800">Family Chat</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet — say hi! 👋</p>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {m.profile_picture
                ? <img src={m.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{m.first_name[0]}</div>
              }
              <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <p className="text-xs text-gray-400 mb-0.5 px-1">{m.first_name}</p>}
                <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'brand-gradient text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 px-1">{timeAgo(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}
      <form onSubmit={send} className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message the family…"
          maxLength={1000}
          className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="brand-gradient text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
