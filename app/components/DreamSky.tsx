'use client';
import { useEffect, useMemo, useRef } from 'react';

// A twilight sky to sit behind the page: paper lanterns float past as you scroll (and drift
// slowly toward you even when you don't), fireflies wander, clouds slide by under Luna's
// moon, and now and then a shooting star, a paper plane or a unicorn with a rainbow
// trail crosses. Same approach as toni-develops.com's post galaxy and TrackThisRun's
// route field: a hand-rolled perspective projection on a 2D canvas.
//
// Lanterns can come from real posts (one per post, coloured by its author, bigger the more
// it was liked) but only ids and counts reach the browser — nothing a lantern shows says
// what the post was. With no posts (the public login and signup pages) the sky is seeded.
//
// `quiet` is the backdrop for content pages: no sky gradient of its own, dimmer, fewer
// surprises, and scrolling barely moves it.

export type SkyLantern = { id: number; authorId: number; likes?: number };

type Lantern = {
  x: number; y: number; z: number; size: number; color: number;
  bobPeriod: number; bobPhase: number; swayPeriod: number;
};
type Firefly = { x: number; y: number; rangeX: number; rangeY: number; period: number; phase: number; size: number };
type Star = { x: number; y: number; size: number; period: number; phase: number };
type Cloud = { y: number; scale: number; speed: number; offset: number; sprite: number };
type Scene = { lanterns: Lantern[]; fireflies: Firefly[]; stars: Star[]; clouds: Cloud[] };

// Warm paper colours, as [body, glow] RGB. Dark mode glows; light mode is softer.
const LANTERN_COLORS: [string, string][] = [
  ['255,138,170', '255,170,200'], // pink
  ['255,178,102', '255,200,140'], // peach
  ['255,214,102', '255,226,150'], // gold
  ['186,150,255', '205,180,255'], // lavender
  ['120,214,180', '160,230,200'], // mint
  ['125,190,255', '165,210,255'], // sky
];
const FIREFLY = '255,226,140';
const RAINBOW = ['255,99,132', '255,159,64', '255,221,87', '102,221,140', '86,180,255', '160,120,255'];

const DEPTH = 3200; // lanterns loop through this much depth, so the flight never ends
const NEAR_FADE = 260; // lanterns fade out as they get this close
const FAR_FADE = 900; // ...and fade in over this much depth at the far end
const LANTERN_RADIUS = 26; // world units
const MIN_LANTERNS = 28; // a page with only a few posts is padded with seeded lanterns
const MAX_LANTERNS = 60;
const DRIFT = 0.022; // world units per ms the camera creeps forward on its own
const SCROLL_GAIN = 1.1; // world units per px scrolled
const QUIET_SCROLL_GAIN = 0.25;
const SCROLL_EASE = 0.06;
const POINTER_EASE = 0.05;
const LOOK_PX: [number, number] = [40, 24]; // how far the pointer swings the view
const STAR_COUNT = 150;
const FIREFLY_COUNT = 34;
const CLOUD_COUNT = 6;
const METEOR_MS = 800;
const METEOR_GAP_MS: [number, number] = [6000, 14000];
const PLANE_MS = 9000;
const PLANE_LOOP = 0.16; // share of the crossing spent flying the loop
const PLANE_GAP_MS: [number, number] = [22000, 45000];
const UNICORN_MS = 10000;
const UNICORN_GAP_MS: [number, number] = [40000, 80000];
const QUIET_GAP_FACTOR = 2.5; // surprises are rarer behind content

function hash(n: number): number {
  let h = 2166136261 ^ n;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// Seeded, so the same posts make the same sky on every visit.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScene(posts: SkyLantern[], seed: number): Scene {
  const random = mulberry32(seed);
  const items = posts.slice(0, MAX_LANTERNS).map(p => ({ key: p.id, color: hash(p.authorId) % LANTERN_COLORS.length, likes: p.likes ?? 0 }));
  while (items.length < MIN_LANTERNS) {
    items.push({ key: -1 - items.length, color: Math.floor(random() * LANTERN_COLORS.length), likes: Math.floor(random() * 6) });
  }

  const lanterns = items.map((item, i) => {
    const r = mulberry32(hash(item.key) ^ seed);
    // Spread evenly through the depth so the stream never bunches, then jitter.
    const z = ((i + r() * 0.8) / items.length) * DEPTH;
    // Mostly up in the sky, clear of the middle of the screen where the content sits.
    const side = r() < 0.5 ? -1 : 1;
    return {
      x: side * (120 + r() * 820),
      y: -420 + r() * 620,
      z,
      size: 0.75 + Math.min(0.7, Math.log10(1 + item.likes) * 0.45) + r() * 0.15,
      color: item.color,
      bobPeriod: 2600 + r() * 2400,
      bobPhase: r() * Math.PI * 2,
      swayPeriod: 5000 + r() * 4000,
    };
  });

  const fireflies = Array.from({ length: FIREFLY_COUNT }, () => ({
    x: random(), y: 0.35 + random() * 0.65,
    rangeX: 20 + random() * 60, rangeY: 10 + random() * 40,
    period: 5000 + random() * 7000, phase: random() * Math.PI * 2,
    size: 0.8 + random() * 1.4,
  }));
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: random(), y: Math.pow(random(), 1.6) * 0.8, // denser toward the top
    size: 0.4 + random() * 1.2, period: 1500 + random() * 3500, phase: random() * Math.PI * 2,
  }));
  const clouds = Array.from({ length: CLOUD_COUNT }, (_, i) => ({
    y: 0.12 + random() * 0.6, scale: 0.6 + random() * 0.9,
    speed: 0.004 + random() * 0.008, offset: random(), sprite: i % 3,
  }));
  return { lanterns, fireflies, stars, clouds };
}

function parseColor(value: string, fallback: [number, number, number]): [number, number, number] {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const rgb = v.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return fallback;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function makeGlow(rgb: string, size: number, core: number): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${rgb},${core})`);
  gradient.addColorStop(0.3, `rgba(${rgb},${core * 0.35})`);
  gradient.addColorStop(0.65, `rgba(${rgb},${core * 0.08})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

// A puffy cloud: overlapping circles, flattened along the bottom.
function makeCloud(variant: number, rgb: string, alpha: number): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = 360;
  sprite.height = 150;
  const ctx = sprite.getContext('2d')!;
  const random = mulberry32(99 + variant);
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.beginPath();
  const puffs = 5 + variant;
  for (let i = 0; i < puffs; i++) {
    const x = 60 + (i / (puffs - 1)) * 240;
    const r = 26 + random() * 30 * Math.sin((i / (puffs - 1)) * Math.PI) + 10;
    ctx.moveTo(x + r, 108 - r * 0.55);
    ctx.arc(x, 108 - r * 0.55, r, 0, Math.PI * 2);
  }
  ctx.rect(60, 90, 240, 30);
  ctx.fill();
  return sprite;
}

// Luna's moon: a crescent with a soft halo and a couple of craters, drawn once per theme.
function makeMoon(radius: number, dark: boolean): HTMLCanvasElement {
  const size = Math.ceil(radius * 5);
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d')!;
  const c = size / 2;
  // Clear inside the disc, so the bitten-out side of the crescent shows the sky.
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  const rim = radius / c;
  halo.addColorStop(0, 'rgba(255,240,200,0)');
  halo.addColorStop(rim * 0.9, 'rgba(255,240,200,0)');
  halo.addColorStop(rim * 1.05, dark ? 'rgba(255,240,200,0.3)' : 'rgba(255,255,255,0.55)');
  halo.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  const crescent = document.createElement('canvas');
  crescent.width = crescent.height = size;
  const cc = crescent.getContext('2d')!;
  const body = cc.createRadialGradient(c - radius * 0.3, c - radius * 0.3, radius * 0.1, c, c, radius);
  body.addColorStop(0, dark ? '#fffbe8' : '#ffffff');
  body.addColorStop(1, dark ? '#ffe7a3' : '#fff3c4');
  cc.fillStyle = body;
  cc.beginPath();
  cc.arc(c, c, radius, 0, Math.PI * 2);
  cc.fill();
  cc.fillStyle = 'rgba(214,180,110,0.35)';
  for (const [dx, dy, r] of [[-0.45, 0.1, 0.16], [-0.2, 0.5, 0.1], [-0.55, -0.35, 0.08]]) {
    cc.beginPath();
    cc.arc(c + dx * radius, c + dy * radius, r * radius, 0, Math.PI * 2);
    cc.fill();
  }
  // Bite out the shadowed side, which turns the disc into a crescent.
  cc.globalCompositeOperation = 'destination-out';
  cc.beginPath();
  cc.arc(c + radius * 0.48, c - radius * 0.22, radius * 0.86, 0, Math.PI * 2);
  cc.fill();
  ctx.drawImage(crescent, 0, 0);
  return sprite;
}

function smooth(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function between([low, high]: [number, number], factor = 1): number {
  return (low + Math.random() * (high - low)) * factor;
}

export default function DreamSky({
  lanterns: posts = [], quiet = false, seed = 7,
}: {
  lanterns?: SkyLantern[]; quiet?: boolean; seed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keyed on the ids, so a re-render with the same posts keeps the same scene.
  const postKey = posts.map(p => `${p.id}:${p.authorId}:${p.likes ?? 0}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => buildScene(posts, seed), [postKey, seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { lanterns, fireflies, stars, clouds } = scene;
    const gap = quiet ? QUIET_GAP_FACTOR : 1;

    let width = 0;
    let height = 0;
    let focal = 0;
    let small = false; // phone-sized screen: fewer, smaller things
    let dark = false;
    let brandFrom: [number, number, number] = [244, 114, 182];
    let brandTo: [number, number, number] = [168, 85, 247];
    let sky: CanvasGradient | null = null;
    let lanternGlows: HTMLCanvasElement[] = [];
    let fireflyGlow: HTMLCanvasElement | null = null;
    let cloudSprites: HTMLCanvasElement[] = [];
    let moon: HTMLCanvasElement | null = null;
    let moonRadius = 0;
    let raf = 0;

    let scrollTarget = 0;
    let scrollNow = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    const startedAt = performance.now();

    // Each surprise is a crossing with a start time; `next…At` is when the following one may begin.
    let meteor = { from: -1e9, x: 0, y: 0, dx: 0, dy: 0 };
    let nextMeteorAt = startedAt + 2500;
    let plane = { from: -1e9, direction: 1, y: 0, loopAt: 0.5 };
    let nextPlaneAt = startedAt + between(PLANE_GAP_MS, gap) * 0.5;
    let unicorn = { from: -1e9, direction: -1, y: 0 };
    let nextUnicornAt = startedAt + between([14000, 30000], gap);
    const unicornTrail: { x: number; y: number }[] = [];

    function readTheme() {
      const root = document.documentElement;
      dark = root.classList.contains('dark');
      const style = getComputedStyle(root);
      brandFrom = parseColor(style.getPropertyValue('--brand-from'), brandFrom);
      brandTo = parseColor(style.getPropertyValue('--brand-to'), brandTo);
      lanternGlows = LANTERN_COLORS.map(([, glow]) => makeGlow(glow, 96, dark ? 0.9 : 0.55));
      fireflyGlow = makeGlow(FIREFLY, 48, dark ? 1 : 0.7);
      cloudSprites = [0, 1, 2].map(v => makeCloud(v, dark ? '148,163,214' : '255,255,255', dark ? 0.16 : 0.85));
      buildSky();
    }

    function buildSky() {
      moonRadius = Math.max(26, Math.min(64, Math.min(width, height) * 0.06));
      moon = width ? makeMoon(moonRadius, dark) : null;
      if (quiet || !height) { sky = null; return; }
      sky = ctx!.createLinearGradient(0, 0, 0, height);
      const white: [number, number, number] = [255, 255, 255];
      if (dark) {
        sky.addColorStop(0, '#0b1030');
        sky.addColorStop(0.55, mix([30, 27, 75], brandTo, 0.25));
        sky.addColorStop(1, mix([15, 23, 42], brandFrom, 0.3));
      } else {
        sky.addColorStop(0, mix(brandTo, white, 0.72));
        sky.addColorStop(0.6, mix(brandFrom, white, 0.82));
        sky.addColorStop(1, mix([255, 214, 170], white, 0.4));
      }
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      small = width < 640;
      focal = Math.min(width, height * 1.3) * 0.8;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSky();
      if (reducedMotion) draw(performance.now());
    }

    function readScroll() {
      scrollTarget = window.scrollY * (quiet ? QUIET_SCROLL_GAIN : SCROLL_GAIN);
    }

    function onPointer(e: PointerEvent) {
      pointerTargetX = (e.clientX / width) * 2 - 1;
      pointerTargetY = (e.clientY / height) * 2 - 1;
    }

    function drawLantern(x: number, y: number, r: number, alpha: number, color: number, flicker: number) {
      const [body] = LANTERN_COLORS[color];
      // Halo first, added on in the dark so overlapping glows brighten each other.
      ctx!.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx!.globalAlpha = alpha * (dark ? 0.75 : 0.5) * flicker;
      const halo = r * (dark ? 7 : 5);
      ctx!.drawImage(lanternGlows[color], x - halo / 2, y - halo / 2, halo, halo);
      ctx!.globalCompositeOperation = 'source-over';
      if (r < 2.2) return; // too far away to be more than a glow

      ctx!.globalAlpha = alpha;
      const w = r * 0.8;
      // Paper body, lit from inside: hot centre fading to the paper colour at the edges.
      const fill = ctx!.createRadialGradient(x, y + r * 0.15, r * 0.05, x, y, r * 1.05);
      fill.addColorStop(0, `rgba(255,248,225,${0.95 * flicker})`);
      fill.addColorStop(0.45, `rgba(${body},0.95)`);
      fill.addColorStop(1, `rgba(${body},0.75)`);
      ctx!.fillStyle = fill;
      ctx!.beginPath();
      ctx!.ellipse(x, y, w, r, 0, 0, Math.PI * 2);
      ctx!.fill();
      if (r > 6) {
        // Ribs.
        ctx!.strokeStyle = 'rgba(120,60,40,0.18)';
        ctx!.lineWidth = Math.max(0.6, r * 0.04);
        for (const k of [0.45, -0.45]) {
          ctx!.beginPath();
          ctx!.ellipse(x, y, w * Math.abs(k), r * 0.98, 0, k > 0 ? -Math.PI / 2 : Math.PI / 2, k > 0 ? Math.PI / 2 : Math.PI * 1.5);
          ctx!.stroke();
        }
      }
      // Top and bottom caps, and a tassel hanging below.
      ctx!.fillStyle = dark ? 'rgba(70,40,60,0.9)' : 'rgba(120,70,80,0.75)';
      const cap = r * 0.12;
      ctx!.fillRect(x - w * 0.5, y - r - cap * 0.6, w, cap);
      ctx!.fillRect(x - w * 0.45, y + r - cap * 0.4, w * 0.9, cap);
      if (r > 5) {
        ctx!.strokeStyle = `rgba(${body},0.8)`;
        ctx!.lineWidth = Math.max(0.6, r * 0.05);
        ctx!.beginPath();
        ctx!.moveTo(x, y + r + cap * 0.6);
        ctx!.lineTo(x, y + r * 1.55);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    // A folded paper plane, nose along +x, drawn as two triangles and a crease.
    function drawPlane(x: number, y: number, angle: number, size: number, alpha: number) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(angle);
      ctx!.globalAlpha = alpha;
      ctx!.fillStyle = dark ? 'rgba(241,245,249,0.95)' : 'rgba(255,255,255,0.98)';
      ctx!.strokeStyle = dark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.7)';
      ctx!.lineWidth = 1.2;
      ctx!.beginPath();
      ctx!.moveTo(size, 0);
      ctx!.lineTo(-size * 0.8, -size * 0.6);
      ctx!.lineTo(-size * 0.4, 0);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();
      ctx!.fillStyle = dark ? 'rgba(203,213,225,0.95)' : 'rgba(226,232,240,0.98)';
      ctx!.beginPath();
      ctx!.moveTo(size, 0);
      ctx!.lineTo(-size * 0.8, size * 0.35);
      ctx!.lineTo(-size * 0.4, 0);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();
      ctx!.restore();
    }

    function draw(now: number) {
      const t = reducedMotion ? startedAt : now;
      scrollNow = reducedMotion ? scrollTarget : scrollNow + (scrollTarget - scrollNow) * SCROLL_EASE;
      pointerX += (pointerTargetX - pointerX) * POINTER_EASE;
      pointerY += (pointerTargetY - pointerY) * POINTER_EASE;
      const lookX = reducedMotion ? 0 : pointerX * LOOK_PX[0];
      const lookY = reducedMotion ? 0 : pointerY * LOOK_PX[1];
      const intro = reducedMotion ? 1 : smooth(0, 1600, now - startedAt);
      const cameraZ = (reducedMotion ? 0 : (t - startedAt) * DRIFT) + scrollNow;

      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
      if (sky) {
        ctx!.fillStyle = sky;
        ctx!.fillRect(0, 0, width, height);
      } else {
        ctx!.clearRect(0, 0, width, height);
      }

      // Stars: bright in the dark, faint sparkles by day, none behind light content.
      if (dark || !quiet) {
        ctx!.fillStyle = dark ? '#fff' : `rgb(${brandTo.join(',')})`;
        const count = small ? STAR_COUNT / 2 : STAR_COUNT;
        for (let i = 0; i < count; i++) {
          const s = stars[i];
          const twinkle = 0.55 + 0.45 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
          ctx!.globalAlpha = intro * twinkle * (dark ? 0.85 : 0.22);
          ctx!.beginPath();
          ctx!.arc(s.x * width - lookX * 0.15, s.y * height - lookY * 0.15, s.size, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // Luna's moon, high on the right, barely moved by the pointer.
      if (moon) {
        ctx!.globalAlpha = intro * (quiet ? 0.6 : 1);
        const mx = width * (small ? 0.8 : 0.84) - lookX * 0.25;
        const my = height * 0.16 - lookY * 0.25;
        ctx!.drawImage(moon, mx - moon.width / 2, my - moon.height / 2);
      }

      // Clouds slide across at their own pace, wrapping around.
      for (const cloud of clouds) {
        const sprite = cloudSprites[cloud.sprite];
        if (!sprite) continue;
        const w = sprite.width * cloud.scale * (small ? 0.6 : 1);
        const h = sprite.height * cloud.scale * (small ? 0.6 : 1);
        const travel = width + w;
        const x = (((cloud.offset * travel + (t - startedAt) * cloud.speed * (reducedMotion ? 0 : 1) - lookX * 0.4) % travel) + travel) % travel - w;
        ctx!.globalAlpha = intro * (quiet ? 0.7 : 1);
        ctx!.drawImage(sprite, x, cloud.y * height - lookY * 0.4, w, h);
      }

      // Lanterns, far to near so the closer ones cover the farther.
      const visible: { x: number; y: number; r: number; alpha: number; color: number; flicker: number; depth: number }[] = [];
      const cx = width / 2;
      const cy = height * 0.48;
      for (const l of lanterns) {
        const depth = ((l.z - cameraZ) % DEPTH + DEPTH) % DEPTH + 40;
        const bob = Math.sin((t / l.bobPeriod) * Math.PI * 2 + l.bobPhase) * 14;
        const sway = Math.sin((t / l.swayPeriod) * Math.PI * 2 + l.bobPhase) * 18;
        const scale = focal / depth;
        const x = cx + (l.x + sway - lookX * 2) * scale;
        const y = cy + (l.y + bob - lookY * 2) * scale;
        const r = LANTERN_RADIUS * l.size * scale * (small ? 0.75 : 1);
        if (x < -r * 4 || x > width + r * 4 || y < -r * 4 || y > height + r * 4) continue;
        const alpha = intro * smooth(40, NEAR_FADE, depth) * (1 - smooth(DEPTH - FAR_FADE, DEPTH, depth));
        if (alpha <= 0.01) continue;
        const flicker = 0.88 + 0.12 * Math.sin(t / 170 + l.bobPhase * 7) * Math.sin(t / 290 + l.bobPhase);
        visible.push({ x, y, r, alpha, color: l.color, flicker, depth });
      }
      visible.sort((a, b) => b.depth - a.depth);
      for (const v of visible) drawLantern(v.x, v.y, v.r, v.alpha, v.color, v.flicker);

      // Fireflies wander near the bottom of the sky.
      if (fireflyGlow) {
        ctx!.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        const count = small ? FIREFLY_COUNT / 2 : FIREFLY_COUNT;
        for (let i = 0; i < count; i++) {
          const f = fireflies[i];
          const a = (t / f.period) * Math.PI * 2 + f.phase;
          const x = f.x * width + Math.sin(a) * f.rangeX + Math.sin(a * 2.3) * f.rangeX * 0.3 - lookX * 0.8;
          const y = f.y * height + Math.cos(a * 1.3) * f.rangeY - lookY * 0.8;
          const pulse = Math.max(0, Math.sin(a * 3.1 + f.phase));
          ctx!.globalAlpha = intro * (0.25 + 0.75 * pulse) * (dark ? 0.9 : 0.6);
          const s = f.size * (dark ? 14 : 10);
          ctx!.drawImage(fireflyGlow, x - s / 2, y - s / 2, s, s);
        }
        ctx!.globalCompositeOperation = 'source-over';
      }

      if (!reducedMotion) drawSurprises(now);
      ctx!.globalAlpha = 1;
      raf = reducedMotion ? 0 : requestAnimationFrame(draw);
    }

    function drawSurprises(now: number) {
      // Shooting star: a short bright streak across the upper sky.
      if (now >= nextMeteorAt && now - meteor.from > METEOR_MS) {
        const goingLeft = Math.random() < 0.5;
        meteor = {
          from: now,
          x: width * (goingLeft ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.4),
          y: height * (0.05 + Math.random() * 0.25),
          dx: (goingLeft ? -1 : 1) * width * (0.25 + Math.random() * 0.15),
          dy: height * (0.12 + Math.random() * 0.1),
        };
        nextMeteorAt = now + METEOR_MS + between(METEOR_GAP_MS, gap);
      }
      const mt = (now - meteor.from) / METEOR_MS;
      if (mt >= 0 && mt <= 1) {
        const head = smooth(0, 1, mt);
        const tail = Math.max(0, head - 0.25);
        const color = dark ? '255,255,255' : brandTo.join(',');
        const g = ctx!.createLinearGradient(
          meteor.x + meteor.dx * tail, meteor.y + meteor.dy * tail,
          meteor.x + meteor.dx * head, meteor.y + meteor.dy * head);
        g.addColorStop(0, `rgba(${color},0)`);
        g.addColorStop(1, `rgba(${color},${dark ? 0.95 : 0.7})`);
        ctx!.globalAlpha = Math.sin(mt * Math.PI);
        ctx!.strokeStyle = g;
        ctx!.lineWidth = 2;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(meteor.x + meteor.dx * tail, meteor.y + meteor.dy * tail);
        ctx!.lineTo(meteor.x + meteor.dx * head, meteor.y + meteor.dy * head);
        ctx!.stroke();
      }

      // Paper plane: glides across with one loop-the-loop somewhere along the way.
      if (now >= nextPlaneAt && now - plane.from > PLANE_MS) {
        plane = { from: now, direction: Math.random() < 0.5 ? 1 : -1, y: height * (0.25 + Math.random() * 0.4), loopAt: 0.35 + Math.random() * 0.3 };
        nextPlaneAt = now + PLANE_MS + between(PLANE_GAP_MS, gap);
      }
      const pt = (now - plane.from) / PLANE_MS;
      if (pt >= 0 && pt <= 1) {
        const size = small ? 14 : 20;
        const pos = (p: number) => {
          // The glide pauses while the plane flies one vertical circle around the loop point.
          const loopFrom = plane.loopAt - PLANE_LOOP / 2;
          const inLoop = Math.min(PLANE_LOOP, Math.max(0, p - loopFrom));
          const forward = (p - inLoop) / (1 - PLANE_LOOP);
          const angle = smooth(0, PLANE_LOOP, inLoop) * Math.PI * 2;
          const radius = small ? 32 : 46;
          const x = -60 + forward * (width + 120) + Math.sin(angle) * radius;
          const y = plane.y + Math.sin(forward * Math.PI * 2) * 18 - (1 - Math.cos(angle)) * radius;
          return { x: plane.direction === 1 ? x : width - x, y };
        };
        const a = pos(pt);
        const b = pos(Math.min(1, pt + 0.004));
        drawPlane(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), size, smooth(0, 0.05, pt) * (1 - smooth(0.95, 1, pt)) * (quiet ? 0.7 : 1));
      }

      // Unicorn: flies a gentle arc across the sky, leaving a fading rainbow behind.
      if (now >= nextUnicornAt && now - unicorn.from > UNICORN_MS) {
        unicorn = { from: now, direction: Math.random() < 0.5 ? 1 : -1, y: height * (0.18 + Math.random() * 0.25) };
        unicornTrail.length = 0;
        nextUnicornAt = now + UNICORN_MS + between(UNICORN_GAP_MS, gap);
      }
      const ut = (now - unicorn.from) / UNICORN_MS;
      if (ut >= 0 && ut <= 1.25) {
        const size = small ? 30 : 44;
        if (ut <= 1) {
          const along = -size * 2 + ut * (width + size * 4);
          const x = unicorn.direction === 1 ? along : width - along;
          const y = unicorn.y + Math.sin(ut * Math.PI) * -height * 0.08 + Math.sin(ut * Math.PI * 6) * 8;
          unicornTrail.push({ x, y });
          if (unicornTrail.length > 70) unicornTrail.shift();
        } else if (unicornTrail.length) {
          unicornTrail.shift(); // the rainbow drains away after the unicorn has gone
        }
        const fade = quiet ? 0.6 : 0.85;
        const band = small ? 3 : 4;
        ctx!.lineCap = 'round';
        ctx!.lineJoin = 'round';
        ctx!.globalAlpha = fade * 0.75;
        ctx!.lineWidth = band;
        RAINBOW.forEach((color, k) => {
          ctx!.strokeStyle = `rgb(${color})`;
          ctx!.beginPath();
          unicornTrail.forEach((p, i) => {
            const y = p.y + size * 0.15 + (k - 2.5) * band;
            if (i === 0) ctx!.moveTo(p.x, y); else ctx!.lineTo(p.x, y);
          });
          ctx!.stroke();
        });
        if (ut <= 1) {
          const head = unicornTrail[unicornTrail.length - 1];
          ctx!.save();
          ctx!.globalAlpha = (quiet ? 0.75 : 1) * smooth(0, 0.04, ut);
          ctx!.translate(head.x, head.y);
          // The emoji faces left; mirror it when it flies to the right.
          if (unicorn.direction === 1) ctx!.scale(-1, 1);
          ctx!.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
          ctx!.textAlign = 'center';
          ctx!.textBaseline = 'middle';
          ctx!.fillText('🦄', 0, 0);
          ctx!.restore();
        }
      }
      ctx!.lineCap = 'butt';
    }

    // Theme or dark mode can change without a reload (settings page), so watch for it.
    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (reducedMotion) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    resize();
    readTheme();
    readScroll();
    scrollNow = scrollTarget;
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', readScroll, { passive: true });
    if (!quiet) window.addEventListener('pointermove', onPointer, { passive: true });
    if (reducedMotion) draw(performance.now());
    else raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [scene, quiet]);

  // Fixed behind everything (negative z-index paints under the page's normal flow but over
  // the body's own background) and invisible to the pointer.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 w-full h-full -z-10 pointer-events-none ${quiet ? 'opacity-60' : ''}`}
    />
  );
}
