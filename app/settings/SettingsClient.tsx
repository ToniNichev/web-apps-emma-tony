'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATAR_EMOJIS, AVATAR_COLORS, AVATAR_ACCESSORIES, colorHex } from '@/app/lib/avatar-options';

const THEMES = [
  { id: 'bloom',    label: 'Bloom',    from: '#f472b6', to: '#a855f7' },
  { id: 'ocean',    label: 'Ocean',    from: '#38bdf8', to: '#2dd4bf' },
  { id: 'sunset',   label: 'Sunset',   from: '#fb923c', to: '#f43f5e' },
  { id: 'forest',   label: 'Forest',   from: '#4ade80', to: '#2dd4bf' },
  { id: 'midnight', label: 'Midnight', from: '#818cf8', to: '#c084fc' },
];

interface Props {
  user: {
    first_name: string;
    last_name: string;
    bio: string | null;
    profile_picture: string | null;
    username: string;
    theme: string;
    dark_mode: number;
    now_playing_song: string | null;
    now_playing_artist: string | null;
    birthday: string | null;
    avatar_emoji: string | null;
    avatar_color: string | null;
    avatar_accessory: string | null;
  };
}

export default function SettingsClient({ user }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    bio: user.bio || '',
    profile_picture: user.profile_picture || '',
    now_playing_song: user.now_playing_song || '',
    now_playing_artist: user.now_playing_artist || '',
    birthday: user.birthday || '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
  const [currentTheme, setCurrentTheme] = useState(user.theme || 'bloom');
  const [isDark, setIsDark] = useState(!!user.dark_mode);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingDark, setSavingDark] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [themeMsg, setThemeMsg] = useState('');

  const [avatarEmoji, setAvatarEmoji] = useState(user.avatar_emoji);
  const [avatarColor, setAvatarColor] = useState(user.avatar_color);
  const [avatarAccessory, setAvatarAccessory] = useState(user.avatar_accessory);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');

  async function saveAvatar(next: { emoji?: string | null; color?: string | null; accessory?: string | null }) {
    const emoji = next.emoji !== undefined ? next.emoji : avatarEmoji;
    const color = next.color !== undefined ? next.color : avatarColor;
    const accessory = next.accessory !== undefined ? next.accessory : avatarAccessory;
    if (next.emoji !== undefined) setAvatarEmoji(next.emoji);
    if (next.color !== undefined) setAvatarColor(next.color);
    if (next.accessory !== undefined) setAvatarAccessory(next.accessory);

    setSavingAvatar(true);
    setAvatarMsg('');
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_emoji: emoji, avatar_color: color, avatar_accessory: accessory }),
    });
    setSavingAvatar(false);
    setAvatarMsg(res.ok ? '✓ Avatar saved!' : 'Failed to save avatar');
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setProfile(p => ({ ...p, profile_picture: data.url }));
    }
    setUploading(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setMsg(res.ok ? '✓ Profile saved!' : 'Failed to save profile');
    if (res.ok) router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) {
      setPwMsg('Passwords do not match');
      return;
    }
    setChangingPw(true);
    setPwMsg('');
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: passwords.current_password, new_password: passwords.new_password }),
    });
    const data = await res.json();
    setChangingPw(false);
    setPwMsg(res.ok ? '✓ Password changed!' : data.message || 'Failed');
    if (res.ok) setPasswords({ current_password: '', new_password: '', confirm: '' });
  }

  async function applyTheme(themeId: string) {
    setCurrentTheme(themeId);
    // Apply instantly to <html> for live preview
    const html = document.documentElement;
    THEMES.forEach(t => html.classList.remove(`theme-${t.id}`));
    if (themeId !== 'bloom') html.classList.add(`theme-${themeId}`);

    setSavingTheme(true);
    setThemeMsg('');
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: themeId }),
    });
    setSavingTheme(false);
    setThemeMsg(res.ok ? '✓ Theme saved!' : 'Failed to save theme');
  }

  async function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    const html = document.documentElement;
    next ? html.classList.add('dark') : html.classList.remove('dark');

    setSavingDark(true);
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark_mode: next }),
    });
    setSavingDark(false);
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-5">Edit Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-full brand-gradient flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {profile.profile_picture
                ? <img src={profile.profile_picture} alt="" className="w-full h-full object-cover" />
                : (profile.first_name?.[0] || user.username[0])}
            </div>
            <label className="cursor-pointer text-sm brand-text font-semibold hover:opacity-80 transition">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={profile.first_name}
                onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={profile.last_name}
                onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              rows={3}
              placeholder="Tell the world about yourself ✨"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🎵 Now playing</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={profile.now_playing_song}
                onChange={e => setProfile(p => ({ ...p, now_playing_song: e.target.value }))}
                placeholder="Song name"
                maxLength={100}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
              <input
                type="text"
                value={profile.now_playing_artist}
                onChange={e => setProfile(p => ({ ...p, now_playing_artist: e.target.value }))}
                placeholder="Artist"
                maxLength={100}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Shows as a music badge on your profile</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🎂 Birthday</label>
            <input
              type="date"
              value={profile.birthday}
              onChange={e => setProfile(p => ({ ...p, birthday: e.target.value }))}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
            />
            <p className="text-xs text-gray-400 mt-1">Your friends will see a birthday card on your special day</p>
          </div>

          {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{msg}</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      {/* Theme */}
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-1">Theme</h2>
        <p className="text-sm text-gray-400 mb-5">Pick a colour theme for your experience.</p>
        <div className="flex gap-4 flex-wrap">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => applyTheme(t.id)}
              className="flex flex-col items-center gap-2 group"
              title={t.label}
            >
              <div
                className="w-12 h-12 rounded-full transition-transform group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
                  outline: currentTheme === t.id ? `3px solid ${t.from}` : '3px solid transparent',
                  outlineOffset: '3px',
                }}
              />
              <span className={`text-xs font-medium ${currentTheme === t.id ? 'brand-text' : 'text-gray-500'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
        {themeMsg && (
          <p className={`text-sm mt-3 ${themeMsg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{themeMsg}</p>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Dark mode</p>
            <p className="text-xs text-gray-400 mt-0.5">Easier on the eyes at night</p>
          </div>
          <button
            onClick={toggleDark}
            disabled={savingDark}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none ${isDark ? 'brand-gradient' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 flex items-center justify-center text-xs ${isDark ? 'translate-x-7' : ''}`}>
              {isDark ? '🌙' : '☀️'}
            </span>
          </button>
        </div>
      </div>

      {/* Hangout Room avatar */}
      <div id="hangout-avatar" className="card p-6 scroll-mt-20">
        <h2 className="font-bold text-lg mb-1">Hangout Room Avatar</h2>
        <p className="text-sm text-gray-400 mb-5">Pick how you look when you&apos;re hanging out with friends.</p>

        <div className="flex items-center gap-4 mb-5">
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow flex-shrink-0"
            style={{ background: colorHex(avatarColor) || '#e5e7eb' }}
          >
            {avatarEmoji || '🙂'}
            {avatarAccessory && (
              <span className="absolute -top-1 -right-1 text-lg">{avatarAccessory}</span>
            )}
          </div>
          <p className="text-xs text-gray-400">Preview</p>
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2">Character</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {AVATAR_EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => saveAvatar({ emoji: e })}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition ${
                avatarEmoji === e ? 'bg-purple-100 ring-2 ring-purple-300' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2">Color</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {AVATAR_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => saveAvatar({ color: c.id })}
              title={c.id}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110"
              style={{
                background: c.hex,
                outline: avatarColor === c.id ? '3px solid #a855f7' : '3px solid transparent',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2">Accessory</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => saveAvatar({ accessory: null })}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition ${
              !avatarAccessory ? 'bg-purple-100 ring-2 ring-purple-300 text-purple-600' : 'bg-gray-50 hover:bg-gray-100 text-gray-400'
            }`}
          >
            None
          </button>
          {AVATAR_ACCESSORIES.map(a => (
            <button
              key={a}
              onClick={() => saveAvatar({ accessory: a })}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition ${
                avatarAccessory === a ? 'bg-purple-100 ring-2 ring-purple-300' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {avatarMsg && (
          <p className={`text-sm mt-4 ${avatarMsg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{avatarMsg}</p>
        )}
        {savingAvatar && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
      </div>

      {/* Password */}
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-5">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          {[
            { label: 'Current password', key: 'current_password' },
            { label: 'New password', key: 'new_password' },
            { label: 'Confirm new password', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="password"
                value={(passwords as any)[key]}
                onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />
            </div>
          ))}

          {pwMsg && <p className={`text-sm ${pwMsg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{pwMsg}</p>}

          <button
            type="submit"
            disabled={changingPw}
            className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {changingPw ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
