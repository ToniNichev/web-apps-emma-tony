'use client';
import { useState, useEffect } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';

interface Passkey {
  id: number;
  nickname: string | null;
  device_type: string;
  backed_up: number;
  created_at: string;
  last_used_at: string | null;
}

export default function PasskeySettings() {
  const [supported, setSupported] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    fetch('/api/auth/passkey').then(r => r.json()).then(data => {
      setPasskeys(data);
      setLoading(false);
    });
  }, []);

  async function addPasskey() {
    setMsg('');
    setAdding(true);
    try {
      const optionsRes = await fetch('/api/auth/passkey/register-options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error();
      const options = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const nickname = window.prompt('Name this passkey (e.g. "My iPhone")', '') || undefined;
      const verifyRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attestation, nickname }),
      });
      if (verifyRes.ok) {
        const list = await fetch('/api/auth/passkey').then(r => r.json());
        setPasskeys(list);
        setMsg('✓ Passkey added!');
      } else {
        const data = await verifyRes.json().catch(() => ({}));
        setMsg(data.message || 'Something went wrong');
      }
    } catch {
      // User cancelled the browser's passkey prompt.
    }
    setAdding(false);
  }

  async function removePasskey(id: number) {
    if (!confirm('Remove this passkey? You\'ll need another way to sign in on that device.')) return;
    await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
    setPasskeys(pks => pks.filter(p => p.id !== id));
  }

  if (!supported) return null;

  return (
    <div className="card p-6">
      <h2 className="font-bold text-lg mb-1">Passkeys</h2>
      <p className="text-sm text-gray-400 mb-5">Sign in with Face ID, Touch ID, or your device PIN instead of a password.</p>

      {!loading && passkeys.length > 0 && (
        <div className="space-y-2 mb-5">
          {passkeys.map(pk => (
            <div key={pk.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-700 truncate">{pk.nickname || 'Unnamed passkey'}</p>
                <p className="text-xs text-gray-400">
                  Added {new Date(pk.created_at).toLocaleDateString()}
                  {pk.last_used_at ? ` · last used ${new Date(pk.last_used_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => removePasskey(pk.id)}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 transition flex-shrink-0 ml-3"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p className={`text-sm mb-3 ${msg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{msg}</p>}

      <button
        onClick={addPasskey}
        disabled={adding}
        className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
      >
        {adding ? 'Waiting…' : '+ Add a passkey'}
      </button>
    </div>
  );
}
