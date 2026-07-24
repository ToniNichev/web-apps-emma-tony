'use client';
import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BACKGROUNDS, getBg } from '@/app/lib/backgrounds';

type Mode = 'post' | 'poll' | 'story';

export default function CreatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('tab') === 'story' ? 'story' : 'post');
  const rightNowId = params.get('rightNow');

  // Post state
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video'; thumbnail_url?: string | null }[]>([]);
  const [selectedBg, setSelectedBg] = useState('none');

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Poll image state
  const [pollMedia, setPollMedia] = useState<{ url: string; type: 'image' }[]>([]);
  const [pollImgLoading, setPollImgLoading] = useState(false);
  const [pollImgProgress, setPollImgProgress] = useState(0);
  const [pollImgError, setPollImgError] = useState('');

  // Story state
  const [storyFile, setStoryFile] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [permanent, setPermanent] = useState<boolean | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const postFileRef = useRef<HTMLInputElement>(null);
  const storyFileRef = useRef<HTMLInputElement>(null);

  async function handlePostFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setMedia(m => [...m, { url: data.url, type: data.type, thumbnail_url: data.thumbnail_url ?? null }]);
      }
    }
    setUploading(false);
  }

  async function handleStoryFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStoryFile(null);
    setPermanent(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setStoryFile({ url: data.url, type: data.type });
    }
    setUploading(false);
  }

  async function handleSubmitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && media.length === 0) {
      setError('Add some text or media to post');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, media, background: selectedBg, right_now_session_id: rightNowId ? Number(rightNowId) : undefined }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Failed to post');
      setSubmitting(false);
    }
  }

  async function generatePollImage() {
    if (!pollQuestion.trim()) { setPollImgError('Write a question first!'); return; }
    setPollImgLoading(true);
    setPollImgProgress(0);
    setPollImgError('');
    setPollMedia([]);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pollQuestion }),
      });
      if (!res.ok || !res.body) { setPollImgError('Image generator unavailable'); setPollImgLoading(false); return; }
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
          try {
            const chunk = JSON.parse(line);
            if (chunk.progress !== undefined) setPollImgProgress(Math.round(chunk.progress * 100));
            if (chunk.url) { setPollMedia([{ url: chunk.url, type: 'image' }]); setPollImgLoading(false); }
            if (chunk.error) { setPollImgError(chunk.error); setPollImgLoading(false); }
          } catch {}
        }
      }
    } catch { setPollImgError('Something went wrong'); setPollImgLoading(false); }
  }

  async function handleSubmitPoll(e: React.FormEvent) {
    e.preventDefault();
    const options = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim()) {
      setError('Add a question for your poll');
      return;
    }
    if (options.length < 2) {
      setError('Add at least 2 options');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: pollQuestion, poll: { options }, media: pollMedia }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Failed to create poll');
      setSubmitting(false);
    }
  }

  async function handleSubmitStory() {
    if (!storyFile || permanent === null) return;
    setSubmitting(true);
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_url: storyFile.url, media_type: storyFile.type, caption: storyCaption.trim() || null, permanent }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Failed to share story');
      setSubmitting(false);
    }
  }

  const bgOpt = getBg(selectedBg);
  const hasBg = selectedBg !== 'none' && media.length === 0;

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-gray-400 hover:text-gray-600 transition text-sm">← Back</a>
          <h1 className="font-bold text-gray-800">{mode === 'post' ? 'New Post' : mode === 'poll' ? 'New Poll' : 'New Story'}</h1>
          <div className="w-10" />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => { setMode('post'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'post' ? 'bg-white shadow text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Post
          </button>
          <button
            onClick={() => { setMode('poll'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'poll' ? 'bg-white shadow text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Poll
          </button>
          <button
            onClick={() => { setMode('story'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'story' ? 'bg-white shadow text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Story
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mb-4">
          {mode === 'post'
            ? 'A post stays on your profile for everyone to see and comment on.'
            : mode === 'poll'
            ? 'Ask a question and let people vote — like "Which outfit is cuter? 👗"'
            : 'A story is a photo or video shown at the top of the feed — can disappear after 24 hours or stay forever.'}
        </p>

        {mode === 'post' ? (
          <form onSubmit={handleSubmitPost}>
            {rightNowId && (
              <div className="mb-3 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-5 py-3 flex items-center gap-3 text-white">
                <span className="text-2xl animate-bounce">📍</span>
                <div>
                  <p className="font-black text-sm">RIGHT NOW!</p>
                  <p className="text-xs opacity-80">Share what you're doing this exact moment ⚡</p>
                </div>
              </div>
            )}
            <div className="card overflow-hidden">
              {/* Text area — fills the card edge-to-edge when a background is selected */}
              {hasBg ? (
                <div className={`post-bg-${selectedBg} min-h-56 flex items-center justify-center px-8 py-10`}>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="What's on your mind? ✨"
                    rows={4}
                    className="bg-transparent border-none outline-none text-center text-xl font-semibold w-full resize-none"
                    style={{
                      color: bgOpt.darkText ? '#1f2937' : 'white',
                      textShadow: bgOpt.darkText ? 'none' : '0 1px 3px rgba(0,0,0,0.25)',
                    }}
                  />
                </div>
              ) : (
                <div className="p-6 pb-0">
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="What's on your mind? ✨"
                    rows={5}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
                  />
                </div>
              )}

              {/* Media previews */}
              {media.length > 0 && (
                <div className={`grid gap-0.5 mt-3 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {media.map((m, i) => (
                    <div key={i} className="relative group">
                      {m.type === 'video' ? (
                        <video src={m.url} poster={m.thumbnail_url || undefined} controls className="w-full rounded-xl object-cover max-h-60 bg-black" />
                      ) : (
                        <img src={m.url} alt="" className="w-full rounded-xl object-cover max-h-60" />
                      )}
                      <button
                        type="button"
                        onClick={() => setMedia(ms => ms.filter((_, j) => j !== i))}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom section: background picker + actions */}
              <div className="px-4 pt-3 pb-4 space-y-3">
                {/* Background picker — only when no media */}
                {media.length === 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {BACKGROUNDS.map(bg => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setSelectedBg(bg.id)}
                        title={bg.label}
                        className="flex-shrink-0"
                      >
                        <div
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${bg.id === 'hearts' || bg.id === 'daisies' ? `post-bg-${bg.id}` : ''}`}
                          style={{
                            ...(bg.id !== 'hearts' && bg.id !== 'daisies' ? { background: bg.preview } : { backgroundSize: '18px 18px' }),
                            borderColor: selectedBg === bg.id ? 'var(--brand-color)' : 'transparent',
                            outline: selectedBg === bg.id ? '2px solid var(--brand-color)' : 'none',
                            outlineOffset: '2px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => postFileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-500 transition px-3 py-2 rounded-xl hover:bg-pink-50"
                    >
                      {uploading ? '⏳' : '📷'} Photo/Video
                    </button>
                    <input
                      ref={postFileRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={e => e.target.files && handlePostFiles(e.target.files)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
                  >
                    {submitting ? 'Posting…' : 'Share ✨'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : mode === 'poll' ? (
          <form onSubmit={handleSubmitPoll}>
            <div className="card p-6 space-y-4">
              <textarea
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="Ask a question… 🗳️"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-from)] transition"
              />

              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => setPollOptions(opts => opts.map((o, j) => j === i ? e.target.value : o))}
                      placeholder={`Option ${i + 1}`}
                      maxLength={100}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(opts => opts.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-400 transition px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* AI image generator */}
              <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">✨ AI header image <span className="font-normal text-gray-400">(optional)</span></p>
                  {pollMedia.length > 0 && (
                    <button type="button" onClick={() => { setPollMedia([]); setPollImgProgress(0); }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                </div>

                {pollMedia.length > 0 ? (
                  <img src={pollMedia[0].url} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                ) : pollImgLoading ? (
                  <div className="space-y-1.5">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full brand-gradient rounded-full transition-all duration-300" style={{ width: `${pollImgProgress}%` }} />
                    </div>
                    <p className="text-xs text-center text-gray-400">Luna is painting… {pollImgProgress}%</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={generatePollImage}
                    disabled={pollImgLoading}
                    className="w-full py-2 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-pink-300 hover:text-pink-400 transition"
                  >
                    🎨 Generate image from question
                  </button>
                )}
                {pollImgError && <p className="text-xs text-red-400">{pollImgError}</p>}
              </div>

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions(opts => [...opts, ''])}
                  className="text-sm text-pink-500 font-semibold hover:text-pink-600"
                >
                  + Add option
                </button>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="brand-gradient text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition disabled:opacity-60"
                >
                  {submitting ? 'Posting…' : 'Share Poll ✨'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="card p-6">
            <div className="space-y-5">
              {/* File picker area */}
              {!storyFile && !uploading && (
                <button
                  onClick={() => storyFileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-gray-400 hover:border-pink-300 hover:text-pink-400 transition"
                >
                  <span className="text-4xl">📸</span>
                  <span className="text-sm font-medium">Tap to pick a photo or video</span>
                </button>
              )}

              {uploading && (
                <div className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-gray-400">
                  <span className="text-4xl">⏳</span>
                  <span className="text-sm font-medium">Uploading…</span>
                </div>
              )}

              <input
                ref={storyFileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleStoryFileChange}
              />

              {/* Preview */}
              {storyFile && (
                <div className="relative">
                  {storyFile.type === 'video' ? (
                    <video src={storyFile.url} className="w-full rounded-2xl max-h-72 object-contain bg-black" controls />
                  ) : (
                    <img src={storyFile.url} alt="" className="w-full rounded-2xl max-h-72 object-contain bg-gray-50" />
                  )}
                  <button
                    onClick={() => { setStoryFile(null); setPermanent(null); if (storyFileRef.current) storyFileRef.current.value = ''; }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 text-sm flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Caption */}
              {storyFile && (
                <textarea
                  value={storyCaption}
                  onChange={e => setStoryCaption(e.target.value)}
                  placeholder="Add a caption… (optional)"
                  rows={2}
                  maxLength={300}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
                />
              )}

              {/* Duration picker */}
              {storyFile && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">How long should this story last?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPermanent(false)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition ${permanent === false ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      ⏳ 24 hours
                    </button>
                    <button
                      onClick={() => setPermanent(true)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition ${permanent === true ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      ♾️ Keep forever
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              {storyFile && (
                <button
                  onClick={handleSubmitStory}
                  disabled={submitting || permanent === null}
                  className="w-full brand-gradient text-white font-semibold py-3 rounded-full text-sm hover:opacity-90 transition disabled:opacity-40"
                >
                  {submitting ? 'Sharing…' : 'Share Story ✨'}
                </button>
              )}

              {storyFile && permanent === null && (
                <p className="text-xs text-center text-gray-400">Choose a duration above to share</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
