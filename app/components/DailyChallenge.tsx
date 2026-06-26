'use client';
import { useState, useRef } from 'react';

interface Response {
  id: number;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  username: string;
  first_name: string;
  profile_picture: string | null;
}

interface Challenge {
  id: number;
  prompt: string;
  emoji: string;
  active_date: string;
  response_count: number;
  my_response_id: number | null;
  responses: Response[];
}

export default function DailyChallenge({ initial }: { initial: Challenge | null }) {
  const [challenge, setChallenge] = useState<Challenge | null>(initial);
  const [showResponses, setShowResponses] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!challenge) return null;

  const alreadyResponded = !!challenge.my_response_id;

  async function uploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setMediaUrl(data.url);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    }
    setUploading(false);
  }

  async function submit() {
    if (!text.trim() && !mediaUrl) return;
    setSubmitting(true);
    const res = await fetch('/api/challenge/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challenge!.id, content: text, media_url: mediaUrl, media_type: mediaType }),
    });
    if (res.ok) {
      const fresh = await fetch('/api/challenge').then(r => r.json());
      setChallenge(fresh);
      setShowModal(false);
      setShowResponses(true);
      setText('');
      setMediaUrl(null);
      setMediaType(null);
    }
    setSubmitting(false);
  }

  return (
    <>
      <div className="card mb-4 overflow-hidden">
        {/* Header */}
        <div className="brand-gradient px-5 py-4 flex items-center gap-3">
          <span className="text-4xl">{challenge.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Daily Challenge</p>
            <p className="text-white font-bold text-base leading-snug mt-0.5">{challenge.prompt}</p>
          </div>
        </div>

        {/* Footer row */}
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowResponses(v => !v)}
            className="text-sm text-gray-400 hover:text-pink-500 transition"
          >
            {challenge.response_count === 0
              ? 'No responses yet'
              : `${challenge.response_count} response${challenge.response_count === 1 ? '' : 's'} ${showResponses ? '▲' : '▼'}`}
          </button>

          {alreadyResponded ? (
            <span className="text-sm font-semibold text-green-500">✓ You responded!</span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition"
            >
              Take the challenge!
            </button>
          )}
        </div>

        {/* Responses */}
        {showResponses && challenge.responses.length > 0 && (
          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {challenge.responses.map(r => (
              <div key={r.id} className="px-5 py-3 flex gap-3">
                <div className="flex-shrink-0">
                  {r.profile_picture ? (
                    <img src={r.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">
                      {r.first_name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{r.first_name}
                    <span className="text-gray-400 font-normal ml-1">@{r.username}</span>
                  </p>
                  {r.content && <p className="text-sm text-gray-700 mt-0.5">{r.content}</p>}
                  {r.media_url && (
                    r.media_type === 'video'
                      ? <video src={r.media_url} controls className="mt-2 rounded-xl max-h-64 w-full object-cover bg-black" />
                      : <img src={r.media_url} alt="" className="mt-2 rounded-xl max-h-64 w-full object-cover" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Response modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="brand-gradient px-5 py-4 flex items-center gap-3">
              <span className="text-2xl">{challenge.emoji}</span>
              <div>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Your response</p>
                <p className="text-white font-bold text-sm leading-snug">{challenge.prompt}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write your response… ✨"
                rows={3}
                maxLength={500}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
              />

              {mediaUrl && (
                <div className="relative">
                  {mediaType === 'video'
                    ? <video src={mediaUrl} controls className="w-full rounded-xl max-h-48 object-cover bg-black" />
                    : <img src={mediaUrl} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                  }
                  <button onClick={() => { setMediaUrl(null); setMediaType(null); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 text-sm hover:bg-black/70 transition">✕</button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-sm text-gray-400 hover:text-pink-500 transition flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 hover:border-pink-300"
                >
                  {uploading ? '⏳ Uploading…' : '📷 Add photo/video'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />

                <button
                  onClick={submit}
                  disabled={submitting || (!text.trim() && !mediaUrl)}
                  className="ml-auto brand-gradient text-white font-semibold px-5 py-2 rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? 'Posting…' : 'Post response'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
