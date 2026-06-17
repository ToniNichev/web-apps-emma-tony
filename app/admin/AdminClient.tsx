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

type Tab = 'site' | 'banner' | 'users' | 'recap';

export default function AdminClient({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [tab, setTab] = useState<Tab>('site');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [recapUser, setRecapUser] = useState('');
  const [recapPeriod, setRecapPeriod] = useState('week');
  const [recap, setRecap] = useState<any | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(setSettings);
    fetch('/api/admin/users').then(r => r.json()).then(u => {
      setUsers(u);
      // default recap to first non-super-admin user (Emma)
      const first = u.find((x: any) => x.is_admin < 2);
      if (first) setRecapUser(String(first.id));
    });
  }, []);

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

  async function deleteUser(userId: number) {
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setUsers(us => us.filter(u => u.id !== userId));
    setConfirmDelete(null);
  }

  const bannerBg = settings.banner_bg || 'none';
  const bgOpt = getBg(bannerBg);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Admin Panel</h1>
        <p className="text-sm text-gray-400">Customize Emma's Space</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {(['site', 'banner', 'users', 'recap'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition flex flex-col items-center gap-0.5 ${tab === t ? 'bg-white shadow brand-text' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="text-base">{t === 'site' ? '🎨' : t === 'banner' ? '📢' : t === 'users' ? '👥' : '📊'}</span>
            <span>{t === 'site' ? 'Site' : t === 'banner' ? 'Banner' : t === 'users' ? 'Users' : 'Recap'}</span>
          </button>
        ))}
      </div>

      {/* ── Customize tab ── */}
      {tab === 'site' && (
        <div className="card p-6 space-y-5">
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

          {/* Preview */}
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
                </div>
                <p className="text-xs text-gray-400">@{u.username}</p>
              </div>
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

      {/* ── Messages tab ── */}
      {/* ── Recap tab ── */}
      {tab === 'recap' && (
        <div className="space-y-4">
          {/* Controls */}
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
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Posts',          value: recap.posts.length,    emoji: '📝' },
                  { label: 'Stories',        value: recap.stories.length,  emoji: '📸' },

                  { label: 'Comments made',  value: recap.commentsMade,    emoji: '🗨️' },
                ].map(s => (
                  <div key={s.label} className="card p-4 text-center">
                    <p className="text-2xl mb-1">{s.emoji}</p>
                    <p className="text-2xl font-bold brand-text">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Posts */}
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
                            {p.content && (
                              <p className="text-sm text-gray-700 line-clamp-2">{p.content}</p>
                            )}
                            {!p.content && mediaUrls.length > 0 && (
                              <p className="text-sm text-gray-400 italic">Photo/video post</p>
                            )}
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

              {/* Stories */}
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

    </>
  );
}
