import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/app/lib/auth';

const MAX_PROMPT_LENGTH = 300;
const BLOCKED_WORDS = ['nude', 'naked', 'sex', 'sexy', 'gore', 'blood', 'kill', 'gun', 'weapon', 'drug'];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  const lower = cleanPrompt.toLowerCase();
  if (BLOCKED_WORDS.some(w => lower.includes(w))) {
    return NextResponse.json({ error: 'That sounds like something Luna can\'t draw. Try something else! 🌙' }, { status: 400 });
  }

  const styledPrompt = `${cleanPrompt}, cute colorful cartoon illustration, kid-friendly, whimsical, vibrant`;

  const ollamaRes = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'x/flux2-klein:latest',
      prompt: styledPrompt,
      stream: false,
    }),
  });

  if (!ollamaRes.ok) {
    return NextResponse.json({ error: 'Image generator unavailable' }, { status: 502 });
  }

  const data = await ollamaRes.json();
  if (!data.image) {
    return NextResponse.json({ error: 'No image returned' }, { status: 502 });
  }

  const buffer = Buffer.from(data.image, 'base64');
  const imgDir = path.join(process.cwd(), 'public', 'uploads', 'images');
  await mkdir(imgDir, { recursive: true });

  // Served via /api/uploads/images/... (not the static /uploads/ path) because
  // this Next.js build snapshots public/ at server boot — newly written files
  // 404 through the static handler until the next restart.
  const filename = `ai-${uuidv4()}.webp`;
  try {
    const sharp = (await import('sharp')).default;
    const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
    await writeFile(path.join(imgDir, filename), webpBuffer);
  } catch {
    const fallbackName = `ai-${uuidv4()}.png`;
    await writeFile(path.join(imgDir, fallbackName), buffer);
    return NextResponse.json({ url: `/api/uploads/images/${fallbackName}` }, { status: 201 });
  }

  return NextResponse.json({ url: `/api/uploads/images/${filename}` }, { status: 201 });
}
