import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { rateLimit } from '@/app/lib/rate-limit';

const MAX_LENGTH = 1000;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(`
    SELECT * FROM (
      SELECT fc.id, fc.sender_id, fc.content, fc.created_at, u.username, u.first_name, u.profile_picture
      FROM family_chat_messages fc
      JOIN users u ON u.id = fc.sender_id
      ORDER BY fc.created_at DESC, fc.id DESC
      LIMIT 100
    ) recent
    ORDER BY created_at ASC, id ASC
  `) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { content } = await request.json();
  const trimmed = (content ?? '').trim();

  if (!trimmed) return NextResponse.json({ message: 'Empty message' }, { status: 400 });
  if (trimmed.length > MAX_LENGTH) return NextResponse.json({ message: `Keep it under ${MAX_LENGTH} characters` }, { status: 400 });

  if (!rateLimit(`family-chat:${session.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ message: "You're sending a lot of messages — slow down a bit! 💬" }, { status: 429 });
  }

  if (!(await isPromptSafe(trimmed))) {
    return NextResponse.json({ message: "That message isn't allowed here. Keep it kind! 🌸" }, { status: 400 });
  }

  const [result] = await db.execute(
    'INSERT INTO family_chat_messages (sender_id, content) VALUES (?, ?)',
    [session.id, trimmed]
  ) as any[];

  const message = {
    id: (result as any).insertId,
    sender_id: session.id,
    content: trimmed,
    created_at: new Date().toISOString(),
    username: session.username,
    first_name: session.first_name,
    profile_picture: session.profile_picture ?? null,
  };

  // Server-pushed, not a client-triggered relay like DMs use — only reaches
  // the room after moderation/rate-limit actually pass, which matters more
  // here since this fans out to the whole family, not just one recipient.
  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to('family_chat').emit('family_chat:new_message', message);

  return NextResponse.json(message, { status: 201 });
}
