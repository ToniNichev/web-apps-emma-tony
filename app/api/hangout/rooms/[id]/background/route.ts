import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';

const MAX_PROMPT_LENGTH = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM hangout_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ error: 'Only the host can change the background' }, { status: 403 });
  }

  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH);

  if (!(await isPromptSafe(cleanPrompt))) {
    return NextResponse.json({ error: "That sounds like something we can't draw. Try something else! 🎨" }, { status: 400 });
  }

  const styledPrompt = `${cleanPrompt}, cute colorful cartoon scene, wide background illustration, kid-friendly, no people`;

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

        // Served via /api/uploads/images/... (not the static /uploads/ path) —
        // same reasoning as Luna's image route: newly written files 404 through
        // the static handler until the next server restart.
        const filename = `hangout-bg-${uuidv4()}.webp`;
        let url: string;
        try {
          const sharp = (await import('sharp')).default;
          const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
          await writeFile(path.join(imgDir, filename), webpBuffer);
          url = `/api/uploads/images/${filename}`;
        } catch {
          const fallbackName = `hangout-bg-${uuidv4()}.png`;
          await writeFile(path.join(imgDir, fallbackName), buffer);
          url = `/api/uploads/images/${fallbackName}`;
        }

        await db.execute(
          'UPDATE hangout_rooms SET background_url = ?, background_status = "active" WHERE id = ?',
          [url, roomId]
        );

        const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
        io?.to(`hangout:${roomId}`).emit('hangout:background_updated', { url });

        send({ url });
        controller.close();
      } catch {
        send({ error: "Couldn't generate that background, try again?" });
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
