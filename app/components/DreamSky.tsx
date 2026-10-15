'use client';
import { useEffect, useMemo, useRef } from 'react';

// A twilight sky to sit behind the page: paper lanterns float past as you scroll (and drift
// slowly toward you even when you don't), fireflies wander, clouds slide by under Luna's
// moon, and now and then a shooting star, a paper plane or a unicorn with a rainbow
// trail crosses, and a ballerina dances along the bottom. Same approach as toni-develops.com's post galaxy and TrackThisRun's
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

// ---- The ballerina -------------------------------------------------------------------
// A little dancer in a tutu who crosses the bottom of the sky every so often: tiny bourrée
// steps, grand jetés, pirouettes and an arabesque glide, plus a few acrobatic tricks: an
// aerial (a no-handed cartwheel), a needle and a front tuck flip. Like TrackThisRun's runners
// she is posed afresh each frame from joint angles, but in 3D, so she can face the audience,
// turn to profile for a leap, spin on the spot and turn right over. Model units: +x is the way she travels, -y is
// up with the tips of her pointe shoes on y = 0, and +z is her right side.

type P3 = [number, number, number];
type Limb = [number, number, number, number]; // upper segment [swing, side], lower [swing, side]
// `pitch` turns her whole body head-over-heels forward (a flip), `roll` sideways in the
// plane she faces (a cartwheel); both about the hip.
type Pose = {
  lift: number; lean: number; facing: number; flare: number; pitch?: number; roll?: number;
  legs: [Limb, Limb]; arms: [Limb, Limb];
};
type Move = 'bourree' | 'jete' | 'pirouette' | 'arabesque' | 'aerial' | 'needle' | 'flip';
type Step = [Move, number]; // and how many ms it lasts

const THIGH = 19;
const SHIN = 22; // down to the tip of the pointe shoe
const HIP_Y = -(THIGH + SHIN);
const TORSO = 18;
const UPPER_ARM = 10.5;
const FOREARM = 10;
const FACING_AUDIENCE = Math.PI / 2; // travelling to her side, as dancers cross a stage
const NEUTRAL_LEG: Limb = [0, -0.05, 0, -0.05];
const ARMS_SECOND: Limb = [0.25, 1.15, 0.45, 0.95]; // out to the side, softly rounded
const ARMS_HIGH: Limb = [2.75, 0.35, 3.32, -0.74]; // fifth, curved over her head
const PASSE: Limb = [1.2, 0.6, -0.88, -0.71]; // toe drawn up to the other knee
const BALLERINA_BLEND_MS = 280; // one move melts into the next over this long
const BALLERINA_GAP_MS: [number, number] = [4000, 10000]; // after she has gone
// Now and then a little company dances the routine in canon, each a beat behind the one ahead,
// so the leaps and turns ripple down the line. They keep a set spacing too, so the line
// doesn't bunch up when the leader slows for a pirouette. Followers stand a step further back.
const TROUPE_CHANCE = 0.33;
const TROUPE_SIZE = 3;
const CANON_MS = 400;
const TROUPE_GAP = 52; // model units between one dancer and the next
type Dancer = { place: number; delay: number; scale: number; back: number; dress: [number, number, number] | null };
const SOLO: Dancer[] = [{ place: 0, delay: 0, scale: 1, back: 0, dress: null }];
const TROUPE_DRESSES: [number, number, number][] = [[186, 150, 255], [120, 214, 180], [255, 178, 102], [125, 190, 255]];
const SPARKLE_MS = 1000;
// Theatre follow-spots: a lamp hanging from the top edge for each dancer, switching on as the
// show starts and swinging to keep her in an oval of light on the floor.
const SPOT_X = [0.5, 0.2, 0.8]; // where each dancer's lamp hangs, as a share of the width
const SPOT_FADE_MS = 700;
// A few routines, so it isn't the same dance every time; the last is mostly acrobatics.
const DANCES: Step[][] = [
  [['bourree', 2000], ['jete', 1100], ['bourree', 1000], ['aerial', 1200], ['bourree', 1000],
    ['pirouette', 1700], ['bourree', 1100], ['arabesque', 1700], ['bourree', 1500]],
  [['bourree', 1800], ['needle', 2000], ['bourree', 1000], ['jete', 1100], ['bourree', 900],
    ['flip', 1200], ['bourree', 1200], ['pirouette', 1700], ['bourree', 1300]],
  [['bourree', 1600], ['aerial', 1200], ['bourree', 700], ['aerial', 1200], ['bourree', 900],
    ['needle', 2000], ['bourree', 900], ['flip', 1200], ['bourree', 1400]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  return a.map((v, i) => lerp(v, b[i], t)) as Limb;
}

// The short way round, so coming out of a double pirouette doesn't unwind it.
function lerpAngle(a: number, b: number, t: number): number {
  const d = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function blendPose(a: Pose, b: Pose, t: number): Pose {
  return {
    lift: lerp(a.lift, b.lift, t), lean: lerp(a.lean, b.lean, t), flare: lerp(a.flare, b.flare, t),
    facing: lerpAngle(a.facing, b.facing, t),
    pitch: lerpAngle(a.pitch ?? 0, b.pitch ?? 0, t), roll: lerpAngle(a.roll ?? 0, b.roll ?? 0, t),
    legs: [lerpLimb(a.legs[0], b.legs[0], t), lerpLimb(a.legs[1], b.legs[1], t)],
    arms: [lerpLimb(a.arms[0], b.arms[0], t), lerpLimb(a.arms[1], b.arms[1], t)],
  };
}

// `u` runs 0..1 through the move; `t` is the clock, for the quick bourrée flutter.
function dancePose(move: Move, u: number, t: number): Pose {
  switch (move) {
    case 'jete': {
      const split = Math.pow(Math.sin(Math.PI * u), 0.6);
      return {
        lift: Math.sin(Math.PI * u) * 16, lean: 0.12 * split, facing: 0, flare: 0.1 * split,
        legs: [[-1.3 * split, 0, -1.4 * split, 0], [1.5 * split, 0, 1.55 * split, 0]],
        arms: [lerpLimb(ARMS_SECOND, [2.2, 0.2, 2.35, 0.1], split), lerpLimb(ARMS_SECOND, [1.45, 1, 1.5, 0.9], split)],
      };
    }
    case 'pirouette': {
      const up = smooth(0, 0.15, u) * (1 - smooth(0.85, 1, u));
      return {
        lift: 1.5 * up, lean: 0, facing: FACING_AUDIENCE + smooth(0.1, 0.9, u) * Math.PI * 4, flare: 0.22 * up,
        legs: [[0, -0.03, 0, -0.03], lerpLimb(NEUTRAL_LEG, PASSE, up)],
        arms: [lerpLimb(ARMS_SECOND, ARMS_HIGH, up), lerpLimb(ARMS_SECOND, ARMS_HIGH, up)],
      };
    }
    case 'arabesque': {
      const hold = smooth(0, 0.2, u) * (1 - smooth(0.8, 1, u));
      return {
        lift: 0.5, lean: 0.35 * hold, facing: FACING_AUDIENCE * (1 - hold), flare: 0,
        legs: [[0, 0, 0, 0], lerpLimb(NEUTRAL_LEG, [-1.45, 0, -1.5, 0], hold)],
        arms: [lerpLimb(ARMS_SECOND, [1.9, 0.1, 1.95, 0.05], hold), lerpLimb(ARMS_SECOND, [1.3, 1.05, 1.25, 1], hold)],
      };
    }
    case 'aerial': {
      // Facing the audience, she whips over sideways with her legs in a wide straddle.
      const open = Math.sin(Math.PI * smooth(0.05, 0.95, u));
      return {
        lift: Math.sin(Math.PI * u) * 12, lean: 0, facing: FACING_AUDIENCE, flare: 0.2 * open,
        roll: smooth(0.1, 0.9, u) * Math.PI * 2,
        legs: [lerpLimb(NEUTRAL_LEG, [0, 0.75, 0, 0.75], open), lerpLimb(NEUTRAL_LEG, [0, 0.75, 0, 0.75], open)],
        arms: [lerpLimb(ARMS_SECOND, [0, 1.9, 0, 2.1], open), lerpLimb(ARMS_SECOND, [0, 1.9, 0, 2.1], open)],
      };
    }
    case 'needle': {
      // Chest folded down to the standing leg, the other kicked straight up behind.
      const hold = smooth(0, 0.25, u) * (1 - smooth(0.78, 1, u));
      return {
        lift: 0, lean: 2.3 * hold, facing: FACING_AUDIENCE * (1 - hold), flare: 0,
        legs: [[0, 0, 0, 0], lerpLimb(NEUTRAL_LEG, [-2.85, 0, -2.9, 0], hold)],
        arms: [lerpLimb(ARMS_SECOND, [3, 0.2, 3.15, 0.15], hold), lerpLimb(ARMS_SECOND, [3, 0.2, 3.15, 0.15], hold)],
      };
    }
    case 'flip': {
      // A front tuck: arms up to take off, knees hugged to her chest over the top.
      const tuck = smooth(0.1, 0.3, u) * (1 - smooth(0.7, 0.9, u));
      const reach = smooth(0, 0.12, u) * (1 - smooth(0.85, 1, u));
      const arm = lerpLimb(lerpLimb(ARMS_SECOND, ARMS_HIGH, reach), [1.4, 0.15, 0.6, 0.1], tuck);
      return {
        lift: Math.sin(Math.PI * u) * 24, lean: 0, facing: 0, flare: 0.15 * tuck,
        pitch: smooth(0.15, 0.85, u) * Math.PI * 2,
        legs: [lerpLimb(NEUTRAL_LEG, [2.1, 0, 0.15, 0], tuck), lerpLimb(NEUTRAL_LEG, [2.1, 0, 0.15, 0], tuck)],
        arms: [arm, arm],
      };
    }
    default: {
      // Bourrée: tiny quick steps on pointe, feet crossed close together.
      const step = Math.sin(t / 45);
      const flutter = Math.sin(t / 400) * 0.05;
      return {
        lift: 0.4 * Math.abs(step), lean: 0, facing: FACING_AUDIENCE, flare: 0,
        legs: [
          [0.06 * step, -0.05, 0.06 * step - 0.12 * Math.max(0, step), -0.05],
          [-0.06 * step, -0.05, -0.06 * step - 0.12 * Math.max(0, -step), -0.05],
        ],
        arms: [[ARMS_SECOND[0] + flutter, ...ARMS_SECOND.slice(1)] as Limb, [ARMS_SECOND[0] - flutter, ...ARMS_SECOND.slice(1)] as Limb],
      };
    }
  }
}

// How far a move carries her, in ms of plain bourrée travel: a jeté surges forward, a
// pirouette nearly stops, and every move starts and ends at the same speed so nothing jerks.
function danceDistance(move: Move, u: number): number {
  const surge = { bourree: 0, jete: 1.4, pirouette: -0.9, arabesque: -0.3, aerial: 0.6, needle: -0.9, flip: 0.8 }[move];
  return u + (surge * (1 - Math.cos(Math.PI * u))) / Math.PI;
}

function limbDir(swing: number, side: number, z: number): P3 {
  return [Math.sin(swing) * Math.cos(side), Math.cos(swing) * Math.cos(side), Math.sin(side) * z];
}

function buildDancer(pose: Pose) {
  const hipY = HIP_Y - pose.lift;
  const reach = (from: P3, dir: P3, length: number): P3 =>
    [from[0] + dir[0] * length, from[1] + dir[1] * length, from[2] + dir[2] * length];
  const legs = pose.legs.map((l, i) => {
    const z = i === 0 ? -1 : 1;
    const top: P3 = [0, hipY, 3.2 * z];
    const knee = reach(top, limbDir(l[0], l[1], z), THIGH);
    return [top, knee, reach(knee, limbDir(l[2], l[3], z), SHIN)];
  });
  // The upper body is built upright, then tipped forward about the hip by `lean`.
  const c = Math.cos(pose.lean);
  const s = Math.sin(pose.lean);
  const upper = ([x, y, z]: P3): P3 => [x * c - y * s, hipY + x * s + y * c, z];
  const arms = pose.arms.map((a, i) => {
    const z = i === 0 ? -1 : 1;
    const shoulder: P3 = [0, -TORSO, 5.5 * z];
    const elbow = reach(shoulder, limbDir(a[0], a[1], z), UPPER_ARM);
    return [shoulder, elbow, reach(elbow, limbDir(a[2], a[3], z), FOREARM)].map(upper);
  });
  // Then the whole of her turns about the hip: head over heels for a flip, sideways for an
  // aerial (her head leads the way she is travelling in both).
  const cp = Math.cos(pose.pitch ?? 0);
  const sp = Math.sin(pose.pitch ?? 0);
  const cr = Math.cos(pose.roll ?? 0);
  const sr = Math.sin(pose.roll ?? 0);
  const turn = ([x, y, z]: P3): P3 => {
    const dy = y - hipY;
    const px = x * cp - dy * sp;
    const py = x * sp + dy * cp;
    return [px, hipY + py * cr + z * sr, -py * sr + z * cr];
  };
  return {
    legs: legs.map(l => l.map(turn)), arms: arms.map(a => a.map(turn)),
    waist: turn(upper([0, -3, 0])), chest: turn(upper([0, -15, 0])), neck: turn(upper([0, -TORSO - 3, 0])),
    head: turn(upper([0.6, -TORSO - 7.4, 0])), bun: turn(upper([-2.2, -TORSO - 11, 0])), tutu: turn(upper([0, -1.5, 0])),
  };
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
    let ballerina = { from: -1e9, direction: 1, dance: DANCES[0], ms: 0, distance: 1, troupe: SOLO };
    let nextBallerinaAt = startedAt + between([3000, 6000], gap);
    const sparkles: { x: number; y: number; born: number; size: number }[] = [];
    let lastSparkleAt = 0;

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
      // The ballerina (or a little troupe) dances across the bottom of the sky, then rests a while.
      if (now >= nextBallerinaAt && now - ballerina.from > ballerina.ms) {
        const dance = DANCES[Math.floor(Math.random() * DANCES.length)];
        const dresses = [...TROUPE_DRESSES].sort(() => Math.random() - 0.5);
        const troupe: Dancer[] = Math.random() < TROUPE_CHANCE
          ? Array.from({ length: TROUPE_SIZE }, (_, k) => ({
            place: k, delay: k * CANON_MS, scale: 1 - k * 0.07, back: k * 6, dress: k === 0 ? null : dresses[k - 1],
          }))
          : SOLO;
        const ms = dance.reduce((sum, [, stepMs]) => sum + stepMs, 0);
        ballerina = {
          from: now, direction: Math.random() < 0.5 ? 1 : -1, dance, troupe,
          ms: ms + troupe[troupe.length - 1].delay,
          distance: dance.reduce((sum, [move, stepMs]) => sum + stepMs * danceDistance(move, 1), 0),
        };
        nextBallerinaAt = now + ballerina.ms + between(BALLERINA_GAP_MS, gap);
      }
      const showTime = now - ballerina.from;
      if (showTime >= 0 && showTime <= ballerina.ms) {
        const danceMs = ballerina.ms - ballerina.troupe[ballerina.troupe.length - 1].delay;
        const lights = smooth(0, SPOT_FADE_MS, showTime) * (1 - smooth(ballerina.ms - SPOT_FADE_MS, ballerina.ms, showTime));
        // Lights first, so every dancer stands in front of every beam.
        for (const dancer of ballerina.troupe) {
          const bt = Math.min(danceMs, Math.max(0, showTime - dancer.delay));
          drawSpotlight(placeDancer(now, bt, dancer), dancer, lights);
        }
        // The ones further back first, so the leader is drawn in front.
        for (let k = ballerina.troupe.length - 1; k >= 0; k--) {
          const dancer = ballerina.troupe[k];
          const bt = showTime - dancer.delay;
          if (bt >= 0 && bt <= danceMs) drawBallerina(now, bt, dancer);
        }
      }
      drawSparkles(now);
      ctx!.lineCap = 'butt';
      ctx!.lineJoin = 'miter';
    }

    // Where a dancer is and how she stands, `elapsed` ms into her routine.
    function placeDancer(now: number, elapsed: number, member: Dancer) {
      // Which move she is in, how far into it, and how far she has travelled so far.
      let start = 0;
      let travelled = 0;
      let index = 0;
      while (index < ballerina.dance.length - 1 && elapsed > start + ballerina.dance[index][1]) {
        const [move, ms] = ballerina.dance[index];
        start += ms;
        travelled += ms * danceDistance(move, 1);
        index++;
      }
      const [move, ms] = ballerina.dance[index];
      const into = elapsed - start;
      const u = Math.min(1, into / ms);
      travelled += ms * danceDistance(move, u);
      let pose = dancePose(move, u, now);
      if (index > 0 && into < BALLERINA_BLEND_MS) {
        pose = blendPose(dancePose(ballerina.dance[index - 1][0], 1, now), pose, smooth(0, BALLERINA_BLEND_MS, into));
      }

      const size = (small ? 1 : 1.3) * member.scale;
      const margin = 40 * size;
      const trail = member.place * TROUPE_GAP * size; // how far this one follows the leader
      const along = -margin - trail + (travelled / ballerina.distance) * (width + margin * 2 + trail);
      const footX = ballerina.direction === 1 ? along : width - along;
      const floorY = height - (small ? 16 : 26) - member.back;
      return { pose, size, footX, floorY };
    }

    // A follow-spot: the lamp hanging from the top edge and aimed at her, a cone of light, and
    // an oval pool on the floor that stays put when she leaps up out of it.
    function drawSpotlight({ size, footX, floorY }: { size: number; footX: number; floorY: number }, member: Dancer, lights: number) {
      const lampX = width * SPOT_X[member.place % SPOT_X.length];
      const lampY = small ? 16 : 22;
      const aim = Math.atan2(floorY - lampY, footX - lampX);
      const lensX = lampX + Math.cos(aim) * 13;
      const lensY = lampY + Math.sin(aim) * 13;
      const poolX = 34 * size;
      const poolY = 7 * size;
      const tint = member.dress ? mix(member.dress, [255, 255, 255], 0.75) : 'rgb(255,244,214)';
      const light = tint.slice(4, -1); // "r,g,b"
      const fade = lights * (quiet ? 0.6 : 1);

      // The beam: lens to the edges of the pool, brightest at the lamp.
      ctx!.save();
      ctx!.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const beam = ctx!.createLinearGradient(lensX, lensY, footX, floorY);
      beam.addColorStop(0, `rgba(${light},${(dark ? 0.22 : 0.4) * fade})`);
      beam.addColorStop(1, `rgba(${light},${(dark ? 0.06 : 0.12) * fade})`);
      ctx!.fillStyle = beam;
      ctx!.beginPath();
      ctx!.moveTo(lensX - Math.sin(aim) * 4, lensY + Math.cos(aim) * 4);
      ctx!.lineTo(lensX + Math.sin(aim) * 4, lensY - Math.cos(aim) * 4);
      ctx!.lineTo(footX + poolX, floorY);
      ctx!.lineTo(footX - poolX, floorY);
      ctx!.closePath();
      ctx!.fill();

      // The pool of light on the floor.
      ctx!.translate(footX, floorY);
      ctx!.scale(1, poolY / poolX);
      const pool = ctx!.createRadialGradient(0, 0, 0, 0, 0, poolX);
      pool.addColorStop(0, `rgba(${light},${(dark ? 0.5 : 0.95) * fade})`);
      pool.addColorStop(0.7, `rgba(${light},${(dark ? 0.3 : 0.6) * fade})`);
      pool.addColorStop(1, `rgba(${light},0)`);
      ctx!.fillStyle = pool;
      ctx!.beginPath();
      ctx!.arc(0, 0, poolX, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // The lamp: a short hanger, then a can turned to aim at her, with a glowing lens.
      ctx!.save();
      ctx!.globalAlpha = smooth(0, 0.3, lights) * (quiet ? 0.7 : 1);
      ctx!.strokeStyle = dark ? 'rgb(120,116,150)' : 'rgb(90,80,110)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(lampX, 0);
      ctx!.lineTo(lampX, lampY);
      ctx!.stroke();
      ctx!.translate(lampX, lampY);
      ctx!.rotate(aim);
      ctx!.fillStyle = dark ? 'rgb(70,66,96)' : 'rgb(74,64,92)';
      ctx!.beginPath();
      ctx!.roundRect(-9, -6, 20, 12, 3);
      ctx!.fill();
      ctx!.fillRect(10, -7.5, 3, 15); // the barrel's rim
      ctx!.fillStyle = `rgba(${light},${0.4 + 0.6 * lights})`;
      ctx!.beginPath();
      ctx!.ellipse(13.5, 0, 2, 6, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
    }

    function drawBallerina(now: number, elapsed: number, member: Dancer) {
      const { pose, size, footX, floorY } = placeDancer(now, elapsed, member);
      const cosF = Math.cos(pose.facing);
      const sinF = Math.sin(pose.facing);
      const project = ([x, y, z]: P3) => ({
        x: footX + ballerina.direction * (x * cosF + z * sinF) * size,
        y: floorY + y * size,
        z: -x * sinF + z * cosF, // bigger is farther from the viewer
      });
      const dancer = buildDancer(pose);
      const legs = dancer.legs.map(l => l.map(project));
      const arms = dancer.arms.map(a => a.map(project));
      const depth = (points: { z: number }[]) => points.reduce((sum, p) => sum + p.z, 0) / points.length;
      const fade = (quiet ? 0.75 : 1) * (1 - member.back * 0.015);

      const skin = dark ? 'rgb(255,232,242)' : mix(brandTo, [40, 20, 60], 0.5);
      const dressBase = member.dress ?? brandFrom;
      const dress = `rgb(${dressBase.join(',')})`;
      const dressLight = mix(dressBase, [255, 255, 255], 0.5);
      const dressDeep = mix(dressBase, [40, 10, 50], 0.3);

      // A soft shadow at her feet inside the spotlight, shrinking as she leaves the ground.
      const ground = 1 - Math.min(1, pose.lift / 40) * 0.5;
      ctx!.save();
      ctx!.translate(footX, floorY + 1);
      ctx!.scale(1, 0.2);
      const poolRadius = 20 * size * ground;
      const pool = ctx!.createRadialGradient(0, 0, 0, 0, 0, poolRadius);
      const poolColor = dark ? '20,10,40' : '60,30,80';
      pool.addColorStop(0, `rgba(${poolColor},${(dark ? 0.4 : 0.18) * fade})`);
      pool.addColorStop(1, `rgba(${poolColor},0)`);
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = pool;
      ctx!.beginPath();
      ctx!.arc(0, 0, poolRadius, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      ctx!.save();
      ctx!.globalAlpha = fade;
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';
      if (dark) {
        ctx!.shadowColor = `rgba(${brandFrom.join(',')},0.8)`;
        ctx!.shadowBlur = 10;
      }
      const stroke = (points: { x: number; y: number }[], lineWidth: number, color: string) => {
        ctx!.strokeStyle = color;
        ctx!.lineWidth = lineWidth * size;
        ctx!.beginPath();
        points.forEach((p, i) => (i === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)));
        ctx!.stroke();
      };
      const dot = (p: { x: number; y: number }, r: number, color: string) => {
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r * size, 0, Math.PI * 2);
        ctx!.fill();
      };

      // Back to front: arms behind her body, legs, tutu, body and head, then the near arms.
      const armOrder = [0, 1].sort((a, b) => depth(arms[b]) - depth(arms[a]));
      const behind = armOrder.filter(i => depth(arms[i]) > 1);
      const before = armOrder.filter(i => depth(arms[i]) <= 1);
      for (const i of behind) stroke(arms[i], 1.8, skin);
      for (const i of [0, 1].sort((a, b) => depth(legs[b]) - depth(legs[a]))) stroke(legs[i], 2.6, skin);

      // The tutu: a flat disc of net with a scalloped edge that turns as she turns.
      const tutu = project(dancer.tutu);
      ctx!.save();
      ctx!.translate(tutu.x, tutu.y);
      // Tipped with her hips: a lean or flip shows side-on, a cartwheel face-on.
      ctx!.rotate(ballerina.direction * (((pose.pitch ?? 0) + pose.lean * 0.7) * cosF + (pose.roll ?? 0) * sinF));
      const rx = 14 * size * (1 + pose.flare);
      const ry = 3.4 * size * (1 + pose.flare * 0.5);
      ctx!.fillStyle = dressDeep;
      ctx!.beginPath();
      ctx!.ellipse(0, size, rx, ry, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = dressLight;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + pose.facing * ballerina.direction;
        ctx!.beginPath();
        ctx!.arc(Math.cos(a) * rx, Math.sin(a) * ry + 0.6 * size, 2.4 * size * (1 + pose.flare * 0.5), 0, Math.PI * 2);
        ctx!.fill();
      }
      const net = ctx!.createLinearGradient(0, -ry, 0, ry);
      net.addColorStop(0, dressLight);
      net.addColorStop(1, dress);
      ctx!.fillStyle = net;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // Bodice in the tutu's colour, then neck, head and the bun on top.
      const shoulders = [arms[0][0], arms[1][0]];
      stroke([project(dancer.waist), project(dancer.chest)], 6, dress);
      stroke(shoulders, 2.6, dress);
      stroke([project(dancer.chest), project(dancer.neck)], 2, skin);
      const head = project(dancer.head);
      const bun = project(dancer.bun);
      if (bun.z > head.z) dot(bun, 2.4, skin);
      dot(head, 4.4, skin);
      if (bun.z <= head.z) dot(bun, 2.4, skin);
      for (const i of before) stroke(arms[i], 1.8, skin);
      ctx!.restore();

      // Sparkles shake off her toes while she leaps and spins.
      if ((pose.lift > 6 || pose.flare > 0.05) && now - lastSparkleAt > 70) {
        lastSparkleAt = now;
        for (const leg of legs) {
          const toe = leg[2];
          sparkles.push({ x: toe.x + (Math.random() - 0.5) * 6, y: toe.y, born: now, size: (2 + Math.random() * 2.5) * size });
        }
        if (sparkles.length > 120) sparkles.splice(0, sparkles.length - 120);
      }
    }

    // A four-pointed twinkle for each sparkle, rising a little as it fades.
    function drawSparkles(now: number) {
      while (sparkles.length && now - sparkles[0].born > SPARKLE_MS) sparkles.shift();
      if (!sparkles.length) return;
      ctx!.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx!.fillStyle = dark ? 'rgb(255,240,200)' : `rgb(${brandTo.join(',')})`;
      for (const s of sparkles) {
        const age = (now - s.born) / SPARKLE_MS;
        const x = s.x;
        const y = s.y - age * 14;
        const r = s.size * (1 - age * 0.5);
        ctx!.globalAlpha = (1 - age) * (quiet ? 0.6 : 0.9);
        ctx!.beginPath();
        ctx!.moveTo(x, y - r);
        ctx!.quadraticCurveTo(x, y, x + r, y);
        ctx!.quadraticCurveTo(x, y, x, y + r);
        ctx!.quadraticCurveTo(x, y, x - r, y);
        ctx!.quadraticCurveTo(x, y, x, y - r);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = 'source-over';
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
