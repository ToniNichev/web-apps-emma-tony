'use client';
import { useState, useEffect, useRef } from 'react';
import { BACKGROUNDS, getBg } from '@/app/lib/backgrounds';

const THEMES = [
  { id: 'bloom',    label: 'Bloom',    from: '#f472b6', to: '#a855f7' },
  { id: 'ocean',    label: 'Ocean',    from: '#38bdf8', to: '#2dd4bf' },
  { id: 'sunset',   label: 'Sunset',   from: '#fb923c', to: '#f43f5e' },
  { id: 'forest',   label: 'Forest',   from: '#4ade80', to: '#2dd4bf' },
  { id: 'midnight', label: 'Midnight', from: '#818cf8', to: '#c084fc' },
];

type Tab = 'site' | 'luna' | 'banner' | 'users' | 'invites' | 'recap' | 'challenge' | 'kindness' | 'hangout' | 'trivia';

type Invite = {
  id: number;
  code: string;
  created_at: string;
  used_at: string | null;
  created_by_username: string;
  used_by_username: string | null;
};

export default function AdminClient({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [tab, setTab] = useState<Tab>('site');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [recapUser, setRecapUser] = useState('');
  const [recapPeriod, setRecapPeriod] = useState('week');
  const [recap, setRecap] = useState<any | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [challengePrompt, setChallengePrompt] = useState("");
  const [challengeEmoji, setChallengeEmoji] = useState("🌟");
  const [challengeDate, setChallengeDate] = useState(new Date().toISOString().slice(0, 10));
  const [challengeSaving, setChallengeSaving] = useState(false);
  const [challengeSaved, setChallengeSaved] = useState(false);
  const [challengeSuggestions, setChallengeSuggestions] = useState<any[]>([]);
  const [kindnessReports, setKindnessReports] = useState<any[]>([]);
  const [hangoutReports, setHangoutReports] = useState<any[]>([]);
  const [triviaHealth, setTriviaHealth] = useState<any[]>([]);
  const [triviaPending, setTriviaPending] = useState<any[]>([]);
  const [triviaGenerating, setTriviaGenerating] = useState<string | null>(null);
  const [triviaError, setTriviaError] = useState('');
  const bannerFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(setSettings);
    fetch('/api/admin/users').then(r => r.json()).then(u => {
      setUsers(u);
      const first = u.find((x: any) => x.is_admin < 2);
      if (first) setRecapUser(String(first.id));
    });
  }, []);

  useEffect(() => {
    if (tab === 'invites') {
      fetch('/api/admin/invites').then(r => r.json()).then(setInvites);
    }
    if (tab === 'kindness') {
      fetch('/api/admin/kindness').then(r => r.json()).then(setKindnessReports);
    }
    if (tab === 'hangout') {
      fetch('/api/admin/hangout-backgrounds').then(r => r.json()).then(setHangoutReports);
    }
    if (tab === 'trivia') {
      loadTrivia();
    }
    if (tab === 'challenge') {
      loadChallengeSuggestions();
    }
  }, [tab]);

  async function loadChallengeSuggestions() {
    const data = await fetch('/api/admin/challenge-suggestions').then(r => r.json());
    setChallengeSuggestions(data);
  }

  function useSuggestion(s: any) {
    setChallengePrompt(s.prompt);
    setChallengeEmoji(s.emoji);
    fetch(`/api/admin/challenge-suggestions/${s.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    setChallengeSuggestions(cs => cs.filter(c => c.id !== s.id));
  }

  function dismissSuggestion(id: number) {
    fetch(`/api/admin/challenge-suggestions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    setChallengeSuggestions(cs => cs.filter(c => c.id !== id));
  }

  async function loadTrivia() {
    const data = await fetch('/api/admin/trivia').then(r => r.json());
    setTriviaHealth(data.health);
    setTriviaPending(data.pending);
  }

  async function generateTrivia(category: string) {
    setTriviaGenerating(category);
    setTriviaError('');
    const res = await fetch('/api/admin/trivia/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const data = await res.json();
    setTriviaGenerating(null);
    if (res.ok) {
      loadTrivia();
    } else {
      setTriviaError(data.message || 'Something went wrong');
    }
  }

  async function reviewTrivia(id: number, approve: boolean) {
    await fetch('/api/admin/trivia/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approve }),
    });
    setTriviaPending(qs => qs.filter(q => q.id !== id));
    loadTrivia();
  }

  async function resolveKindnessReport(id: number, restore: boolean) {
    await fetch('/api/admin/kindness', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restore }),
    });
    setKindnessReports(rs => rs.filter(r => r.id !== id));
  }

  async function resolveHangoutReport(roomId: number, restore: boolean) {
    await fetch('/api/admin/hangout-backgrounds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, restore }),
    });
    setHangoutReports(rs => rs.filter(r => r.room_id !== roomId));
  }

  async function generateInvite() {
    setInviteGenerating(true);
    const res = await fetch('/api/admin/invites', { method: 'POST' });
    if (res.ok) {
      const { code } = await res.json();
      setInvites(prev => [{ id: Date.now(), code, created_at: new Date().toISOString(), used_at: null, created_by_username: 'you', used_by_username: null }, ...prev]);
    }
    setInviteGenerating(false);
  }

  async function deleteInvite(id: number) {
    await fetch('/api/admin/invites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setInvites(prev => prev.filter(i => i.id !== id));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function loadRecap() {
    if (!recapUser) return;
    setRecapLoading(true);
    setRecap(null);
    const res = await fetch(`/api/admin/recap?userId=${recapUser}&period=${recapPeriod}`);
    setRecap(await res.json());
    setRecapLoading(false);
  }

  function timeAgo(dateStr: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function save(patch: Record<string, string>) {
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function uploadBannerImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      set('banner_image', data.url);
    }
    setUploading(false);
  }

  async function toggleAdmin(userId: number, current: number) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_admin: current ? 0 : 1 }),
    });
    setUsers(us => us.map(u => u.id === userId ? { ...u, is_admin: current ? 0 : 1 } : u));
  }

  async function toggleFamily(userId: number, current: number) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family: current ? 0 : 1 }),
    });
    setUsers(us => us.map(u => u.id === userId ? { ...u, family: current ? 0 : 1 } : u));
  }

  async function deleteUser(userId: number) {
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setUsers(us => us.filter(u => u.id !== userId));
    setConfirmDelete(null);
  }

  const bannerBg = settings.banner_bg || 'none';
  const bgOpt = getBg(bannerBg);

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'site',    label: 'Site',    emoji: '🎨' },
    { id: 'luna',    label: 'Luna',    emoji: '🌙' },
    { id: 'banner',  label: 'Banner',  emoji: '📢' },
    { id: 'users',   label: 'Users',   emoji: '👥' },
    { id: 'invites', label: 'Invites', emoji: '🔑' },
    { id: 'recap',   label: 'Recap',   emoji: '📊' },
    { id: 'challenge', label: 'Challenge', emoji: '🎯' },
    { id: 'kindness', label: 'Kindness', emoji: '💛' },
    { id: 'hangout', label: 'Hangout', emoji: '🏡' },
    { id: 'trivia', label: 'Trivia', emoji: '🧠' },
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Admin Panel</h1>
        <p className="text-sm text-gray-400">Customize Emma's Space</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex flex-col items-center gap-0.5 min-w-[52px] ${tab === t.id ? 'bg-white shadow brand-text' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="text-base">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Site tab ── */}
      {tab === 'site' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div>
              <p className="font-semibold text-amber-800 text-sm">🚧 Temporarily disable site</p>
              <p className="text-xs text-amber-600 mt-0.5">Visitors see a &quot;back soon&quot; page. Admins still have full access.</p>
            </div>
            <button
              onClick={() => save({ maintenance_mode: settings.maintenance_mode === '1' ? '0' : '1' })}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.maintenance_mode === '1' ? 'bg-amber-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.maintenance_mode === '1' ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Site name</label>
            <input
              value={settings.site_name || ''}
              onChange={e => set('site_name', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tagline</label>
            <input
              value={settings.site_tagline || ''}
              onChange={e => set('site_tagline', e.target.value)}
              placeholder="A short description shown on the feed"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Default theme for new users</label>
            <div className="flex gap-4 flex-wrap">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('default_theme', t.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-md transition-transform hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                      outline: settings.default_theme === t.id ? '3px solid var(--brand-color)' : '3px solid transparent',
                      outlineOffset: '2px',
                      opacity: settings.default_theme === t.id ? 1 : 0.55,
                    }}
                  />
                  <span className="text-xs text-gray-600 font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => save({ site_name: settings.site_name || '', site_tagline: settings.site_tagline || '', default_theme: settings.default_theme || 'bloom' })}
            disabled={saving}
            className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {/* ── Banner tab ── */}
      {tab === 'banner' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-700 text-sm">Show banner on the feed</p>
              <p className="text-xs text-gray-400 mt-0.5">Visible to everyone at the top of the page</p>
            </div>
            <button
              onClick={() => set('banner_enabled', settings.banner_enabled === '1' ? '0' : '1')}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.banner_enabled === '1' ? 'brand-gradient' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.banner_enabled === '1' ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
            <textarea
              value={settings.banner_text || ''}
              onChange={e => set('banner_text', e.target.value)}
              placeholder="Write a welcome message or announcement…"
              rows={3}
              maxLength={300}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Background</label>
            <div className="flex gap-2 flex-wrap">
              {BACKGROUNDS.map(bg => (
                <button key={bg.id} type="button" onClick={() => set('banner_bg', bg.id)} title={bg.label}>
                  <div
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${bg.id === 'hearts' || bg.id === 'daisies' ? `post-bg-${bg.id}` : ''}`}
                    style={{
                      ...(bg.id !== 'hearts' && bg.id !== 'daisies' ? { background: bg.preview } : { backgroundSize: '18px 18px' }),
                      borderColor: bannerBg === bg.id ? 'var(--brand-color)' : 'transparent',
                      outline: bannerBg === bg.id ? '2px solid var(--brand-color)' : 'none',
                      outlineOffset: '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Banner image <span className="font-normal text-gray-400">(optional)</span></label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => bannerFileRef.current?.click()}
                disabled={uploading}
                className="text-sm text-gray-500 hover:text-pink-500 transition border border-gray-200 rounded-xl px-4 py-2 hover:border-pink-300"
              >
                {uploading ? '⏳ Uploading…' : '📷 Choose image'}
              </button>
              {settings.banner_image && (
                <div className="flex items-center gap-2">
                  <img src={settings.banner_image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <button onClick={() => set('banner_image', '')} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              )}
            </div>
            <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBannerImage(e.target.files[0])} />
          </div>

          {(settings.banner_text || settings.banner_image) && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview</p>
              <div className={`${bannerBg !== 'none' ? `post-bg-${bannerBg}` : 'bg-gradient-to-r from-pink-50 to-purple-50'} rounded-2xl overflow-hidden`}>
                {settings.banner_image && (
                  <img src={settings.banner_image} alt="" className="w-full max-h-40 object-cover" />
                )}
                {settings.banner_text && (
                  <p className="px-6 py-4 font-semibold text-center text-sm"
                    style={{ color: bgOpt.darkText ? '#1f2937' : 'white', textShadow: bgOpt.darkText ? 'none' : '0 1px 3px rgba(0,0,0,0.25)' }}>
                    {settings.banner_text}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => save({ banner_enabled: settings.banner_enabled || '0', banner_text: settings.banner_text || '', banner_bg: settings.banner_bg || 'none', banner_image: settings.banner_image || '' })}
            disabled={saving}
            className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save banner'}
          </button>
        </div>
      )}

      {/* ── Luna tab ── */}
      {tab === 'luna' && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Luna&apos;s name</label>
            <input
              value={settings.luna_name || ''}
              onChange={e => set('luna_name', e.target.value)}
              placeholder="Luna"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Personality</label>
            <textarea
              value={settings.luna_persona || ''}
              onChange={e => set('luna_persona', e.target.value)}
              placeholder="You love talking about art, animals, music, creative stories, fun facts, jokes, and games like 20 questions or would-you-rather. Be encouraging, upbeat, and use emojis naturally but not excessively."
              rows={5}
              maxLength={600}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
            <p className="text-xs text-gray-400 mt-1">This describes how Luna talks and what she&apos;s interested in. Safety rules (no inappropriate content, short replies) always apply no matter what&apos;s written here.</p>
          </div>
          <button
            onClick={() => save({ luna_name: settings.luna_name || '', luna_persona: settings.luna_persona || '' })}
            disabled={saving}
            className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          {users.map((u, i) => (
            <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i < users.length - 1 ? 'border-b border-gray-50' : ''}`}>
              {u.profile_picture ? (
                <img src={u.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {u.first_name?.[0] || u.username[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm">{u.first_name} {u.last_name}</p>
                  {u.is_admin >= 2 ? <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold">Super admin</span> : u.is_admin === 1 ? <span className="text-xs brand-gradient text-white px-2 py-0.5 rounded-full font-semibold">Admin</span> : null}
                  {u.family
                    ? <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">🏡 Family</span>
                    : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Friend</span>
                  }
                </div>
                <p className="text-xs text-gray-400">@{u.username}{isSuperAdmin && u.email ? ` · ${u.email}` : ''}</p>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => toggleFamily(u.id, u.family)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition flex-shrink-0 ${u.family ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500'}`}
                >
                  {u.family ? 'Mark as friend' : 'Mark as family'}
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => toggleAdmin(u.id, u.is_admin)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition flex-shrink-0 ${u.is_admin ? 'border-pink-200 text-pink-500 hover:bg-pink-50' : 'border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500'}`}
                >
                  {u.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
              )}
              {isSuperAdmin && (
                confirmDelete === u.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => deleteUser(u.id)} className="text-xs text-red-500 font-semibold px-2 py-1 rounded hover:bg-red-50">Delete</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 px-2 py-1 rounded hover:bg-gray-50">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(u.id)} className="text-gray-300 hover:text-red-400 transition text-lg flex-shrink-0" title="Delete user">🗑</button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Invites tab ── */}
      {tab === 'invites' && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-gray-700">Invite codes</p>
              <p className="text-xs text-gray-400 mt-0.5">Each code can only be used once to create an account.</p>
            </div>
            <button
              onClick={generateInvite}
              disabled={inviteGenerating}
              className="brand-gradient text-white font-semibold px-4 py-2 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60 flex-shrink-0"
            >
              {inviteGenerating ? 'Generating…' : '+ New code'}
            </button>
          </div>

          <div className="card overflow-hidden">
            {invites.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No invite codes yet. Generate one above.</p>
            )}
            {invites.map((inv, i) => (
              <div key={inv.id} className={`flex items-center gap-3 px-4 py-3 ${i < invites.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className={`font-mono text-sm font-semibold ${inv.used_at ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                    {inv.code}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {inv.used_at
                      ? `Used by @${inv.used_by_username} · ${timeAgo(inv.used_at)}`
                      : `Created ${timeAgo(inv.created_at)}`}
                  </p>
                </div>
                {!inv.used_at && (
                  <>
                    <button
                      onClick={() => copyCode(inv.code)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition flex-shrink-0"
                    >
                      {copiedCode === inv.code ? '✓ Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => deleteInvite(inv.id)}
                      className="text-gray-300 hover:text-red-400 transition text-lg flex-shrink-0"
                      title="Delete invite"
                    >
                      🗑
                    </button>
                  </>
                )}
                {inv.used_at && (
                  <span className="text-xs text-gray-300 flex-shrink-0">Used</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recap tab ── */}
      {tab === 'recap' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-gray-500 mb-1">User</label>
              <select
                value={recapUser}
                onChange={e => setRecapUser(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)]"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Period</label>
              <select
                value={recapPeriod}
                onChange={e => setRecapPeriod(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)]"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>
            <button
              onClick={loadRecap}
              disabled={recapLoading}
              className="brand-gradient text-white font-semibold px-5 py-2 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {recapLoading ? 'Loading…' : 'Show recap'}
            </button>
          </div>

          {recap && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Posts',         value: recap.posts.length,   emoji: '📝' },
                  { label: 'Stories',       value: recap.stories.length, emoji: '📸' },
                  { label: 'Comments made', value: recap.commentsMade,   emoji: '🗨️' },
                ].map(s => (
                  <div key={s.label} className="card p-4 text-center">
                    <p className="text-2xl mb-1">{s.emoji}</p>
                    <p className="text-2xl font-bold brand-text">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {recap.posts.length > 0 && (
                <div className="card overflow-hidden">
                  <p className="px-4 pt-4 pb-2 font-semibold text-sm text-gray-600">Posts ({recap.posts.length})</p>
                  {recap.posts.map((p: any, i: number) => {
                    const mediaUrls = p.media_urls?.split('||').filter(Boolean) || [];
                    const mediaTypes = p.media_types?.split('||').filter(Boolean) || [];
                    return (
                      <div key={p.id} className={`px-4 py-3 ${i < recap.posts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          {mediaUrls.length > 0 && (
                            mediaTypes[0] === 'video'
                              ? <video src={mediaUrls[0]} className="w-16 h-16 rounded-xl object-cover bg-black flex-shrink-0" />
                              : <img src={mediaUrls[0]} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            {p.content && <p className="text-sm text-gray-700 line-clamp-2">{p.content}</p>}
                            {!p.content && mediaUrls.length > 0 && <p className="text-sm text-gray-400 italic">Photo/video post</p>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span>❤️ {p.like_count}</span>
                              <span>💬 {p.comment_count}</span>
                              <span>{timeAgo(p.created_at)}</span>
                              {mediaUrls.length > 1 && <span>+{mediaUrls.length - 1} more</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {recap.stories.length > 0 && (
                <div className="card overflow-hidden">
                  <p className="px-4 pt-4 pb-3 font-semibold text-sm text-gray-600">Stories ({recap.stories.length})</p>
                  <div className="flex gap-3 px-4 pb-4 overflow-x-auto">
                    {recap.stories.map((s: any) => (
                      <div key={s.id} className="flex-shrink-0 w-24">
                        {s.media_type === 'video'
                          ? <video src={s.media_url} className="w-24 h-36 rounded-xl object-cover bg-black" />
                          : <img src={s.media_url} alt="" className="w-24 h-36 rounded-xl object-cover" />
                        }
                        <p className="text-xs text-gray-400 mt-1 text-center">{timeAgo(s.created_at)}</p>
                        <p className="text-xs text-gray-400 text-center">👁 {s.view_count}</p>
                        {s.caption && <p className="text-xs text-gray-500 mt-0.5 text-center truncate">{s.caption}</p>}
                        {s.expires_at === null && <p className="text-xs brand-text text-center">♾️ Forever</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recap.posts.length === 0 && recap.stories.length === 0 && (
                <div className="card p-10 text-center text-gray-400 text-sm">
                  Nothing posted in this period 🌸
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* ── Challenge tab ── */}
      {tab === 'challenge' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <div>
              <p className="font-semibold text-gray-700 text-sm mb-1">Suggestions ({challengeSuggestions.length})</p>
              <p className="text-xs text-gray-400">Ideas submitted by users. "Use this" fills in the form below — you still need to hit Set challenge.</p>
            </div>
            {challengeSuggestions.length === 0 ? (
              <p className="text-sm text-gray-400">No pending suggestions.</p>
            ) : (
              <div className="space-y-2">
                {challengeSuggestions.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                    <span className="text-xl flex-shrink-0">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{s.prompt}</p>
                      <p className="text-xs text-gray-400">from {s.first_name} (@{s.username})</p>
                    </div>
                    <button
                      onClick={() => useSuggestion(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full brand-gradient text-white hover:opacity-90 transition flex-shrink-0"
                    >
                      Use this
                    </button>
                    <button
                      onClick={() => dismissSuggestion(s.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition flex-shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <div>
              <p className="font-semibold text-gray-700 text-sm mb-1">Daily Challenge</p>
              <p className="text-xs text-gray-400">Set a fun challenge for today — it shows at the top of everyone's feed.</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Emoji</label>
                <input
                  value={challengeEmoji}
                  onChange={e => setChallengeEmoji(e.target.value)}
                  maxLength={2}
                  className="w-16 border border-gray-200 rounded-xl px-3 py-2.5 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Prompt</label>
                <input
                  value={challengePrompt}
                  onChange={e => setChallengePrompt(e.target.value)}
                  placeholder="Post a photo of something that made you smile today!"
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={challengeDate}
                onChange={e => setChallengeDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
            </div>

            {challengePrompt && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Preview</p>
                <div className="brand-gradient rounded-2xl px-5 py-4 flex items-center gap-3">
                  <span className="text-4xl">{challengeEmoji}</span>
                  <div>
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Daily Challenge</p>
                    <p className="text-white font-bold text-base leading-snug mt-0.5">{challengePrompt}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                if (!challengePrompt.trim()) return;
                setChallengeSaving(true);
                await fetch('/api/challenge', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: challengePrompt, emoji: challengeEmoji, active_date: challengeDate }),
                });
                setChallengeSaving(false);
                setChallengeSaved(true);
                setTimeout(() => setChallengeSaved(false), 2500);
              }}
              disabled={challengeSaving || !challengePrompt.trim()}
              className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {challengeSaved ? '✓ Challenge set!' : challengeSaving ? 'Saving…' : 'Set challenge'}
            </button>
          </div>
        </div>
      )}
      {/* ── Kindness tab ── */}
      {tab === 'kindness' && (
        <div className="space-y-4">
          <div className="card p-6">
            <p className="font-semibold text-gray-700 text-sm mb-1">Reported Kindness Notes</p>
            <p className="text-xs text-gray-400 mb-4">Notes a recipient flagged. Sender is shown here for moderation only — never to other users.</p>

            {kindnessReports.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No open reports 🎉</p>
            ) : (
              <div className="space-y-3">
                {kindnessReports.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                    <p className="text-sm text-gray-700">💛 {r.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      From @{r.sender_username} ({r.sender_first_name}) to @{r.recipient_username} ({r.recipient_first_name})
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => resolveKindnessReport(r.id, true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        Restore note
                      </button>
                      <button
                        onClick={() => resolveKindnessReport(r.id, false)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Hangout tab ── */}
      {tab === 'hangout' && (
        <div className="space-y-4">
          <div className="card p-6">
            <p className="font-semibold text-gray-700 text-sm mb-1">Reported Hangout Backgrounds</p>
            <p className="text-xs text-gray-400 mb-4">AI-generated backgrounds a room member flagged. Reverted to the default for everyone until you resolve it here.</p>

            {hangoutReports.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No open reports 🎉</p>
            ) : (
              <div className="space-y-3">
                {hangoutReports.map((r: any) => (
                  <div key={r.room_id} className="border border-gray-100 rounded-xl p-4">
                    {r.background_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.background_url} alt="" className="w-full max-h-48 object-cover rounded-lg mb-2" />
                    )}
                    <p className="text-xs text-gray-400">
                      Room hosted by @{r.host_username} ({r.host_first_name})
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => resolveHangoutReport(r.room_id, true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        Restore background
                      </button>
                      <button
                        onClick={() => resolveHangoutReport(r.room_id, false)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                      >
                        Remove background
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Trivia tab ── */}
      {tab === 'trivia' && (
        <div className="space-y-4">
          <div className="card p-6">
            <p className="font-semibold text-gray-700 text-sm mb-1">Question bank health</p>
            <p className="text-xs text-gray-400 mb-4">
              A category is flagged stale once every approved question in it has been asked 4+ times.
              &quot;Generate more&quot; asks the AI for a fresh batch — they land in the review queue below, not live, until you approve them.
            </p>
            {triviaError && <p className="text-xs text-red-500 mb-3">{triviaError}</p>}
            <div className="space-y-2">
              {triviaHealth.map((h: any) => (
                <div key={h.category} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      {h.category}
                      {h.stale && <span className="ml-2 text-xs font-bold text-amber-600">Stale</span>}
                      {h.thin && <span className="ml-2 text-xs font-bold text-red-500">Low pool</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {h.approved_count} approved · avg asked {h.avg_times_asked.toFixed(1)}x · min {h.min_times_asked}x
                      {h.pending_review > 0 && ` · ${h.pending_review} pending review`}
                    </p>
                  </div>
                  <button
                    onClick={() => generateTrivia(h.category)}
                    disabled={triviaGenerating === h.category}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition disabled:opacity-50 flex-shrink-0"
                  >
                    {triviaGenerating === h.category ? 'Generating…' : 'Generate more'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="font-semibold text-gray-700 text-sm mb-1">Pending review ({triviaPending.length})</p>
            <p className="text-xs text-gray-400 mb-4">AI-generated questions — check the facts before approving.</p>
            {triviaPending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nothing waiting on review 🎉</p>
            ) : (
              <div className="space-y-3">
                {triviaPending.map((q: any) => (
                  <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-purple-500 mb-1">{q.category}</p>
                    <p className="text-sm text-gray-700 font-medium">{q.question}</p>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {(['a', 'b', 'c', 'd'] as const).map(opt => (
                        <p key={opt} className={`text-xs px-2 py-1 rounded-lg ${q.correct_option === opt ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-50 text-gray-500'}`}>
                          {q[`option_${opt}`]}
                        </p>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => reviewTrivia(q.id, true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewTrivia(q.id, false)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
