'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setMedia(m => [...m, { url: data.url, type: data.type }]);
      }
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && media.length === 0) {
      setError('Add some text or media to post');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, media }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Failed to post');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-gray-400 hover:text-gray-600 transition text-sm">← Back</a>
          <h1 className="font-bold text-gray-800">New Post</h1>
          <div className="w-10" />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind? ✨"
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 transition"
            />

            {/* Media preview */}
            {media.length > 0 && (
              <div className={`grid gap-2 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {media.map((m, i) => (
                  <div key={i} className="relative group">
                    {m.type === 'video' ? (
                      <video src={m.url} className="w-full rounded-xl object-cover max-h-60 bg-black" />
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

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-500 transition px-3 py-2 rounded-xl hover:bg-pink-50"
                >
                  {uploading ? '⏳' : '📷'} Photo/Video
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleFiles(e.target.files)}
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
          </form>
        </div>
      </main>
    </div>
  );
}
