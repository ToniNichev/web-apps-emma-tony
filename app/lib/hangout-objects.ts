export const HANGOUT_OBJECTS = [
  { type: 'tree', emoji: '🌳', label: 'Tree' },
  { type: 'chair', emoji: '🪑', label: 'Chair' },
  { type: 'lamp', emoji: '💡', label: 'Lamp' },
  { type: 'fountain', emoji: '⛲', label: 'Fountain' },
  { type: 'tent', emoji: '🎪', label: 'Tent' },
] as const;

export type HangoutObjectType = typeof HANGOUT_OBJECTS[number]['type'];
export const HANGOUT_OBJECT_TYPES: HangoutObjectType[] = HANGOUT_OBJECTS.map(o => o.type);

export function emojiForType(type: string): string {
  return HANGOUT_OBJECTS.find(o => o.type === type)?.emoji ?? '❓';
}

export const ROOM_W = 800;
export const ROOM_H = 600;
