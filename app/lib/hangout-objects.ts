export const HANGOUT_OBJECTS = [
  { type: 'tree', emoji: '🌳', label: 'Tree' },
  { type: 'chair', emoji: '🪑', label: 'Chair' },
  { type: 'lamp', emoji: '💡', label: 'Lamp' },
  { type: 'fountain', emoji: '⛲', label: 'Fountain' },
  { type: 'tent', emoji: '🎪', label: 'Tent' },
  { type: 'couch', emoji: '🛋️', label: 'Couch' },
  { type: 'campfire', emoji: '🔥', label: 'Campfire' },
  { type: 'plant', emoji: '🪴', label: 'Potted plant' },
  { type: 'teddy', emoji: '🧸', label: 'Teddy bear' },
  { type: 'bookshelf', emoji: '📚', label: 'Bookshelf' },
  { type: 'easel', emoji: '🎨', label: 'Easel' },
  { type: 'flowers', emoji: '🌷', label: 'Flower bed' },
  { type: 'pinata', emoji: '🪅', label: 'Piñata' },
] as const;

export type HangoutObjectType = typeof HANGOUT_OBJECTS[number]['type'];
export const HANGOUT_OBJECT_TYPES: HangoutObjectType[] = HANGOUT_OBJECTS.map(o => o.type);

export function emojiForType(type: string): string {
  return HANGOUT_OBJECTS.find(o => o.type === type)?.emoji ?? '❓';
}

export const ROOM_W = 800;
export const ROOM_H = 600;

// Barriers — host-placed circular "don't walk here" zones (e.g. marking a
// waterfall out of a generated background). Larger radius than decorations
// since a single barrier needs to help cover a real terrain feature; the
// host clicks several times to rope off an irregular area with overlapping
// circles rather than drawing a precise outline.
export const BARRIER_RADIUS = 40;
export const MAX_BARRIERS_PER_ROOM = 40;
