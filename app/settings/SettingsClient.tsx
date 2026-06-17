'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  };
}

export default function SettingsClient({ user }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    bio: user.bio || '',
    profile_picture: user.profile_picture || '',
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
