import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { saveLunaMessage } from '@/app/lib/luna-history';

const MAX_PROMPT_LENGTH = 300;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH);

  if (!(await isPromptSafe(cleanPrompt))) {
    const blocked = "That sounds like something Luna can't draw. Try something else! 🌙";
    await saveLunaMessage(session.id, 'user', `🎨 Draw: ${cleanPrompt}`);
    await saveLunaMessage(session.id, 'assistant', blocked);
    return NextResponse.json({ error: blocked }, { status: 400 });
  }

  const styledPrompt = `${cleanPrompt}, cute colorful cartoon illustration, kid-friendly, whimsical, vibrant`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'x/flux2-klein:latest',
            prompt: styledPrompt,
            stream: true,
          }),
        });

        if (!ollamaRes.ok || !ollamaRes.body) {
          send({ error: 'Image generator unavailable' });
          controller.close();
          return;
        }

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let imageBase64: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let chunk: { image?: string; completed?: number; total?: number };
            try { chunk = JSON.parse(line); } catch { continue; }
            if (chunk.image) {
              imageBase64 = chunk.image;
            } else if (typeof chunk.completed === 'number' && typeof chunk.total === 'number' && chunk.total > 0) {
              send({ progress: chunk.completed / chunk.total });
            }
          }
        }

        if (!imageBase64) {
          send({ error: 'No image returned' });
          controller.close();
          return;
        }

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

        await saveLunaMessage(session.id, 'user', `🎨 Draw: ${cleanPrompt}`);
        await saveLunaMessage(session.id, 'assistant', '', url);

        send({ url });
        controller.close();
      } catch {
        send({ error: "I couldn't paint that one, try again? 🌙" });
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
