'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppSocket } from '@/app/components/SocketProvider';

interface Convo {
  id: number;
  other_user_id: number;
  other_username: string;
  other_first_name: string;
  other_last_name: string;
  other_profile_picture: string | null;
  last_message: string | null;
  unread_count: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  first_name: string;
  username: string;
}

export default function MessagesClient({
  conversations, currentUser
}: {
  conversations: Convo[];
  currentUser: { id: number; username: string; first_name: string; profile_picture?: string | null };
}) {
  const socket = useAppSocket();
  const [convos, setConvos] = useState(conversations);
  const [activeConvo, setActiveConvo] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    function onNewMessage(msg: Message) {
      setMessages(ms => [...ms, msg]);
      setConvos(cs => cs.map(c =>
        c.id === msg.conversation_id ? { ...c, last_message: msg.content } : c
      ));
    }

    socket.on('new_message', onNewMessage);
    return () => { socket.off('new_message', onNewMessage); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConvo(convo: Convo) {
    setActiveConvo(convo);
    const res = await fetch(`/api/messages?conversation_id=${convo.id}`);
    setMessages(await res.json());
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConvo) return;

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: activeConvo.id, content: text }),
    });

    socket?.emit('send_message', {
      to_user_id: activeConvo.other_user_id,
      conversation_id: activeConvo.id,
      content: text,
    });

    setMessages(ms => [...ms, {
      id: Date.now(),
      conversation_id: activeConvo.id,
      sender_id: currentUser.id,
      content: text,
      created_at: new Date().toISOString(),
      first_name: currentUser.first_name,
      username: currentUser.username,
    }]);
    setText('');
  }

  function startVideoCall() {
    if (!activeConvo) return;
    window.open(`/video/${activeConvo.other_username}`, '_blank', 'width=900,height=700');
  }

  function Avatar({ name, pic, size = 10 }: { name: string; pic?: string | null; size?: number }) {
    return pic
      ? <img src={pic} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />
      : <div className={`w-${size} h-${size} rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0 text-sm`}>{name[0]}</div>;
  }

  return (
    <div className="card overflow-hidden" style={{ height: '70vh', display: 'flex' }}>
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Messages</div>
        <div className="overflow-y-auto flex-1">
          {convos.length === 0 && (
            <p className="text-gray-400 text-sm text-center p-6">No conversations yet.<br/>Go to a profile and start chatting!</p>
          )}
          {convos.map(c => (
            <button
              key={c.id}
              onClick={() => openConvo(c)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-pink-50 transition text-left ${activeConvo?.id === c.id ? 'bg-pink-50' : ''}`}
            >
              <Avatar name={c.other_first_name} pic={c.other_profile_picture} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{c.other_first_name} {c.other_last_name}</p>
                {c.last_message && <p className="text-xs text-gray-400 truncate">{c.last_message}</p>}
              </div>
              {c.unread_count > 0 && (
                <span className="brand-gradient text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{c.unread_count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Avatar name={activeConvo.other_first_name} pic={activeConvo.other_profile_picture} size={8} />
                <div>
                  <Link href={`/profile/${activeConvo.other_username}`} className="font-semibold text-sm hover:text-pink-500">{activeConvo.other_first_name}</Link>
                </div>
              </div>
              <button onClick={startVideoCall} className="brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition" title="Video call">
                📹 Video call
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => {
                const isMe = m.sender_id === currentUser.id;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe ? 'brand-gradient text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-gray-100">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Message…"
                className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
              />
              <button type="submit" className="brand-gradient text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
