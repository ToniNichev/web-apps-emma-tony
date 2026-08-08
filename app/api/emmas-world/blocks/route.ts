import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const MAX_SHAPE_INDEX = 3; // 0=Cube, 1=Wedge, 2=Cylinder, 3=Ball

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    `SELECT id, shape_index, pos_x, pos_y, pos_z, rotation_y,
       color_r, color_g, color_b, placed_by
     FROM emmas_world_blocks
     ORDER BY id ASC`
  ) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { shape_index, pos_x, pos_y, pos_z, rotation_y, color_r, color_g, color_b } = await request.json();

  if (!Number.isInteger(shape_index) || shape_index < 0 || shape_index > MAX_SHAPE_INDEX) {
    return NextResponse.json({ message: 'Invalid shape' }, { status: 400 });
  }
  if (![pos_x, pos_y, pos_z].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return NextResponse.json({ message: 'Invalid position' }, { status: 400 });
  }
  if (!Number.isInteger(rotation_y) || rotation_y % 90 !== 0 || rotation_y < 0 || rotation_y >= 360) {
    return NextResponse.json({ message: 'Invalid rotation' }, { status: 400 });
  }
  if (![color_r, color_g, color_b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return NextResponse.json({ message: 'Invalid color' }, { status: 400 });
  }

  const [result] = await db.execute(
    `INSERT INTO emmas_world_blocks
       (shape_index, pos_x, pos_y, pos_z, rotation_y, color_r, color_g, color_b, placed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shape_index, pos_x, pos_y, pos_z, rotation_y, color_r, color_g, color_b, session.id]
  ) as any[];
  const blockId = (result as any).insertId;

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to('emmasworld').emit('emmasworld:block_placed', {
    id: blockId, shape_index, pos_x, pos_y, pos_z, rotation_y,
    color_r, color_g, color_b, placed_by: session.id,
  });

  return NextResponse.json({ id: blockId }, { status: 201 });
}
