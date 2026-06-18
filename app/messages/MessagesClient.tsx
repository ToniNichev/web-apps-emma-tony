'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAppSocket } from '@/app/components/SocketProvider';
import type { Wallpaper } from '@/app/lib/wallpapers';
import { WALLPAPERS } from '@/app/lib/wallpapers';
import Lightbox from '@/app/components/Lightbox';

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

interface AIMessage { role: 'user' | 'assistant'; content: string; image?: string; pending?: 'text' | 'image'; progress?: number; }

// ── Luna special conversation ─────────────────────────────
const LUNA_ID = -1;
const LUNA_CONVO: Convo = {
  id: LUNA_ID, other_user_id: LUNA_ID, other_username: 'luna',
  other_first_name: 'Luna', other_last_name: '✨',
  other_profile_picture: null,
  last_message: 'Hi! I\'m your magical AI friend 🌙',
  unread_count: 0,
};
const isLuna = (c: Convo | null) => c?.id === LUNA_ID;

function LunaAvatar({ size = 10 }: { size?: number }) {
  const px = size * 4;
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ background: 'linear-gradient(135deg,#7c3aed,#1e1b4b)', fontSize: px > 32 ? 18 : 14 }}
    >
      🌙
    </div>
  );
}

// ── Painting indicator (shown while an image is generating) ──
const PAINTING_PHRASES = [
  '🎨 Mixing colors…', '🖌️ Sketching it out…', '✨ Adding sparkles…',
  '🌈 Almost there…', '💫 Final touches…',
];

function PaintingIndicator({ progress }: { progress?: number }) {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhrase(p => (p + 1) % PAINTING_PHRASES.length), 4000);
    return () => clearInterval(id);
  }, []);
  const pct = progress != null ? Math.round(progress * 100) : null;
  return (
    <div className="luna-painting w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 text-white px-6">
      <span className="luna-sparkle text-4xl">🪄</span>
      <span className="text-xs font-semibold drop-shadow text-center">{PAINTING_PHRASES[phrase]}</span>
      {pct !== null && (
        <div className="w-full max-w-[140px]">
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-center mt-1 opacity-90 font-semibold">{pct}%</p>
        </div>
      )}
    </div>
  );
}

// ── Wallpaper picker ──────────────────────────────────────
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
  current: string; onSelect: (w: Wallpaper) => void; onClose: () => void; anchorRect: DOMRect;
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
    position: 'fixed', right: window.innerWidth - anchorRect.right, zIndex: 9999,
    ...(showAbove ? { bottom: window.innerHeight - anchorRect.top + 4 } : { top: anchorRect.bottom + 4 }),
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-72">
      <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Chat wallpaper</p>
      <div className="grid grid-cols-6 gap-1.5">
        {WALLPAPERS.map(w => (
          <button key={w.id} title={w.label} onClick={() => { onSelect(w); onClose(); }}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${current === w.id ? 'border-pink-500 scale-110' : 'border-transparent'}`}
            style={swatchStyle(w)} />
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Share-to-feed modal ────────────────────────────────────
function ShareModal({ imageUrl, onClose, onPosted }: {
  imageUrl: string; onClose: () => void; onPosted: () => void;
}) {
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  async function submit() {
    setPosting(true);
    const content = caption.trim() ? `${caption.trim()}\n\n🎨 Drawn by Luna` : '🎨 Drawn by Luna';
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, media: [{ url: imageUrl, type: 'image' }], background: null }),
    });
    setPosting(false);
    if (res.ok) onPosted();
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <img src={imageUrl} alt="" className="w-full aspect-square object-cover" />
        <div className="p-4 space-y-3">
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Say something about it… (optional)"
            rows={3}
            maxLength={300}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold text-gray-500 hover:bg-gray-100 transition">
              Cancel
            </button>
            <button onClick={submit} disabled={posting}
              className="brand-gradient text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-60">
              {posting ? 'Posting…' : 'Post it! ✨'}
            </button>
          </div>
        </div>
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
    <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 w-72 z-50 overflow-hidden">
      <div className="flex border-b border-gray-100">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={i} onClick={() => setGroup(i)}
            className={`flex-1 py-2 text-base transition ${group === i ? 'bg-pink-50' : 'hover:bg-gray-50'}`}>{g.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-44 overflow-y-auto">
        {EMOJI_GROUPS[group].emoji.map(e => (
          <button key={e} onClick={() => onSelect(e)}
            className="text-xl p-1 rounded-lg hover:bg-pink-50 transition leading-none">{e}</button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function MessagesClient({
  conversations, currentUser, lunaName = 'Luna'
}: {
  conversations: Convo[];
  currentUser: { id: number; username: string; first_name: string; profile_picture?: string | null };
  lunaName?: string;
}) {
  const socket = useAppSocket();
  const [convos, setConvos] = useState(conversations);
  const [activeConvo, setActiveConvo] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [lunaMessages, setLunaMessages] = useState<AIMessage[]>([]);
  const [lunaStreaming, setLunaStreaming] = useState(false);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [wallpaper, setWallpaper] = useState<Wallpaper>(WALLPAPERS[0]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const wallpaperBtnRef = useRef<HTMLButtonElement>(null);

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
  }, [messages, lunaMessages]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

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
    if (isLuna(convo)) {
      const savedWp = localStorage.getItem(`wallpaper-${LUNA_ID}`);
      const found = savedWp
        ? WALLPAPERS.find(w => w.id === savedWp)
        : WALLPAPERS.find(w => w.id === 'midnight');
      setWallpaper(found ?? WALLPAPERS[0]);
      const res = await fetch('/api/ai/messages');
      if (res.ok) setLunaMessages(await res.json());
      return;
    }
    loadWallpaper(convo.id);
    const res = await fetch(`/api/messages?conversation_id=${convo.id}`);
    setMessages(await res.json());
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConvo || isLuna(activeConvo)) return;
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
      id: Date.now(), conversation_id: activeConvo.id, sender_id: currentUser.id,
      content, created_at: new Date().toISOString(),
      first_name: currentUser.first_name, username: currentUser.username,
    }]);
  }

  async function sendLunaMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || lunaStreaming) return;
    const content = text.trim();
    setText('');
    setShowEmoji(false);
    const userMsg: AIMessage = { role: 'user', content };
    setLunaMessages(ms => [...ms, userMsg, { role: 'assistant', content: '', pending: 'text' }]);
    setLunaStreaming(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok || !res.body) { setLunaStreaming(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              accumulated += json.message.content;
              setLunaMessages(ms => [...ms.slice(0, -1), { role: 'assistant', content: accumulated }]);
            }
          } catch {}
        }
      }
    } catch {}
    setLunaStreaming(false);
  }

  async function sendLunaImage() {
    if (!text.trim() || lunaStreaming) return;
    const prompt = text.trim();
    setText('');
    setShowEmoji(false);
    setLunaMessages(ms => [
      ...ms,
      { role: 'user', content: `🎨 Draw: ${prompt}` },
      { role: 'assistant', content: '', pending: 'image' },
    ]);
    setLunaStreaming(true);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setLunaMessages(ms => [
          ...ms.slice(0, -1),
          { role: 'assistant', content: data.error || "I couldn't paint that one, try again? 🌙" },
        ]);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let data: { progress?: number; url?: string; error?: string };
            try { data = JSON.parse(line); } catch { continue; }
            if (typeof data.progress === 'number') {
              setLunaMessages(ms => [...ms.slice(0, -1), { role: 'assistant', content: '', pending: 'image', progress: data.progress }]);
            } else if (data.url) {
              setLunaMessages(ms => [...ms.slice(0, -1), { role: 'assistant', content: '', image: data.url }]);
            } else if (data.error) {
              setLunaMessages(ms => [...ms.slice(0, -1), { role: 'assistant', content: data.error || "I couldn't paint that one, try again? 🌙" }]);
            }
          }
        }
      }
    } catch {
      setLunaMessages(ms => [
        ...ms.slice(0, -1),
        { role: 'assistant', content: "I couldn't paint that one, try again? 🌙" },
      ]);
    }
    setLunaStreaming(false);
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

  const isDark = wallpaper.dark;
  const inLuna = isLuna(activeConvo);
  const lunaImageGallery = lunaMessages.filter(m => m.image).map(m => m.image as string);

  return (
    <div className="card overflow-hidden messages-panel flex">
      {/* Sidebar */}
      <div className={`${activeConvo ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r border-gray-100 flex-col flex-shrink-0`}>
        <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Messages</div>
        <div className="overflow-y-auto flex-1">
          {/* Luna entry */}
          <button onClick={() => openConvo(LUNA_CONVO)}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 transition text-left border-b border-purple-100 ${inLuna ? 'bg-purple-50' : ''}`}>
            <LunaAvatar />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-purple-800">{lunaName} ✨ <span className="text-xs font-normal text-purple-400">AI friend</span></p>
              <p className="text-xs text-purple-300 truncate">Ask me anything 🌙</p>
            </div>
          </button>
          {/* Regular conversations */}
          {convos.length === 0 && (
            <p className="text-gray-400 text-sm text-center p-6">No conversations yet.<br/>Go to a profile and start chatting!</p>
          )}
          {convos.map(c => (
            <button key={c.id} onClick={() => openConvo(c)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-pink-50 transition text-left ${activeConvo?.id === c.id ? 'bg-pink-50' : ''}`}>
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
      <div className={`${!activeConvo ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center"><p className="text-4xl mb-2">💬</p><p className="text-sm">Select a conversation</p></div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveConvo(null)} className="md:hidden text-gray-400 hover:text-gray-600 transition mr-1 text-xl leading-none">‹</button>
                {inLuna ? <LunaAvatar size={8} /> : <Avatar name={activeConvo.other_first_name} pic={activeConvo.other_profile_picture} size={8} />}
                {inLuna
                  ? <span className="font-semibold text-sm text-purple-800">{lunaName} ✨</span>
                  : <Link href={`/profile/${activeConvo.other_username}`} className="font-semibold text-sm hover:text-pink-500">{activeConvo.other_first_name}</Link>
                }
              </div>
              <div className="flex items-center gap-2">
                <button
                  ref={wallpaperBtnRef}
                  onClick={() => {
                    const rect = wallpaperBtnRef.current?.getBoundingClientRect();
                    setPickerAnchor(pickerAnchor ? null : (rect ?? null));
                  }}
                  title="Change wallpaper"
                  className={`text-lg p-1.5 rounded-full transition ${pickerAnchor ? 'bg-pink-100' : 'hover:bg-gray-100'}`}
                >🎨</button>
                {pickerAnchor && (
                  <WallpaperPicker current={wallpaper.id} onSelect={applyWallpaper}
                    onClose={() => setPickerAnchor(null)} anchorRect={pickerAnchor} />
                )}
                {!inLuna && (
                  <button onClick={startVideoCall} className="brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition">
                    📹 Video call
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 transition-all" style={wallpaper.style}>
              {inLuna ? (
                lunaMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="text-5xl">🌙</div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-purple-700'}`}>Hi! I&apos;m {lunaName} ✨</p>
                    <p className={`text-xs max-w-xs ${isDark ? 'text-white/60' : 'text-purple-400'}`}>I'm your magical AI friend. Ask me anything — jokes, stories, fun facts, games… 🎉</p>
                  </div>
                ) : (
                  lunaMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mt-1`}>
                      {m.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-1.5 self-end text-xs"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#1e1b4b)' }}>🌙</div>
                      )}
                      <div className={`max-w-xs rounded-2xl text-sm leading-relaxed shadow-sm ${(m.image || m.pending === 'image') ? 'p-1.5 w-64' : 'px-4 py-2'} ${
                        m.role === 'user'
                          ? 'brand-gradient text-white rounded-br-sm'
                          : isDark
                            ? 'bg-white/90 text-gray-800 rounded-bl-sm'
                            : 'bg-purple-100 text-purple-900 rounded-bl-sm'
                      }`}>
                        {m.image
                          ? (
                            <div className="relative group">
                              <img src={m.image} alt="" className="rounded-xl w-full" />
                              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                                <a href={m.image} download
                                  title="Download"
                                  className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-xs backdrop-blur-sm transition">
                                  ⬇️
                                </a>
                                <button type="button" onClick={() => setLightboxIndex(lunaImageGallery.indexOf(m.image!))}
                                  title="View fullscreen"
                                  className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-xs backdrop-blur-sm transition">
                                  ⛶
                                </button>
                                <button type="button" onClick={() => setShareImage(m.image!)}
                                  title="Share as a post"
                                  className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-xs backdrop-blur-sm transition">
                                  📤
                                </button>
                              </div>
                            </div>
                          )
                          : m.pending === 'image'
                            ? <PaintingIndicator progress={m.progress} />
                            : m.content || <span className="animate-pulse opacity-60">✨ thinking…</span>}
                      </div>
                    </div>
                  ))
                )
              ) : (
                messages.map((m, i) => {
                  const isMe = m.sender_id === currentUser.id;
                  const prevSame = i > 0 && messages[i - 1].sender_id === m.sender_id;
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${prevSame ? 'mt-0.5' : 'mt-2'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMe ? 'brand-gradient text-white rounded-br-sm'
                          : isDark ? 'bg-white/90 text-gray-800 rounded-bl-sm'
                          : 'bg-white text-gray-800 rounded-bl-sm'
                      }`}>{m.content}</div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={inLuna ? sendLunaMessage : sendMessage}
              className="flex gap-2 p-3 border-t border-gray-100 items-center relative flex-shrink-0">
              <div ref={emojiRef} className="relative">
                <button type="button" onClick={() => setShowEmoji(v => !v)}
                  className={`text-xl p-1.5 rounded-full transition ${showEmoji ? 'bg-pink-100 text-pink-500' : 'text-gray-400 hover:text-pink-400 hover:bg-pink-50'}`}>
                  😊
                </button>
                {showEmoji && <EmojiPicker onSelect={insertEmoji} />}
              </div>
              <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
                placeholder={inLuna ? `Ask ${lunaName} anything, or describe a picture… 🌙` : 'Message…'}
                className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition" />
              {inLuna && (
                <button type="button" onClick={sendLunaImage} disabled={!text.trim() || lunaStreaming}
                  title={`Ask ${lunaName} to draw this`}
                  className="flex-shrink-0 text-lg p-1.5 rounded-full transition-all duration-150 disabled:opacity-40 bg-pink-100 hover:bg-pink-200 hover:scale-110 hover:shadow-md active:scale-95">
                  🎨
                </button>
              )}
              <button type="submit" disabled={!text.trim() || (inLuna && lunaStreaming)}
                className={`flex-shrink-0 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-150 disabled:opacity-40 disabled:hover:scale-100 hover:opacity-90 hover:scale-105 hover:shadow-md active:scale-95 ${inLuna ? 'bg-purple-600' : 'brand-gradient'}`}>
                {inLuna && lunaStreaming ? '✨' : 'Send'}
              </button>
            </form>
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          urls={lunaImageGallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex(i => Math.min(lunaImageGallery.length - 1, (i ?? 0) + 1))}
        />
      )}
      {shareImage && (
        <ShareModal
          imageUrl={shareImage}
          onClose={() => setShareImage(null)}
          onPosted={() => { setShareImage(null); setPosted(true); setTimeout(() => setPosted(false), 2500); }}
        />
      )}
      {posted && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] brand-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg">
          Posted to your feed! ✨
        </div>
      )}
    </div>
  );
}
