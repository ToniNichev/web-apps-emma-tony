// Image generation for Luna's drawings and hangout backgrounds. Ollama dropped
// image-generation support in v0.32.6+ with no re-enable timeline, so this
// runs FLUX.2 Klein locally via mflux instead (shared with TrackThisRun's
// mflux-image-server, same machine). That server generates synchronously with
// no progress feed.
const OLLAMA_URL = 'http://localhost:11434';
const GENERATE_TIMEOUT_MS = 600_000;

// Tracks whether FLUX is mid-painting. It needs most of this machine's GPU
// memory, so the chat route holds off on loading its own models until the
// painting is done. Kept on globalThis because each route is bundled
// separately and wouldn't otherwise share module state.
const g = globalThis as typeof globalThis & { __lunaPaintings?: number };

export function isLunaPainting() {
  return (g.__lunaPaintings ?? 0) > 0;
}

// The chat and moderation models stay resident in Ollama for minutes after
// their last call, and on this 16 GB machine they starve FLUX of GPU memory —
// a 4-step painting then takes 5+ minutes instead of about one. Evict them
// first; they reload in a few seconds on the next chat message.
async function unloadOllamaModels() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/ps`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return;
    const { models = [] }: { models?: { name: string }[] } = await res.json();
    await Promise.all(models.map(m => fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m.name, keep_alive: 0 }),
      signal: AbortSignal.timeout(10_000),
    })));
  } catch {
    // Best effort — a slow painting still beats no painting.
  }
}

// Returns the painting as base64 PNG; throws if the generator fails.
// Width and height must be multiples of 16.
export async function paintImage(prompt: string, width: number, height: number): Promise<string> {
  g.__lunaPaintings = (g.__lunaPaintings ?? 0) + 1;
  try {
    await unloadOllamaModels();
    const res = await fetch(`${process.env.MFLUX_BASE_URL || 'http://localhost:8093'}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width, height }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`mflux returned ${res.status}`);
    const data: { image?: string } = await res.json();
    if (!data.image) throw new Error('mflux returned no image');
    return data.image;
  } finally {
    g.__lunaPaintings = Math.max(0, (g.__lunaPaintings ?? 0) - 1);
  }
}

// Blank lines (stream readers skip them) so proxies don't drop the connection
// as idle while a painting is still generating. Returns the stop function.
export function startHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>) {
  const blank = new TextEncoder().encode('\n');
  const timer = setInterval(() => {
    try { controller.enqueue(blank); } catch {}
  }, 15_000);
  return () => clearInterval(timer);
}
