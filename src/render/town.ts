// Each city as a top-down pixel-art town, painted by code (an original layout and buildings made for this game, in
// the spirit of the handheld RPG towns): a forest edge, a row of buildings (houses, the Pokémon Center, the Mart,
// the gym and the city's landmark) along the main road, and gardens, ponds, the sea or tall grass below. 480×270 art
// pixels. It is the city's backdrop in the menus: the main row of buildings sits in the top band, which the city
// screen's cards leave visible.

import { townPlan, type TownFeature, type TownPlan } from '../data/regions';
import { landmarkOf, paintLandmark } from './landmarks';
import { bayer, clumps, hash, mix, noise, Pixels, rgb, seeded, smooth, tone, type Ball, type RGB } from './pixel';

const W = 480;
const H = 270;
/** Where the main row of buildings stands (their doors), just above the city screen's cards. */
const ROW_A = 98;
const ROAD_TOP = 104;
const ROAD_BOTTOM = 126;
/** The second row, mostly behind the cards. */
const ROW_B = 196;

// ── Each city ────────────────────────────────────────────────────────────────────────────────────────────────────
// What each town looks like is its region's data (TownPlan in data/regions/types.ts); here, how to paint it.

type Feature = TownFeature;

interface Light {
  /** Multiplies every color (dusk, night); null in daylight. */
  tint: [number, number, number] | null;
  /** Windows and lamps are lit. */
  lit: boolean;
}

type Plan = Omit<TownPlan, 'light'> & { light: Light };

const LIGHTS: Record<TownPlan['light'], Light> = {
  day: { tint: null, lit: false },
  sunset: { tint: [1.03, 0.93, 0.84], lit: true },
  dusk: { tint: [0.68, 0.6, 0.92], lit: true },
  night: { tint: [0.42, 0.48, 0.86], lit: true },
};

const FALLBACK: TownPlan = { ground: 'grass', row: ['house', 'center', 'mart', 'house'], water: [], light: 'day' };

function planOf(placeId: string): Plan {
  const plan = townPlan(placeId) ?? FALLBACK;
  return { ...plan, light: LIGHTS[plan.light] };
}

const cache = new Map<string, HTMLCanvasElement>();

/** The city's picture (painted once, then reused). A League and a sanctuary have their own (render/landmarks.ts). */
export function townPicture(cityId: string): HTMLCanvasElement {
  let canvas = cache.get(cityId);
  if (!canvas) {
    const landmark = landmarkOf(cityId);
    canvas = (landmark ? paintLandmark(landmark) : paintTown(cityId)).toCanvas();
    cache.set(cityId, canvas);
  }
  return canvas;
}

/** The picture as an image URL (for the menus' backdrop). */
export const townUrl = (cityId: string) => townPicture(cityId).toDataURL('image/png');

// ── Palette ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Palette {
  /** dark, base, light, and the darkest (outlines of grass). */
  grass: [RGB, RGB, RGB, RGB];
  path: [RGB, RGB, RGB];
  plaza: [RGB, RGB, RGB];
  water: [RGB, RGB, RGB, RGB];
  sand: [RGB, RGB, RGB];
  leaves: RGB[];
  leafLine: RGB;
}

function paletteOf(plan: Plan): Palette {
  const grass = rgb(plan.grass ?? (plan.ground === 'rock' ? '#a2a06a' : plan.ground === 'sand' ? '#9bc25a' : plan.ground === 'snow' ? '#dfe8f4' : '#68b850'));
  const leaves = rgb(plan.ground === 'rock' ? '#4f8a48' : plan.ground === 'sand' ? '#4fa04a' : plan.ground === 'snow' ? '#2f6a5a' : '#3f9a48');
  return {
    grass: [tone(grass, -0.22), grass, tone(grass, 0.22), tone(grass, -0.45)],
    path: plan.ground === 'rock' ? [rgb('#9c8a70'), rgb('#c9b796'), rgb('#e0d2b4')] : [rgb('#b88f5a'), rgb('#dcc08a'), rgb('#efdcae')],
    plaza: plan.ground === 'paved' ? [rgb('#8a8c96'), rgb('#bfc2c8'), rgb('#dfe1e6')] : [rgb('#8f8aa0'), rgb('#c9c5d4'), rgb('#e6e3ee')],
    water: [rgb('#2a5fb8'), rgb('#3f86e0'), rgb('#7cbcf4'), rgb('#e8f6ff')],
    sand: [rgb('#d8bc80'), rgb('#efd9a2'), rgb('#fbeccb')],
    leaves: [tone(leaves, -0.38), tone(leaves, -0.12), leaves, tone(leaves, 0.2), tone(leaves, 0.42)],
    leafLine: tone(leaves, -0.62),
  };
}

// ── The ground ───────────────────────────────────────────────────────────────────────────────────────────────────

const enum K {
  Grass,
  Path,
  Plaza,
  Water,
  Sand,
  Tall,
  Rock,
}

class Ground2 {
  readonly kind = new Uint8Array(W * H);
  fill(x: number, y: number, w: number, h: number, k: K) {
    for (let j = Math.max(0, Math.floor(y)); j < Math.min(H, y + h); j++) for (let i = Math.max(0, Math.floor(x)); i < Math.min(W, x + w); i++) this.kind[j * W + i] = k;
  }
  at(x: number, y: number): K {
    if (x < 0 || y < 0 || x >= W || y >= H) return -1 as K;
    return this.kind[y * W + x] as K;
  }
}

/** Tall grass, a 6×6 tuft repeated (light tips, darker roots). */
function tallGrass(x: number, y: number, pal: Palette): RGB {
  const row = Math.floor(y / 6);
  const lx = (x + (row % 2) * 3) % 6;
  const ly = y % 6;
  const [dark, base, light, deepest] = pal.grass;
  if (ly === 0) return lx === 1 || lx === 4 ? light : dark;
  if (ly === 1) return lx === 1 || lx === 4 ? base : lx === 2 || lx === 5 ? dark : light;
  if (ly < 4) return lx === 2 || lx === 5 ? deepest : base;
  return dark;
}

function paintGround(p: Pixels, g: Ground2, pal: Palette, seed: number) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = g.at(x, y);
      let c: RGB;
      switch (k) {
        case K.Grass:
        case K.Rock: {
          const [dark, base, light] = pal.grass;
          // Big soft patches of lighter grass, dithered at their edges.
          const patch = smooth(x, y, 40, seed) * 0.65 + smooth(x, y, 14, seed + 1) * 0.35;
          c = patch > 0.62 + (bayer(x, y) - 0.5) * 0.12 ? mix(base, light, 0.35) : base;
          // A tuft in some 8×8 cells: two blades and a lit tip.
          const cell = noise(x >> 3, y >> 3, seed + 2);
          if (cell < 0.5) {
            const ox = 1 + Math.floor(cell * 10);
            const oy = 2 + Math.floor(cell * 7) % 4;
            const lx = (x & 7) - ox;
            const ly = (y & 7) - oy;
            if ((ly === 0 && (lx === 0 || lx === 2)) || (ly === 1 && lx === 1)) c = dark;
            if (ly === -1 && lx === 1) c = light;
          }
          if (k === K.Rock && noise(x, y, seed + 3) > 0.985) c = rgb('#8a8378');
          break;
        }
        case K.Tall:
          c = tallGrass(x, y, pal);
          break;
        case K.Path: {
          const [dark, base, light] = pal.path;
          c = noise(x >> 2, y >> 2, seed + 4) > 0.8 ? mix(base, dark, 0.18) : base;
          if (noise(x, y, seed + 5) > 0.975) c = light;
          else if (noise(x, y - 1, seed + 5) > 0.975) c = dark;
          break;
        }
        case K.Plaza: {
          const [dark, base, light] = pal.plaza;
          const row = Math.floor(y / 8);
          const lx = (x + (row % 2) * 6) % 12;
          const ly = y % 8;
          c = ly === 0 || lx === 0 ? dark : ly === 1 || lx === 1 ? light : noise(Math.floor((x + (row % 2) * 6) / 12), row, seed) > 0.7 ? mix(base, dark, 0.12) : base;
          break;
        }
        case K.Water: {
          const [deep, base, light] = pal.water;
          // Deeper (darker) further down, dithered between the two tones.
          c = bayer(x, y) < (y / H) * 0.7 ? mix(base, deep, 0.45) : base;
          // Little wave crests, in staggered rows.
          const band = y % 8;
          const shift = (Math.floor(y / 8) % 2) * 8;
          const crest = noise((x + shift) >> 4, Math.floor(y / 8), seed + 7) > 0.45;
          const lx = (x + shift) & 15;
          if (crest && band === 0 && lx > 3 && lx < 10) c = light;
          if (crest && band === 1 && (lx === 3 || lx === 10)) c = mix(base, light, 0.5);
          break;
        }
        case K.Sand: {
          const [dark, base, light] = pal.sand;
          c = noise(x, y, seed + 8) > 0.94 ? dark : noise(x, y, seed + 9) > 0.95 ? light : base;
          break;
        }
        default:
          c = 0;
      }
      p.set(x, y, c);
    }
  }
  // Edges: a darker rim along paths, foam and a lighter band along the shore, a dark bank on the land side.
  const isLand = (k: K) => k !== K.Water;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = g.at(x, y);
      const n = [g.at(x - 1, y), g.at(x + 1, y), g.at(x, y - 1), g.at(x, y + 1)];
      const near = (test: (k: K) => boolean) => n.some(m => (m as number) >= 0 && test(m));
      if (k === K.Path && near(m => m === K.Grass || m === K.Tall || m === K.Rock)) p.set(x, y, pal.path[0]);
      if (k === K.Plaza && near(m => m !== K.Plaza)) p.set(x, y, pal.plaza[0]);
      if (k === K.Water) {
        if (near(isLand)) p.set(x, y, pal.water[3]);
        else if ([g.at(x - 2, y), g.at(x + 2, y), g.at(x, y - 2), g.at(x, y + 2)].some(m => (m as number) >= 0 && isLand(m))) p.set(x, y, pal.water[2]);
      } else if (near(m => m === K.Water) && k !== K.Sand) p.set(x, y, tone(pal.grass[0], -0.35));
      // Grass beside tall grass: a dark line where the tall blades start.
      if (k === K.Grass && g.at(x, y + 1) === K.Tall) p.set(x, y, pal.grass[3]);
    }
  }
}

// ── Things on the ground ─────────────────────────────────────────────────────────────────────────────────────────

const SHADOW = 0x1a1430;

interface Thing {
  /** Drawn back to front, by this line (where it touches the ground). */
  base: number;
  shadow?: (p: Pixels) => void;
  draw: (p: Pixels) => void;
}

function tree(x: number, base: number, pal: Palette, size = 1): Thing {
  const s = size;
  const balls: Ball[] = [
    { x: x - 6 * s, y: base - 14 * s, r: 7 * s },
    { x: x + 6 * s, y: base - 14 * s, r: 7 * s },
    { x: x, y: base - 21 * s, r: 8 * s },
    { x: x, y: base - 12 * s, r: 7.5 * s },
  ];
  return {
    base,
    shadow: p => p.oval(x + 3, base - 1, 12 * s, 4 * s, SHADOW, 0.32),
    draw: p => {
      // The trunk, lit on the left.
      for (let j = 0; j < 7 * s; j++) {
        for (let i = -2; i < 2; i++) p.set(x + i, base - 1 - j, i < 0 ? rgb('#8a5a32') : rgb('#5e3a22'));
      }
      p.set(x - 3, base - 1, rgb('#4a2c1a'));
      p.set(x + 2, base - 1, rgb('#4a2c1a'));
      clumps(p, balls, pal.leaves, pal.leafLine);
    },
  };
}

function bush(x: number, base: number, pal: Palette, flowers?: RGB): Thing {
  const balls: Ball[] = [
    { x: x - 4, y: base - 5, r: 5 },
    { x: x + 4, y: base - 5, r: 5 },
    { x, y: base - 7, r: 5 },
  ];
  return {
    base,
    shadow: p => p.oval(x + 2, base, 9, 2.5, SHADOW, 0.3),
    draw: p => {
      clumps(p, balls, pal.leaves, pal.leafLine);
      if (flowers) {
        for (const [dx, dy] of [[-5, -7], [3, -9], [5, -4], [-1, -4], [-3, -10]]) {
          p.set(x + dx, base + dy, flowers);
          p.set(x + dx + 1, base + dy, tone(flowers, 0.4));
        }
      }
    },
  };
}

function boulder(x: number, base: number, size = 1): Thing {
  const stone = [rgb('#6c6676'), rgb('#8e8898'), rgb('#aaa4b2'), rgb('#c8c3cf'), rgb('#e2dee8')];
  return {
    base,
    shadow: p => p.oval(x + 2, base, 9 * size, 3 * size, SHADOW, 0.3),
    draw: p => clumps(p, [{ x: x - 2 * size, y: base - 5 * size, r: 6 * size }, { x: x + 4 * size, y: base - 4 * size, r: 4.5 * size }], stone, rgb('#3e3848')),
  };
}

function flowerBed(p: Pixels, x: number, y: number, w: number, colors: RGB[], seed: number) {
  for (let i = 0; i < w; i += 4) {
    for (const dy of [0, 4]) {
      const c = colors[Math.floor(noise(x + i, y + dy, seed) * colors.length)];
      const fx = x + i + (dy ? 2 : 0);
      p.set(fx, y + dy, c);
      p.set(fx + 1, y + dy, tone(c, 0.35));
      p.set(fx, y + dy + 1, tone(c, -0.3));
      p.set(fx + 1, y + dy + 1, rgb('#3b7a2e'));
    }
  }
}

function fence(p: Pixels, x: number, y: number, w: number) {
  const white = rgb('#f4f1ea');
  const shade = rgb('#b9b2c4');
  const line = rgb('#4a4458');
  for (let i = 0; i <= w; i++) {
    p.set(x + i, y - 6, line);
    p.set(x + i, y - 5, white);
    p.set(x + i, y - 4, shade);
    p.set(x + i, y - 3, line);
  }
  for (let i = 0; i <= w; i += 8) {
    for (let j = -9; j <= 0; j++) {
      p.set(x + i - 1, y + j, line);
      p.set(x + i, y + j, j === -9 ? line : white);
      p.set(x + i + 1, y + j, j === -9 ? line : shade);
      p.set(x + i + 2, y + j, line);
    }
    p.blendRect(x + i, y + 1, 4, 1, SHADOW, 0.3);
  }
}

function lamp(x: number, base: number, lights: Glow[]): Thing {
  return {
    base,
    shadow: p => p.blendRect(x + 1, base, 6, 2, SHADOW, 0.3),
    draw: p => {
      const post = rgb('#3a3d56');
      p.rect(x, base - 18, 2, 18, post);
      p.set(x, base - 18, tone(post, 0.4));
      p.rect(x - 2, base - 23, 6, 5, rgb('#2a2c40'));
      p.rect(x - 1, base - 22, 4, 3, rgb('#fff1b8'));
      p.rect(x - 1, base - 1, 4, 1, post);
      lights.push({ x: x + 1, y: base - 21, r: 16 });
    },
  };
}

function sign(x: number, base: number): Thing {
  return {
    base,
    shadow: p => p.blendRect(x + 1, base, 11, 2, SHADOW, 0.3),
    draw: p => {
      const wood = rgb('#b07a42');
      p.rect(x + 4, base - 6, 2, 6, rgb('#6a4424'));
      p.rect(x, base - 13, 11, 8, rgb('#4a2c1a'));
      p.rect(x + 1, base - 12, 9, 6, wood);
      p.rect(x + 1, base - 12, 9, 1, tone(wood, 0.35));
      p.rect(x + 3, base - 10, 5, 1, tone(wood, -0.4));
      p.rect(x + 3, base - 8, 4, 1, tone(wood, -0.4));
    },
  };
}

// ── Buildings ────────────────────────────────────────────────────────────────────────────────────────────────────

interface Glow {
  x: number;
  y: number;
  r: number;
}

interface Window {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BuildingStyle {
  w: number;
  wall: number;
  roof: number;
  roofColor: RGB;
  wallColor: RGB;
  door?: 'wood' | 'glass' | 'double' | 'arch';
  /** Window columns (left and right of the door). */
  windows?: number;
  chimney?: boolean;
  /** Flat roof (a tall building seen from above) instead of a sloped one. */
  flat?: boolean;
  /** Floors of windows (tall buildings). */
  floors?: number;
  sign?: 'center' | 'mart' | 'gym' | 'league';
}

const OUTLINE = 0x2a2238;

function building(x: number, base: number, s: BuildingStyle, windowsLit: Window[]): Thing {
  const top = base - s.wall - s.roof;
  const wallTop = base - s.wall;
  return {
    base,
    shadow: p => {
      // Cast to the bottom-right (light from the top-left).
      p.blendRect(x + s.w + 3, top + 6, 6, base - top - 4, SHADOW, 0.3);
      p.blendRect(x + 2, base, s.w + 7, 4, SHADOW, 0.3);
    },
    draw: p => {
      // The walls: lit on the left, a plank line every few pixels (houses), a darker foundation.
      for (let j = wallTop; j < base; j++) {
        for (let i = x; i < x + s.w; i++) {
          let c = s.wallColor;
          if (!s.flat && (j - wallTop) % 5 === 4) c = tone(c, -0.08);
          if (i <= x + 1) c = tone(c, 0.15);
          if (i >= x + s.w - 3) c = tone(c, -0.14);
          if (j >= base - 3) c = tone(s.wallColor, -0.3);
          p.set(i, j, c);
        }
      }
      // Windows: on each floor, in columns on both sides of the door.
      const floors = s.floors ?? 1;
      const cols = s.windows ?? 1;
      const floorH = (s.wall - 18) / floors;
      for (let f = 0; f < floors; f++) {
        const wy = s.floors ? wallTop + 4 + f * floorH : wallTop + 5;
        const ww = s.floors ? 6 : 8;
        const span = s.floors ? s.w - 8 : s.w / 2 - 12;
        const count = s.floors ? Math.floor(span / 10) : cols;
        for (let n = 0; n < count; n++) {
          const xs = s.floors
            ? [x + 5 + n * 10 + Math.floor((span - count * 10) / 2)]
            : [x + 6 + n * 12, x + s.w - 6 - ww - n * 12];
          for (const wx of xs) {
            if (s.floors && wy + 7 > base - 18) continue;
            window_(p, wx, wy, ww, 7, s.wallColor);
            windowsLit.push({ x: wx + 1, y: wy + 1, w: ww - 2, h: 5 });
          }
        }
      }
      door(p, x + Math.floor(s.w / 2), base, s, windowsLit);
      if (s.flat) flatRoof(p, x, top, s);
      else roof(p, x, top, s);
      if (s.chimney) {
        const cx = x + s.w - 14;
        p.rect(cx, top - 4, 7, 10, OUTLINE);
        p.rect(cx + 1, top - 3, 5, 8, rgb('#a4573f'));
        p.rect(cx + 1, top - 3, 5, 1, rgb('#d07a5c'));
      }
      if (s.sign) signboard(p, x, wallTop, s);
      // The outline around the walls (the roof has its own).
      for (let j = wallTop; j < base; j++) {
        p.set(x - 1, j, OUTLINE);
        p.set(x + s.w, j, OUTLINE);
      }
      p.rect(x - 1, base, s.w + 2, 1, OUTLINE);
    },
  };
}

function window_(p: Pixels, x: number, y: number, w: number, h: number, wall: RGB) {
  p.rect(x - 1, y - 1, w + 2, h + 2, tone(wall, -0.45));
  p.rect(x, y, w, h, rgb('#78b4e6'));
  p.rect(x, y + h - 2, w, 2, rgb('#4f86c2'));
  p.set(x + 1, y + 1, rgb('#e6f6ff'));
  p.set(x + 2, y + 1, rgb('#bfe3ff'));
  p.set(x + 1, y + 2, rgb('#bfe3ff'));
  if (w >= 8) p.rect(x + Math.floor(w / 2), y, 1, h, tone(wall, -0.2));
  p.rect(x - 1, y + h + 1, w + 2, 1, tone(wall, 0.3));
}

function door(p: Pixels, cx: number, base: number, s: BuildingStyle, lit: Window[]) {
  const kind = s.door ?? 'wood';
  const w = kind === 'double' || kind === 'glass' ? 14 : kind === 'arch' ? 16 : 10;
  const h = kind === 'arch' ? 16 : 13;
  const x = cx - Math.floor(w / 2);
  const y = base - h - 1;
  p.rect(x - 1, y - 1, w + 2, h + 1, OUTLINE);
  if (kind === 'glass') {
    p.rect(x, y, w, h, rgb('#8fd0f0'));
    p.rect(x + Math.floor(w / 2), y, 1, h, rgb('#e6f6ff'));
    p.rect(x, y, w, 2, rgb('#c8ecff'));
    lit.push({ x, y, w, h });
  } else if (kind === 'arch') {
    p.rect(x, y, w, h, rgb('#2b2338'));
    p.rect(x, y, 2, 2, s.wallColor);
    p.rect(x + w - 2, y, 2, 2, s.wallColor);
  } else {
    const wood = kind === 'double' ? rgb('#6a4a8a') : rgb('#8a5530');
    p.rect(x, y, w, h, wood);
    p.rect(x, y, 1, h, tone(wood, 0.3));
    p.rect(x + 2, y + 2, w - 4, 4, tone(wood, -0.2));
    if (kind === 'double') p.rect(x + Math.floor(w / 2), y, 1, h, tone(wood, -0.45));
    else p.set(x + w - 3, y + 7, rgb('#f2d27a'));
  }
  // A step.
  p.rect(x - 2, base - 1, w + 4, 2, rgb('#b8b0c2'));
  p.rect(x - 2, base - 1, w + 4, 1, rgb('#e2dcea'));
}

/** A sloped roof seen from above and in front: shingle rows, a lit ridge, a dark eave, lit on the left. */
function roof(p: Pixels, x: number, top: number, s: BuildingStyle) {
  const x0 = x - 4;
  const x1 = x + s.w + 3;
  const y1 = top + s.roof + 1;
  const c = s.roofColor;
  for (let j = top; j <= y1; j++) {
    for (let i = x0; i <= x1; i++) {
      const row = j - top;
      let col = mix(tone(c, 0.18), tone(c, -0.12), row / s.roof);
      if (row <= 1) col = tone(c, 0.38);
      else if ((row - 2) % 4 === 3) col = tone(c, -0.26);
      else if ((row - 2) % 4 === 0 && (i + Math.floor((row - 2) / 4) * 3) % 6 === 0) col = tone(c, -0.18);
      if (i <= x0 + 1) col = tone(col, 0.2);
      if (i >= x1 - 2) col = tone(col, -0.22);
      if (j >= y1 - 1) col = tone(c, -0.42);
      p.set(i, j, col);
    }
  }
  for (let i = x0 - 1; i <= x1 + 1; i++) {
    p.set(i, top - 1, OUTLINE);
    p.set(i, y1 + 1, OUTLINE);
  }
  for (let j = top - 1; j <= y1 + 1; j++) {
    p.set(x0 - 1, j, OUTLINE);
    p.set(x1 + 1, j, OUTLINE);
  }
}

/** A tall building's flat roof: a light plate with a rim, an air vent, a water tank. */
function flatRoof(p: Pixels, x: number, top: number, s: BuildingStyle) {
  const c = s.roofColor;
  p.rect(x - 2, top - 1, s.w + 4, s.roof + 2, OUTLINE);
  p.rect(x - 1, top, s.w + 2, s.roof, tone(c, -0.15));
  p.rect(x + 1, top + 2, s.w - 2, s.roof - 4, c);
  p.rect(x + 1, top + 2, s.w - 2, 1, tone(c, 0.3));
  p.rect(x + 6, top + 4, 8, 5, tone(c, -0.35));
  p.rect(x + 7, top + 4, 6, 1, tone(c, 0.2));
  p.rect(x + s.w - 16, top + 3, 9, 7, rgb('#9aa6b8'));
  p.rect(x + s.w - 16, top + 3, 9, 2, rgb('#c8d2e0'));
}

function pokeBall(p: Pixels, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x + 0.5 - 0.5, y + 0.5 - 0.5);
      if (d > r + 0.3) continue;
      const edge = d > r - 0.7;
      p.set(cx + x, cy + y, edge || y === 0 ? OUTLINE : y < 0 ? (x < 0 && y < -r / 2 ? rgb('#ff8a7a') : rgb('#e8403a')) : rgb('#f6f6f6'));
    }
  }
  p.rect(cx - 1, cy - 1, 3, 3, OUTLINE);
  p.set(cx, cy, 0xffffff);
}

function signboard(p: Pixels, x: number, wallTop: number, s: BuildingStyle) {
  const cx = x + Math.floor(s.w / 2);
  if (s.sign === 'center') {
    // A Poké Ball on the roof's front, and a red band over the door.
    pokeBall(p, cx, wallTop - 8, 6);
    p.rect(x + 2, wallTop + 1, s.w - 4, 3, rgb('#e8403a'));
    p.rect(x + 2, wallTop + 1, s.w - 4, 1, rgb('#ff8a7a'));
  } else if (s.sign === 'mart') {
    p.rect(cx - 12, wallTop - 9, 24, 8, OUTLINE);
    p.rect(cx - 11, wallTop - 8, 22, 6, rgb('#3b7fe0'));
    for (let i = 0; i < 3; i++) p.rect(cx - 8 + i * 6, wallTop - 6, 4, 2, 0xffffff);
  } else if (s.sign === 'gym' || s.sign === 'league') {
    const gold = rgb('#f2c94c');
    p.rect(cx - 7, wallTop - 11, 14, 9, OUTLINE);
    p.rect(cx - 6, wallTop - 10, 12, 7, s.sign === 'league' ? rgb('#e8403a') : gold);
    p.rect(cx - 6, wallTop - 10, 12, 1, 0xffffff);
    p.rect(cx - 2, wallTop - 8, 4, 3, s.sign === 'league' ? gold : rgb('#8a5a10'));
  }
}

function statue(x: number, base: number): Thing {
  return {
    base,
    shadow: p => p.blendRect(x + 2, base, 8, 2, SHADOW, 0.3),
    draw: p => {
      const stone = rgb('#b7b2c6');
      p.rect(x - 1, base - 16, 9, 17, OUTLINE);
      p.rect(x, base - 6, 7, 6, tone(stone, -0.2));
      p.rect(x + 1, base - 14, 5, 8, stone);
      p.rect(x + 1, base - 14, 2, 8, tone(stone, 0.3));
      p.rect(x, base - 15, 7, 2, tone(stone, 0.15));
    },
  };
}

const HOUSE_ROOFS = ['#d0553d', '#3f7cc0', '#4f9a4a', '#8d5bb0', '#d08a2e', '#c0465e'].map(rgb);
const HOUSE_WALLS = ['#f3ead2', '#f2f0ea', '#ecd9b0'].map(rgb);

/** How wide each kind of building is (art pixels). */
const WIDTH: Record<Feature, number> = {
  house: 50,
  center: 74,
  mart: 60,
  gym: 90,
  lab: 80,
  museum: 96,
  tower: 52,
  store: 76,
  tall: 52,
  skyscraper: 70,
  gate: 90,
  league: 112,
  volcano: 104,
};

function feature(kind: Feature, x: number, base: number, random: () => number, lit: Window[], pal: Palette): Thing[] {
  const house = (): BuildingStyle => ({
    w: WIDTH.house,
    wall: 22,
    roof: 26,
    roofColor: HOUSE_ROOFS[Math.floor(random() * HOUSE_ROOFS.length)],
    wallColor: HOUSE_WALLS[Math.floor(random() * HOUSE_WALLS.length)],
    windows: 1,
    chimney: random() > 0.5,
  });
  switch (kind) {
    case 'house':
      return [building(x, base, house(), lit)];
    case 'center':
      return [building(x, base, { w: WIDTH.center, wall: 26, roof: 28, roofColor: rgb('#e04a40'), wallColor: rgb('#f6f4f0'), door: 'glass', windows: 2, sign: 'center' }, lit)];
    case 'mart':
      return [building(x, base, { w: WIDTH.mart, wall: 25, roof: 24, roofColor: rgb('#3d7fe0'), wallColor: rgb('#f6f4f0'), door: 'glass', windows: 1, sign: 'mart' }, lit)];
    case 'gym':
      return [
        building(x, base, { w: WIDTH.gym, wall: 30, roof: 30, roofColor: rgb('#6f8aa0'), wallColor: rgb('#e9e0c8'), door: 'double', windows: 2, sign: 'gym' }, lit),
        statue(x + 18, base + 6),
        statue(x + WIDTH.gym - 26, base + 6),
      ];
    case 'lab':
      return [building(x, base, { w: WIDTH.lab, wall: 28, roof: 26, roofColor: rgb('#8e98aa'), wallColor: rgb('#f4f6f8'), door: 'glass', windows: 2, chimney: true }, lit)];
    case 'museum': {
      const style: BuildingStyle = { w: WIDTH.museum, wall: 30, roof: 24, roofColor: rgb('#8a7a6a'), wallColor: rgb('#e4dccb'), door: 'double', windows: 0 };
      const b = building(x, base, style, lit);
      return [
        {
          ...b,
          draw: p => {
            b.draw(p);
            // Columns along the front.
            for (let i = 8; i < style.w - 8; i += 12) {
              if (Math.abs(i - style.w / 2) < 10) continue;
              p.rect(x + i - 1, base - style.wall, 6, style.wall - 3, OUTLINE);
              p.rect(x + i, base - style.wall, 4, style.wall - 3, rgb('#f6f2e8'));
              p.rect(x + i + 3, base - style.wall, 1, style.wall - 3, rgb('#c4bba8'));
            }
          },
        },
      ];
    }
    case 'tower': {
      // Lavender's tower: three tiers, each narrower, purple roofs.
      const tiers = [
        { w: 52, wall: 22, roof: 14 },
        { w: 40, wall: 18, roof: 12 },
        { w: 28, wall: 14, roof: 12 },
      ];
      let b = base;
      return tiers.map((t, i) => {
        const tx = x + (52 - t.w) / 2;
        const thing = building(tx, b, { w: t.w, wall: t.wall, roof: t.roof, roofColor: rgb('#7a4ab0'), wallColor: rgb('#e6dcef'), door: i === 0 ? 'arch' : undefined, windows: 1 }, lit);
        const at = b;
        b -= t.wall + t.roof - 4;
        return { ...thing, base: base + i * 0.01, draw: i === 0 ? thing.draw : (p: Pixels) => tierOnly(p, tx, at, t, thing) };
      });
    }
    case 'store':
      return [building(x, base, { w: WIDTH.store, wall: 64, roof: 12, roofColor: rgb('#c8ccd8'), wallColor: rgb('#f0e6d2'), door: 'glass', floors: 4, flat: true }, lit)];
    case 'tall':
      return [building(x, base, { w: WIDTH.tall, wall: 48 + Math.floor(random() * 14), roof: 10, roofColor: rgb('#b8bccb'), wallColor: HOUSE_WALLS[Math.floor(random() * 3)], door: 'glass', floors: 3, flat: true }, lit)];
    case 'skyscraper':
      return [building(x, base, { w: WIDTH.skyscraper, wall: 82, roof: 12, roofColor: rgb('#aab8cc'), wallColor: rgb('#cfd8e6'), door: 'glass', floors: 6, flat: true }, lit)];
    case 'gate':
      return [
        building(x, base, { w: WIDTH.gate, wall: 24, roof: 22, roofColor: rgb('#3f8f4a'), wallColor: rgb('#e8dcbc'), door: 'arch', windows: 2 }, lit),
        tree(x - 6, base + 4, pal, 0.8),
        tree(x + WIDTH.gate + 6, base + 4, pal, 0.8),
      ];
    case 'league':
      return [
        building(x, base, { w: WIDTH.league, wall: 34, roof: 34, roofColor: rgb('#3a3f8f'), wallColor: rgb('#ece6f6'), door: 'double', windows: 3, sign: 'league' }, lit),
        statue(x + 22, base + 6),
        statue(x + WIDTH.league - 30, base + 6),
      ];
    case 'volcano':
      return [volcano(x + WIDTH.volcano / 2, base - 4)];
  }
}

/** Upper tiers of the tower: drawn without their own shadow line on the ground. */
function tierOnly(p: Pixels, _x: number, _base: number, _t: { w: number }, thing: Thing) {
  thing.draw(p);
}

function volcano(cx: number, base: number): Thing {
  const rock = [rgb('#4a3438'), rgb('#6e4a46'), rgb('#8e6252'), rgb('#ad7c62'), rgb('#c99a78')];
  return {
    base,
    shadow: p => p.oval(cx + 8, base, 56, 8, SHADOW, 0.3),
    draw: p => {
      clumps(
        p,
        [
          { x: cx - 30, y: base - 14, r: 20 },
          { x: cx + 30, y: base - 14, r: 20 },
          { x: cx, y: base - 30, r: 30 },
          { x: cx - 10, y: base - 12, r: 18 },
          { x: cx + 12, y: base - 12, r: 18 },
        ],
        rock,
        rgb('#2a1a22'),
      );
      // The crater and its lava.
      p.oval(cx, base - 52, 13, 5, rgb('#2a1a22'), 1);
      p.oval(cx, base - 51, 10, 3.5, rgb('#ff6a2a'), 1);
      p.oval(cx - 2, base - 52, 5, 1.5, rgb('#ffd27a'), 1);
      // Lava streaks down the front.
      for (let j = 0; j < 16; j++) {
        p.set(cx - 4 + Math.round(Math.sin(j / 3) * 2), base - 47 + j, rgb('#ff7a2a'));
        p.set(cx + 6 + Math.round(Math.cos(j / 4) * 2), base - 48 + j * 0.8, rgb('#e2502a'));
      }
    },
  };
}

function ship(x: number, base: number): Thing {
  // A cruise ship moored at the pier, seen from above and in front: a long white hull, a blue stripe, decks, a funnel.
  const w = 72;
  return {
    base,
    shadow: p => p.blendRect(x + 4, base, w, 4, rgb('#1a3a78'), 0.4),
    draw: p => {
      const hull = (y: number) => 3 + Math.max(0, Math.abs(y) - 3);
      for (let j = -22; j <= 0; j++) {
        const inset = j > -8 ? Math.floor((j + 8) / 2) : 0;
        for (let i = inset; i < w - inset - (j < -14 ? 6 : 0); i++) {
          const edge = i === inset || i === w - inset - 1 - (j < -14 ? 6 : 0) || j === -22 || j === 0;
          p.set(x + i, base + j, edge ? OUTLINE : j > -6 ? rgb('#2f5fb0') : j > -8 ? rgb('#e8403a') : j < -19 ? rgb('#c7cfdc') : rgb('#f6f6f8'));
        }
      }
      void hull;
      // Cabins and windows on deck.
      p.rect(x + 12, base - 34, 40, 13, OUTLINE);
      p.rect(x + 13, base - 33, 38, 11, rgb('#f6f6f8'));
      p.rect(x + 13, base - 33, 38, 2, rgb('#d6dce8'));
      for (let i = 0; i < 6; i++) p.rect(x + 16 + i * 6, base - 29, 3, 3, rgb('#5a8ad0'));
      for (let i = 0; i < 9; i++) p.rect(x + 6 + i * 7, base - 16, 3, 3, rgb('#5a8ad0'));
      // The funnel.
      p.rect(x + 38, base - 46, 11, 13, OUTLINE);
      p.rect(x + 39, base - 45, 9, 11, rgb('#e8403a'));
      p.rect(x + 39, base - 45, 9, 3, rgb('#2a2238'));
      p.rect(x + 39, base - 42, 3, 8, rgb('#ff8a7a'));
    },
  };
}

// ── The town ─────────────────────────────────────────────────────────────────────────────────────────────────────

function paintTown(cityId: string): Pixels {
  const plan = planOf(cityId);
  const pal = paletteOf(plan);
  const seed = hash(cityId);
  const random = seeded(seed);
  const p = new Pixels(W, H);
  const g = new Ground2();
  const things: Thing[] = [];
  const lit: Window[] = [];
  const glows: Glow[] = [];

  // The ground: grass (or rock, sand, paving), the main road, and the water.
  const base = plan.ground === 'sand' ? K.Sand : plan.ground === 'rock' ? K.Rock : plan.ground === 'paved' ? K.Plaza : K.Grass;
  g.fill(0, 0, W, H, base);
  if (plan.ground === 'sand') g.fill(0, 0, W, 60, K.Grass);
  const right = plan.water.includes('seaRight') ? 404 : plan.water.includes('river') ? 418 : W;
  if (plan.ground !== 'paved') g.fill(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP, K.Path);
  else g.fill(0, ROAD_TOP + 2, W, ROAD_BOTTOM - ROAD_TOP - 4, K.Path);
  // A paved square in the middle of the road, and a path down to the second row.
  g.fill(W / 2 - 60, ROAD_TOP - 2, 120, ROAD_BOTTOM - ROAD_TOP + 8, K.Plaza);
  g.fill(W / 2 - 10, ROAD_BOTTOM, 20, ROW_B - ROAD_BOTTOM + 14, K.Path);
  g.fill(40, ROW_B + 8, W - 80, 14, K.Path);
  // Tall grass at the town's edges: the way out to the routes (where the hunting is).
  if (plan.ground !== 'paved') {
    g.fill(0, ROW_B + 26, 96, H, K.Tall);
    if (!plan.water.includes('seaRight')) g.fill(W - 88, ROW_B + 30, 88, H, K.Tall);
  }
  if (plan.water.includes('seaBottom')) {
    g.fill(0, 234, W, H, K.Water);
    g.fill(0, 222, W, 12, K.Sand);
  }
  if (plan.water.includes('seaRight')) {
    g.fill(right, 0, W - right, H, K.Water);
    g.fill(right - 10, 0, 10, H, K.Sand);
  }
  if (plan.water.includes('river')) {
    g.fill(right, 0, 30, H, K.Water);
    // The bridge's planks carry the road over it (drawn as a thing, the ground under it stays path).
    g.fill(right, ROAD_TOP + 2, 30, ROAD_BOTTOM - ROAD_TOP - 4, K.Path);
  }
  if (plan.water.includes('pond')) {
    const px = plan.water.includes('river') ? 300 : 330;
    for (let y = 0; y < 34; y++) {
      for (let x = 0; x < 80; x++) {
        if (((x - 40) / 40) ** 2 + ((y - 17) / 17) ** 2 < 1) g.fill(px + x, ROW_B - 40 + y, 1, 1, K.Water);
      }
    }
  }

  paintGround(p, g, pal, seed);

  // The forest edge at the top: two rows of trees, a little irregular.
  for (const [row, y] of [
    [0, 20],
    [1, 34],
  ] as const) {
    for (let x = -10 + row * 12; x < right + 10; x += 24) {
      things.push(tree(x + Math.floor(random() * 6), y + Math.floor(random() * 4), pal));
    }
  }

  // The main row of buildings, spread over the width, with trees, bushes or a lamp in the gaps.
  const row = [...plan.row];
  const usable = right - 24;
  while (row.reduce((sum, f) => sum + WIDTH[f] + 30, 0) < usable - WIDTH.house) {
    if (row.length % 2) row.push('house');
    else row.unshift('house');
  }
  const total = row.reduce((sum, f) => sum + WIDTH[f], 0);
  const gap = (usable - total) / (row.length + 1);
  let x = 12 + gap;
  const doors: number[] = [];
  row.forEach((f, i) => {
    things.push(...feature(f, Math.round(x), f === 'volcano' ? ROW_A - 6 : ROW_A, random, lit, pal));
    if (f !== 'volcano') doors.push(Math.round(x + WIDTH[f] / 2));
    // In the gap after it: a tree (wide gaps), or a bush with flowers and a lamp.
    const gx = Math.round(x + WIDTH[f] + gap / 2);
    if (i < row.length - 1 || gap > 24) {
      if (gap >= 26) things.push(tree(gx, ROW_A - 2, pal, 0.85));
      else things.push(bush(gx, ROW_A - 4, pal, HOUSE_ROOFS[i % HOUSE_ROOFS.length]));
    }
    x += WIDTH[f] + gap;
  });
  // A path from each door to the road, flower beds beside it, lamps along the road.
  for (const d of doors) {
    for (let j = ROW_A + 1; j < ROAD_TOP; j++) for (let i = d - 6; i < d + 6; i++) if (g.at(i, j) !== K.Plaza) p.set(i, j, j === ROW_A + 1 ? pal.path[0] : pal.path[1]);
  }
  for (let lx = 20; lx < right - 10; lx += 76) things.push(lamp(lx + Math.floor(random() * 8), ROAD_BOTTOM + 6, glows));
  things.push(sign(W / 2 + 70, ROAD_BOTTOM + 14));

  // The second row: smaller houses with gardens and fences, trees and bushes, boulders on rocky ground.
  const bRow: number[] = [];
  for (let bx = 24; bx < right - 60; bx += 108) bRow.push(bx);
  const builtB: number[] = [];
  bRow.forEach((bx, i) => {
    if (plan.water.includes('pond') && bx + 50 > (plan.water.includes('river') ? 300 : 330) && bx < (plan.water.includes('river') ? 380 : 410)) return;
    if (Math.abs(bx + 25 - W / 2) < 40) return;
    builtB.push(bx);
    things.push(...feature(plan.ground === 'paved' ? 'tall' : 'house', bx, ROW_B, random, lit, pal));
    things.push(bush(bx + 64, ROW_B + 2, pal, i % 2 ? rgb('#ffd24a') : rgb('#ff6f8a')));
  });
  for (let fx = 30; fx < right - 40; fx += 150) things.push({ base: ROW_B + 26, draw: q => fence(q, fx, ROW_B + 26, 56) });
  for (let i = 0; i < 9; i++) {
    const tx = 10 + random() * (right - 20);
    const ty = ROAD_BOTTOM + 30 + random() * 40;
    // Not on the road down the middle, nor on a house.
    if (Math.abs(tx - W / 2) < 30 || builtB.some(bx => tx > bx - 16 && tx < bx + WIDTH.house + 16)) continue;
    if (plan.ground === 'rock') things.push(boulder(tx, ty, 0.8 + random() * 0.6));
    else things.push(random() > 0.5 ? tree(tx, ty + 10, pal, 0.8) : bush(tx, ty, pal, random() > 0.5 ? rgb('#ff6f8a') : undefined));
  }
  if (plan.ground === 'rock') {
    for (let i = 0; i < 6; i++) things.push(boulder(30 + i * 80 + random() * 20, ROW_A - 2 + random() * 3, 0.6));
  }
  // Flower beds along the road.
  for (let fx = 8; fx < right - 30; fx += 60) {
    if (Math.abs(fx - W / 2) < 70) continue;
    flowerBed(p, fx, ROAD_BOTTOM + 4, 16, [rgb('#ff5a6e'), rgb('#ffd24a'), rgb('#ffffff'), rgb('#ff9ad0')], seed);
  }
  if (plan.water.includes('river')) things.push(bridge(right, pal));
  if (cityId === 'vermilion') {
    // A wooden pier out to the ship.
    things.push({ base: ROAD_BOTTOM - 1, draw: q => pier(q, right - 10, ROAD_TOP + 4, W - right + 10, 14) });
    things.push(ship(right + 2, ROAD_TOP - 2));
  }

  // Back to front: shadows first, then everything by the line it stands on.
  things.sort((a, b) => a.base - b.base);
  for (const t of things) t.shadow?.(p);
  for (const t of things) t.draw(p);

  // The time of day: tint everything, then light the windows and the lamps.
  const { tint, lit: lights } = plan.light;
  if (tint) {
    p.map(c => {
      const r = Math.min(255, ((c >> 16) & 255) * tint[0]);
      const gg = Math.min(255, ((c >> 8) & 255) * tint[1]);
      const b = Math.min(255, (c & 255) * tint[2]);
      return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
    });
  }
  if (lights) {
    for (const w of lit) {
      for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) p.set(w.x + i, w.y + j, j < 2 ? rgb('#fff4c2') : rgb('#ffd27a'));
    }
    for (const glow of glows) {
      for (let j = -glow.r; j <= glow.r; j++) {
        for (let i = -glow.r; i <= glow.r; i++) {
          const d = Math.hypot(i, j) / glow.r;
          if (d < 1 && bayer(glow.x + i, glow.y + j) > d) p.blend(glow.x + i, glow.y + j, rgb('#ffe2a0'), 0.18);
        }
      }
      p.rect(glow.x - 2, glow.y - 1, 4, 3, rgb('#fff6d0'));
    }
  }
  return p;
}

function bridge(x: number, pal: Palette): Thing {
  return {
    base: ROAD_BOTTOM,
    draw: p => {
      const wood = rgb('#b07a42');
      for (let j = ROAD_TOP; j < ROAD_BOTTOM; j++) {
        for (let i = x - 2; i < x + 32; i++) {
          p.set(i, j, (i - x) % 5 === 4 ? tone(wood, -0.35) : j === ROAD_TOP ? tone(wood, 0.3) : wood);
        }
      }
      for (const ry of [ROAD_TOP - 3, ROAD_BOTTOM]) {
        p.rect(x - 3, ry, 36, 3, OUTLINE);
        p.rect(x - 2, ry + 1, 34, 1, rgb('#d8a468'));
      }
      void pal;
    },
  };
}

function pier(p: Pixels, x: number, y: number, w: number, h: number) {
  const wood = rgb('#a8743e');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, i % 6 === 5 ? tone(wood, -0.35) : j === 0 ? tone(wood, 0.3) : wood);
  p.rect(x, y + h, w, 1, OUTLINE);
  p.blendRect(x, y + h + 1, w, 3, 0x1a3a78, 0.35);
  for (let i = 0; i < w; i += 18) p.rect(x + i, y + h, 3, 4, rgb('#5e3a22'));
}
