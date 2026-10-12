import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { saveLunaMessage } from '@/app/lib/luna-history';
import { paintImage, startHeartbeat } from '@/app/lib/luna-painting';

const MAX_PROMPT_LENGTH = 300;
const MAX_SAID_LENGTH = 1000;
// 1024 looked a little sharper full-screen but took far longer and far more
// memory; 768 keeps the wait bearable for a kid.
const IMAGE_SIZE = 768;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // `said` is the child's original chat message that asked for the picture —
  // it's what gets saved to history.
  const { prompt, said } = await request.json();
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  const cleanSaid = typeof said === 'string' ? said.trim().slice(0, MAX_SAID_LENGTH) : '';
  const userText = cleanSaid || `🎨 Draw: ${cleanPrompt}`;

  const safe = (await Promise.all([
    isPromptSafe(cleanPrompt),
    cleanSaid ? isPromptSafe(cleanSaid) : true,
  ])).every(Boolean);
  if (!safe) {
    const blocked = "That sounds like something Luna can't draw. Try something else! 🌙";
    await saveLunaMessage(session.id, 'user', cleanSaid ? "🎨 Asked for a picture" : userText);
    await saveLunaMessage(session.id, 'assistant', blocked);
    return NextResponse.json({ error: blocked }, { status: 400 });
  }

  const styledPrompt = `${cleanPrompt}, cute colorful cartoon illustration, kid-friendly, whimsical, vibrant`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const stopHeartbeat = startHeartbeat(controller);

      try {
        const imageBase64 = await paintImage(styledPrompt, IMAGE_SIZE, IMAGE_SIZE);

        const buffer = Buffer.from(imageBase64, 'base64');
        const imgDir = path.join(process.cwd(), 'public', 'uploads', 'images');
        await mkdir(imgDir, { recursive: true });

        // Served via /api/uploads/images/... (not the static /uploads/ path) because
        // this Next.js build snapshots public/ at server boot — newly written files
        // 404 through the static handler until the next restart.
        const filename = `ai-${uuidv4()}.webp`;
        let url: string;
        try {
          const sharp = (await import('sharp')).default;
          const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
          await writeFile(path.join(imgDir, filename), webpBuffer);
          url = `/api/uploads/images/${filename}`;
        } catch {
          const fallbackName = `ai-${uuidv4()}.png`;
          await writeFile(path.join(imgDir, fallbackName), buffer);
          url = `/api/uploads/images/${fallbackName}`;
        }

        await saveLunaMessage(session.id, 'user', userText);
        await saveLunaMessage(session.id, 'assistant', '', url);

        send({ url });
      } catch (err) {
        console.error('[LUNA IMAGE] generation failed:', err);
        send({ error: "I couldn't paint that one, try again? 🌙" });
      } finally {
        stopHeartbeat();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
