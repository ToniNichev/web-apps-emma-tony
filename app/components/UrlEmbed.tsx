'use client';

type Embed = { type: 'youtube'; id: string } | { type: 'tiktok'; id: string } | { type: 'tiktok-short'; url: string };

const YT_RE  = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
const TT_RE  = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)/g;
const TTS_RE = /https?:\/\/(?:vm|vt)\.tiktok\.com\/[\w]+\/?/g;
const URL_RE = /https?:\/\/[^\s]+/g;

function detectEmbeds(text: string): Embed[] {
  const embeds: Embed[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(YT_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); embeds.push({ type: 'youtube', id: m[1] }); }
  }
  for (const m of text.matchAll(TT_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); embeds.push({ type: 'tiktok', id: m[1] }); }
  }
  for (const m of text.matchAll(TTS_RE)) {
    if (!seen.has(m[0])) { seen.add(m[0]); embeds.push({ type: 'tiktok-short', url: m[0] }); }
  }

  return embeds;
}

function renderText(text: string) {
  const parts = text.split(URL_RE);
  const urls  = text.match(URL_RE) || [];
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {urls[i] && (
        <a
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          className="brand-text underline underline-offset-2 break-all"
        >
          {urls[i]}
        </a>
      )}
    </span>
  ));
}

export default function PostContent({ text }: { text: string }) {
  const embeds = detectEmbeds(text);

  return (
    <>
      <p className="px-4 pb-3 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
        {renderText(text)}
      </p>

      {embeds.map((embed, i) => {
        if (embed.type === 'youtube') {
          return (
            <div key={i} className="px-4 pb-3">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${embed.id}`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          );
        }

        if (embed.type === 'tiktok') {
          return (
            <div key={i} className="px-4 pb-3">
              <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingTop: '177.78%' }}>
                <iframe
                  src={`https://www.tiktok.com/embed/v2/${embed.id}`}
                  className="absolute inset-0 w-full h-full"
                  allow="encrypted-media"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          );
        }

        if (embed.type === 'tiktok-short') {
          return (
            <div key={i} className="px-4 pb-3">
              <a
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.56V6.79a4.85 4.85 0 01-1.07-.1z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:brand-text transition">TikTok Video</p>
                  <p className="text-xs text-gray-400 truncate">{embed.url}</p>
                </div>
                <span className="text-gray-300 group-hover:text-gray-500 transition">›</span>
              </a>
            </div>
          );
        }

        return null;
      })}
    </>
  );
}
