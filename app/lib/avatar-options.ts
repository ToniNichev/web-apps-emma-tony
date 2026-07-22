export const AVATAR_EMOJIS = [
  '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯',
  '🐰', '🐸', '🦄', '🐙', '🐵', '🐷', '🐧', '🤖',
] as const;

export const AVATAR_COLORS = [
  { id: 'pink', hex: '#f9a8d4' },
  { id: 'purple', hex: '#c4b5fd' },
  { id: 'blue', hex: '#93c5fd' },
  { id: 'green', hex: '#86efac' },
  { id: 'yellow', hex: '#fde047' },
  { id: 'orange', hex: '#fdba74' },
  { id: 'red', hex: '#fca5a5' },
  { id: 'teal', hex: '#5eead4' },
] as const;

export const AVATAR_ACCESSORIES = ['🎩', '👑', '🎀', '🕶️', '🌸', '⭐', '🧢', '💎'] as const;

export function defaultEmojiFor(userId: number): string {
  return AVATAR_EMOJIS[userId % AVATAR_EMOJIS.length];
}

export function defaultColorHexFor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length].hex;
}

export function colorHex(colorId: string | null | undefined): string | null {
  if (!colorId) return null;
  return AVATAR_COLORS.find(c => c.id === colorId)?.hex ?? null;
}
