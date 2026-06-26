import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const key = process.env.TENOR_API_KEY;
  if (!key) return NextResponse.json([], { status: 503 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  const url = q
    ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${key}&limit=20&contentfilter=high&media_filter=minimal`
    : `https://api.tenor.com/v1/trending?key=${key}&limit=20&contentfilter=high&media_filter=minimal`;

  const res = await fetch(url);
  const data = await res.json();

  const gifs = (data.results || []).map((r: any) => ({
    id: r.id,
    preview: r.media[0]?.tinygif?.url || r.media[0]?.gif?.url,
    url: r.media[0]?.gif?.url,
    title: r.title,
  }));

  return NextResponse.json(gifs);
}
