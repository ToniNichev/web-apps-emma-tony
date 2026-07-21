import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

const SAFE_CATEGORIES: Record<string, string> = {
  '1':  'Film & Animation',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '20': 'Gaming',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
};

interface VideoMeta {
  title: string;
  description: string;
  channelTitle: string;
  tags: string;
  category: string;
  thumbnail: string;
  madeForKids: boolean | null;
  ageRestricted: boolean;
  embeddable: boolean;
}

interface SafetyResult {
  safe: boolean;
  title: string;
  thumbnail: string;
  reason: string;
}

async function getVideoMetadata(videoId: string): Promise<VideoMeta | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,status&key=${apiKey}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item) {
          return {
            title: item.snippet.title ?? '',
            description: (item.snippet.description ?? '').slice(0, 500),
            channelTitle: item.snippet.channelTitle ?? '',
            tags: (item.snippet.tags ?? []).slice(0, 20).join(', '),
            category: SAFE_CATEGORIES[item.snippet.categoryId] ?? '',
            thumbnail:
              item.snippet.thumbnails?.high?.url ??
              item.snippet.thumbnails?.default?.url ??
              `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            madeForKids: item.status?.madeForKids ?? null,
            ageRestricted: item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted',
            embeddable: item.status?.embeddable ?? true,
          };
        }
      }
    } catch {
      // fall through to oEmbed
    }
  }

  // Fallback: oEmbed (no API key needed, but fewer signals)
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title ?? '',
        description: '',
        channelTitle: data.author_name ?? '',
        tags: '',
        category: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        madeForKids: null,
        ageRestricted: false,
        embeddable: true,
      };
    }
  } catch {
    // oEmbed also failed
  }

  return null;
}

type AiVerdict = 'yes' | 'no' | 'unavailable';

async function aiKidFriendlinessCheck(
  title: string,
  channel: string,
  description: string,
  tags: string,
  category: string,
): Promise<AiVerdict> {
  const prompt = `You are a child safety reviewer for a social network used by kids aged 6-12.

Evaluate this YouTube video and decide if it is appropriate for children aged 6-12.

Title: ${title}
Channel: ${channel}${category ? `\nCategory: ${category}` : ''}${description ? `\nDescription: ${description}` : ''}${tags ? `\nTags: ${tags}` : ''}

Answer with ONLY "YES" if kid-friendly, or "NO" if not appropriate.
NOT kid-friendly: violence, horror, adult themes, strong language, dangerous stunts, drugs, weapons.
Kid-friendly: gaming (family games), cartoons, educational, music, sports (including mountain biking, cycling, skateboarding), crafts, animals, cooking.
When in doubt, default to NO — a missed safe video is a much smaller problem than showing a child something inappropriate.`;

  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!res.ok) return 'unavailable'; // fail closed if Ollama errors
    const data = await res.json();
    const answer: string = data.message?.content?.trim().toUpperCase() ?? '';
    return answer.startsWith('YES') ? 'yes' : 'no';
  } catch {
    return 'unavailable'; // fail closed if Ollama is unreachable
  }
}

export async function GET(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 30, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a while.' }, { status: 429 });
  }

  const videoId = request.nextUrl.searchParams.get('videoId');
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const meta = await getVideoMetadata(videoId);

  if (!meta) {
    return NextResponse.json<SafetyResult>({
      safe: false,
      title: '',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      reason: 'Could not verify video',
    });
  }

  if (meta.ageRestricted) {
    return NextResponse.json<SafetyResult>({
      safe: false,
      title: meta.title,
      thumbnail: meta.thumbnail,
      reason: 'Age-restricted content',
    });
  }

  if (!meta.embeddable) {
    return NextResponse.json<SafetyResult>({
      safe: false,
      title: meta.title,
      thumbnail: meta.thumbnail,
      reason: 'Video cannot be embedded',
    });
  }

  // YouTube's own "made for kids" flag is the strongest signal
  if (meta.madeForKids === true) {
    return NextResponse.json<SafetyResult>({
      safe: true,
      title: meta.title,
      thumbnail: meta.thumbnail,
      reason: 'Marked as made for kids by YouTube',
    });
  }

  // Only categories with a narrow, consistently low-risk content profile skip AI
  // review. Categories like Music, Gaming, and Film & Animation vary too widely
  // (explicit music videos, M-rated gameplay, etc.) to auto-approve by label alone.
  if (meta.category && meta.madeForKids !== false) {
    const safeCategoryNames = ['Education', 'Pets & Animals', 'Howto & Style', 'Science & Technology'];
    if (safeCategoryNames.includes(meta.category)) {
      return NextResponse.json<SafetyResult>({
        safe: true,
        title: meta.title,
        thumbnail: meta.thumbnail,
        reason: `Approved — ${meta.category} category`,
      });
    }
  }

  // AI check for everything else
  const verdict = await aiKidFriendlinessCheck(
    meta.title,
    meta.channelTitle,
    meta.description,
    meta.tags,
    meta.category,
  );

  return NextResponse.json<SafetyResult>({
    safe: verdict === 'yes',
    title: meta.title,
    thumbnail: meta.thumbnail,
    reason:
      verdict === 'yes' ? 'AI approved' :
      verdict === 'no' ? 'AI flagged as not kid-friendly' :
      'Safety check unavailable — blocked by default',
  });
}
