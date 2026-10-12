// Tracks whether Luna is mid-painting. FLUX needs most of this machine's GPU
// memory, so the chat route holds off on loading its own models until the
// painting is done. Kept on globalThis because each route is bundled
// separately and wouldn't otherwise share module state.
const g = globalThis as typeof globalThis & { __lunaPaintings?: number };

export function beginLunaPainting() {
  g.__lunaPaintings = (g.__lunaPaintings ?? 0) + 1;
}

export function endLunaPainting() {
  g.__lunaPaintings = Math.max(0, (g.__lunaPaintings ?? 0) - 1);
}

export function isLunaPainting() {
  return (g.__lunaPaintings ?? 0) > 0;
}
