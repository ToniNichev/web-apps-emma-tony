'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useAppSocket } from '@/app/components/SocketProvider';
import type { Wallpaper } from '@/app/lib/wallpapers';
import { WALLPAPERS } from '@/app/lib/wallpapers';

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



function swatchStyle(w: Wallpaper): React.CSSProperties {
  if (w.id === 'none') return { backgroundColor: '#e5e7eb' };
  if (!w.style.backgroundSize) return w.style;
  const parts = (w.style.backgroundSize as string).split(' ');
  const ow = parseFloat(parts[0]);
  const oh = parseFloat(parts[1] ?? parts[0]);
  const s = 22 / Math.max(ow, oh);
  return { ...w.style, backgroundSize: `${Math.round(ow * s)}px ${Math.round(oh * s)}px` };
}
function WallpaperPicker({ current, onSelect, onClose, anchorRect }: {
  current: string;
  onSelect: (w: Wallpaper) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const showAbove = spaceBelow < 280;
  const style: React.CSSProperties = {
    position: 'fixed',
    right: window.innerWidth - anchorRect.right,
    zIndex: 9999,
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-64">
      <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Wallpaper</p>
      <div className="grid grid-cols-6 gap-1.5">
        {WALLPAPERS.map(w => (
          <button
            key={w.id}
            title={w.label}
            onClick={() => { onSelect(w); onClose(); }}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${current === w.id ? 'border-pink-500 scale-110' : 'border-transparent'}`}
            style={swatchStyle(w)}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Emoji picker ──────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: '😊', emoji: ['😀','😂','🥹','😊','😍','🥰','😘','😎','🤩','😏','😅','🤣','😇','🥳','😋','🤗','😌','🥺','😢','😭','😤','😠','🤯','😱','🤔','🫡','😴','🤤','😶','🫠'] },
  { label: '❤️', emoji: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','💟','❣️','💔','🫀','♥️'] },
  { label: '👍', emoji: ['👍','👎','👏','🙌','🤝','✊','👊','🫶','🤟','🤙','👋','✌️','🤞','👌','🤌','💅','🙏','💪','🫂','☝️'] },
  { label: '🐱', emoji: ['🐱','🐶','🦊','🐼','🐨','🐸','🦁','🐯','🦋','🌸','🌺','🌻','🌹','🌈','⭐','🌟','✨','💫','🔥','🌙'] },
  { label: '🍕', emoji: ['🍕','🍔','🍟','🌮','🍩','🍪','🎂','🍦','🍭','🧁','🍫','🍓','🍉','🍇','🍑','🥑','🧋','☕','🍵','🥤'] },
  { label: '🎉', emoji: ['🎉','🎊','🎈','🎁','🏆','🥇','🎯','🎮','🎵','🎶','🎸','🎤','📸','🎬','💡','🚀','⚡','💥','💯','❗'] },
];

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  const [group, setGroup] = useState(0);
  return (
    <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 w-64 z-50 overflow-hidden">
      <div className="flex border-b border-gray-100">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={i} onClick={() => setGroup(i)}
            className={`flex-1 py-1.5 text-sm transition ${group === i ? 'bg-pink-50' : 'hover:bg-gray-50'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-36 overflow-y-auto">
        {EMOJI_GROUPS[group].emoji.map(e => (
          <button key={e} onClick={() => onSelect(e)}
            className="text-lg p-0.5 rounded hover:bg-pink-50 transition leading-none">{e}</button>
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, pic, size = 8 }: { name: string; pic?: string | null; size?: number }) {
  return pic
    ? <img src={pic} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full brand-gradient flex items-center justify-center text-white font-bold flex-shrink-0 text-xs`}>{name[0]}</div>;
}

export default function ChatPanel({ currentUser }: {
  currentUser: { id: number; username: string; first_name: string; profile_picture?: string | null };
}) {
  const pathname = usePathname();
  const socket = useAppSocket();
  const [open, setOpen] = useState(false);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeConvo, setActiveConvo] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [wallpaper, setWallpaper] = useState<Wallpaper>(WALLPAPERS[0]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const wallpaperBtnRef = useRef<HTMLButtonElement>(null);

  async function loadConvos() {
    const res = await fetch('/api/messages/conversations');
    if (!res.ok) return;
    const data: Convo[] = await res.json();
    setConvos(data);
    setTotalUnread(data.reduce((sum, c) => sum + (c.unread_count || 0), 0));
    setLoaded(true);
  }

  useEffect(() => {
    loadConvos();
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage(msg: Message) {
      setMessages(ms => {
        if (activeConvo && msg.conversation_id === activeConvo.id) return [...ms, msg];
        return ms;
      });
      setConvos(cs => cs.map(c =>
        c.id === msg.conversation_id ? { ...c, last_message: msg.content } : c
      ));
      if (!activeConvo || msg.conversation_id !== activeConvo?.id) {
        setTotalUnread(n => n + 1);
      }
    }
    socket.on('new_message', onNewMessage);
    return () => { socket.off('new_message', onNewMessage); };
  }, [socket, activeConvo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    }
    if (showEmoji) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showEmoji]);

  // Hide on the messages page — all hooks above have already been called
  if (pathname === '/messages') return null;

  function loadWallpaper(convoId: number) {
    const saved = localStorage.getItem(`wallpaper-${convoId}`);
    const found = saved ? WALLPAPERS.find(w => w.id === saved) : null;
    setWallpaper(found ?? WALLPAPERS[0]);
  }

  function applyWallpaper(w: Wallpaper) {
    setWallpaper(w);
    if (activeConvo) localStorage.setItem(`wallpaper-${activeConvo.id}`, w.id);
  }

  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    if (!input) { setText(t => t + emoji); return; }
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function openConvo(convo: Convo) {
    setActiveConvo(convo);
    setShowEmoji(false);
    loadWallpaper(convo.id);
    const res = await fetch(`/api/messages?conversation_id=${convo.id}`);
    setMessages(await res.json());
    setConvos(cs => cs.map(c => c.id === convo.id ? { ...c, unread_count: 0 } : c));
    setTotalUnread(n => Math.max(0, n - (convo.unread_count || 0)));
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConvo) return;
    const content = text.trim();
    setText('');
    setShowEmoji(false);

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: activeConvo.id, content }),
    });

    socket?.emit('send_message', {
      to_user_id: activeConvo.other_user_id,
      conversation_id: activeConvo.id,
      content,
    });

    setMessages(ms => [...ms, {
      id: Date.now(),
      conversation_id: activeConvo.id,
      sender_id: currentUser.id,
      content,
      created_at: new Date().toISOString(),
      first_name: currentUser.first_name,
      username: currentUser.username,
    }]);
  }

  const panelWidth = activeConvo ? 'w-80' : 'w-72';
  const isDark = wallpaper.dark;

  return (
    <div className="hidden md:block fixed bottom-4 right-4 z-50">
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="brand-gradient text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:opacity-90 transition relative"
        >
          💬
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={`${panelWidth} bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden`}
          style={{ height: '480px' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            {activeConvo ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveConvo(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none mr-1">‹</button>
                <Avatar name={activeConvo.other_first_name} pic={activeConvo.other_profile_picture} size={7} />
                <span className="font-semibold text-sm">{activeConvo.other_first_name}</span>
              </div>
            ) : (
              <span className="font-bold text-gray-800 text-sm">Messages</span>
            )}
            <div className="flex items-center gap-1">
              {activeConvo && (
                <>
                  <button
                    ref={wallpaperBtnRef}
                    onClick={() => {
                      const rect = wallpaperBtnRef.current?.getBoundingClientRect();
                      setPickerAnchor(pickerAnchor ? null : (rect ?? null));
                    }}
                    title="Change wallpaper"
                    className={`text-sm p-1 rounded-full transition ${pickerAnchor ? 'bg-pink-100' : 'hover:bg-gray-100'}`}
                  >
                    🎨
                  </button>
                  {pickerAnchor && (
                    <WallpaperPicker
                      current={wallpaper.id}
                      onSelect={applyWallpaper}
                      onClose={() => setPickerAnchor(null)}
                      anchorRect={pickerAnchor}
                    />
                  )}
                </>
              )}
              <button onClick={() => { setOpen(false); setActiveConvo(null); }} className="text-gray-300 hover:text-gray-500 text-xl leading-none">✕</button>
            </div>
          </div>

          {/* Content */}
          {!activeConvo ? (
            <div className="flex-1 overflow-y-auto">
              {!loaded && <p className="text-gray-400 text-xs text-center p-4">Loading…</p>}
              {loaded && convos.length === 0 && (
                <p className="text-gray-400 text-xs text-center p-6">No conversations yet.</p>
              )}
              {convos.map(c => (
                <button key={c.id} onClick={() => openConvo(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-pink-50 transition text-left border-b border-gray-50 last:border-0">
                  <Avatar name={c.other_first_name} pic={c.other_profile_picture} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs">{c.other_first_name} {c.other_last_name}</p>
                    {c.last_message && <p className="text-xs text-gray-400 truncate">{c.last_message}</p>}
                  </div>
                  {c.unread_count > 0 && (
                    <span className="brand-gradient text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {c.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 transition-all" style={wallpaper.style}>
                {messages.map((m, i) => {
                  const isMe = m.sender_id === currentUser.id;
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[220px] px-3 py-1.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isMe
                          ? 'brand-gradient text-white rounded-br-sm'
                          : isDark
                            ? 'bg-white/90 text-gray-800 rounded-bl-sm'
                            : 'bg-white text-gray-800 rounded-bl-sm'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-1.5 p-2.5 border-t border-gray-100 items-center relative flex-shrink-0">
                <div ref={emojiRef} className="relative">
                  <button type="button" onClick={() => setShowEmoji(v => !v)}
                    className={`text-base p-1 rounded-full transition ${showEmoji ? 'bg-pink-100 text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
                    😊
                  </button>
                  {showEmoji && <EmojiPicker onSelect={insertEmoji} />}
                </div>
                <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
                  placeholder="Message…"
                  className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-300 transition" />
                <button type="submit" disabled={!text.trim()}
                  className="brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition disabled:opacity-40">
                  ↑
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
