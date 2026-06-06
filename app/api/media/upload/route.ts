import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/app/lib/auth';

const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) return NextResponse.json({ message: 'No file provided' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ message: 'File too large (max 500MB)' }, { status: 400 });

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    return NextResponse.json({ message: 'Only images and videos are allowed' }, { status: 400 });
  }

  const ext = file.name.split('.').pop();
  const filename = `${uuidv4()}.${ext}`;
  const subdir = isVideo ? 'videos' : 'images';
  const uploadBase = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'uploads');
  const filepath = path.join(uploadBase, subdir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const url = `/uploads/${subdir}/${filename}`;
  return NextResponse.json({ url, type: isVideo ? 'video' : 'image' }, { status: 201 });
}
