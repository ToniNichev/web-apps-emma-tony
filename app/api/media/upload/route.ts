import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/app/lib/auth';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) return NextResponse.json({ message: 'No file provided' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ message: 'File too large (max 20 MB)' }, { status: 400 });

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    return NextResponse.json({ message: 'Only images and videos are allowed' }, { status: 400 });
  }

  const uploadBase = path.join(process.cwd(), 'public', 'uploads');

  if (isVideo) {
    const ext = file.name.split('.').pop() || 'mp4';
    const filename = `${uuidv4()}.${ext}`;
    const videoDir = path.join(uploadBase, 'videos');
    await mkdir(videoDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(videoDir, filename), buffer);
    return NextResponse.json({
      url: `/uploads/videos/${filename}`,
      type: 'video',
    }, { status: 201 });
  }

  // Image — compress with sharp
  const buffer = Buffer.from(await file.arrayBuffer());
  const imgDir   = path.join(uploadBase, 'images');
  const thumbDir = path.join(uploadBase, 'thumbs');
  await mkdir(imgDir,   { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const id        = uuidv4();
  const filename  = `${id}.webp`;
  const thumbname = `${id}_thumb.webp`;

  try {
    const sharp = (await import('sharp')).default;

    // Full image — max 1920 px wide, WebP quality 82
    const fullBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // Thumbnail — max 480 px wide, WebP quality 75
    const thumbBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    await writeFile(path.join(imgDir,   filename),  fullBuffer);
    await writeFile(path.join(thumbDir, thumbname), thumbBuffer);

    return NextResponse.json({
      url:          `/uploads/images/${filename}`,
      thumbnail_url: `/uploads/thumbs/${thumbname}`,
      type: 'image',
    }, { status: 201 });

  } catch {
    // sharp not available — fall back to saving original
    const ext = file.name.split('.').pop() || 'jpg';
    const fallbackName = `${id}.${ext}`;
    await writeFile(path.join(imgDir, fallbackName), buffer);
    return NextResponse.json({
      url: `/uploads/images/${fallbackName}`,
      thumbnail_url: null,
      type: 'image',
    }, { status: 201 });
  }
}
