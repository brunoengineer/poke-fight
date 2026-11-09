// Each city as a pixel-art panorama, painted by code (shapes made for this game): a sky for the city's mood, far
// hills, the skyline (houses, the Pokémon Center, the Mart, the gym, and the city's landmark), trees, and the plaza in
// front. 480×270 art pixels, the fight's own size: it's the city's backdrop in the menus (as an image) and the stage
// of the battle field's fights. The horizon sits high, so the skyline shows above the city screen's cards.

import { VIEW_H, VIEW_W } from './screen';

/** The skyline's base line (where buildings stand). */
const BASE = 118;

interface Mood {
  sky: [string, string, string];
  sun: { x: number; y: number; color: string; size: number } | null;
  hills: string;
  far: string;
  ground: [string, string];
  /** Lit windows (dusk and night). */
  lights: boolean;
  stars: boolean;
}

const DAY: Mood = {
  sky: ['#4c9bff', '#86c4ff', '#d8efff'],
  sun: { x: 400, y: 34, color: '#fff6c9', size: 14 },
  hills: '#6aa66a',
  far: '#9cc3d8',
  ground: ['#d9c9a3', '#c4b087'],
  lights: false,
  stars: false,
};

const MOODS: Record<string, Partial<Mood>> = {
  pallet: { ground: ['#bfe39a', '#a3cf7f'] },
  viridian: { hills: '#4d9a57', ground: ['#a9d98a', '#8cc271'] },
  pewter: { sky: ['#6aa4e8', '#a9cdef', '#eaf2f6'], hills: '#9c8a74', far: '#b9b2a8', ground: ['#cbbfa9', '#b2a48b'] },
  cerulean: { sky: ['#3f8cf2', '#7fb8ff', '#d4ecff'] },
  vermilion: { sky: ['#ff9a5a', '#ffc88a', '#ffe9c4'], sun: { x: 380, y: 70, color: '#fff1c2', size: 18 }, hills: '#7f8fb0', far: '#e3b9a0' },
  lavender: { sky: ['#2b2350', '#6a4f9e', '#c79ad6'], sun: { x: 90, y: 30, color: '#f3ecff', size: 10 }, hills: '#3d3566', far: '#7b6aa8', ground: ['#a99bbd', '#8f80a6'], lights: true, stars: true },
  celadon: { hills: '#3f8f52', ground: ['#b9dd9a', '#9fca80'] },
  fuchsia: { sky: ['#5fb2ff', '#a8dcff', '#f4f9e8'], hills: '#5aa257', ground: ['#d9cf96', '#c2b67a'] },
  saffron: { sky: ['#ff8f4a', '#ffbf6e', '#ffe7b0'], sun: { x: 120, y: 60, color: '#fff3c4', size: 20 }, hills: '#8d7a8f', far: '#e2b493', lights: true },
  cinnabar: { sky: ['#e2553d', '#ff9d5c', '#ffd9a0'], sun: { x: 420, y: 80, color: '#fff0c8', size: 22 }, hills: '#6b4a45', far: '#c98a6f', ground: ['#d8b88f', '#bf9c72'] },
  indigo: { sky: ['#0f1240', '#2d2f78', '#7a6ad0'], sun: { x: 70, y: 28, color: '#eef0ff', size: 9 }, hills: '#2b2d5c', far: '#4a4c8a', ground: ['#b3aac9', '#9a90b3'], lights: true, stars: true },
};

const cache = new Map<string, HTMLCanvasElement>();

/** The city's panorama (painted once, then reused). */
export function townPicture(cityId: string): HTMLCanvasElement {
  let canvas = cache.get(cityId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const ctx = canvas.getContext('2d');
    if (ctx) paintTown(ctx, cityId);
    cache.set(cityId, canvas);
  }
  return canvas;
}

/** The panorama as an image URL (for the menus' backdrop). */
export const townUrl = (cityId: string) => townPicture(cityId).toDataURL('image/png');

// ── Painting ──────────────────────────────────────────────────────────────────────────────────────────────────────

function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

/** A color made darker or lighter (amount −1…1). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

type Ctx = CanvasRenderingContext2D;

const rect = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function paintTown(c: Ctx, cityId: string) {
  const mood: Mood = { ...DAY, ...MOODS[cityId] };
  const random = seeded(hash(cityId));

  // Sky, in three bands blended by steps (pixel-art style: no smooth gradient).
  const [top, mid, low] = mood.sky;
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    rect(c, 0, (i * BASE) / bands, VIEW_W, BASE / bands + 1, mix(t < 0.5 ? top : mid, t < 0.5 ? mid : low, t < 0.5 ? t * 2 : (t - 0.5) * 2));
  }
  if (mood.stars) {
    for (let i = 0; i < 60; i++) rect(c, random() * VIEW_W, random() * BASE * 0.6, 1, 1, random() > 0.7 ? '#ffffff' : '#c8c8ff');
  }
  if (mood.sun) {
    const { x, y, color, size } = mood.sun;
    disc(c, x, y, size + 6, shade(color, -0.05), 0.25);
    disc(c, x, y, size, color, 1);
  }
  // Clouds.
  for (let i = 0; i < 5; i++) cloud(c, random() * VIEW_W, 14 + random() * 50, 18 + random() * 26, mood.stars ? 'rgba(220,210,255,0.25)' : 'rgba(255,255,255,0.85)');

  // Far range and near hills.
  ridge(c, mood.far, BASE - 34, 18, random);
  if (cityId === 'cinnabar') volcano(c, 360, BASE - 2);
  if (cityId === 'pewter' || cityId === 'indigo') peaks(c, mood.far, random);
  ridge(c, mood.hills, BASE - 14, 10, random);

  // The ground (plaza / grass) with a few rows of texture, and water for harbor towns.
  rect(c, 0, BASE, VIEW_W, VIEW_H - BASE, mood.ground[0]);
  for (let y = BASE + 6; y < VIEW_H; y += 9) for (let x = (y * 7) % 23; x < VIEW_W; x += 23) rect(c, x, y, 6, 1, mood.ground[1]);
  if (cityId === 'cerulean' || cityId === 'vermilion' || cityId === 'cinnabar') sea(c, cityId === 'cerulean' ? 300 : 260, BASE, mood);

  // Far away: a hazy row of small houses, for depth.
  for (let fx = 4; fx < VIEW_W; fx += 16 + random() * 22) {
    const w = 10 + random() * 8;
    const h = 6 + random() * 6;
    rect(c, fx, BASE - h - 2, w, h + 2, mix(mood.far, '#ffffff', 0.25));
    for (let dy = 0; dy < 4; dy++) rect(c, fx - 1 + dy, BASE - h - 6 + dy, w + 2 - dy * 2, 1, mix(mood.hills, mood.far, 0.4));
  }
  rect(c, 0, BASE - 2, VIEW_W, 2, shade(mood.hills, -0.15));

  // The skyline: the city's landmark, its services, and houses, spread across the whole width; trees between.
  const widths: Record<string, number> = { house: 34, center: 46, mart: 38, gym: 58, tall: 30 };
  const width = (feature: string) => LANDMARKS[feature]?.width ?? widths[feature] ?? 34;
  const features = [...(FEATURES[cityId] ?? ['house', 'center', 'house'])];
  // More houses until the row is full (alternating sides, so the landmarks stay in the middle).
  for (let i = 0; features.reduce((sum, f) => sum + width(f) + 14, 0) < VIEW_W - 60; i++) {
    if (i % 2) features.push('house');
    else features.unshift('house');
  }
  const total = features.reduce((sum, f) => sum + width(f), 0);
  const gap = (VIEW_W - total) / (features.length + 1);
  let x = gap;
  for (const feature of features) {
    trees(c, x - gap / 2 + 4, BASE, gap > 18 ? 2 : 1, random);
    BUILDERS[feature]?.(c, x, BASE, mood, random) ?? LANDMARKS[feature]?.draw(c, x, BASE, mood, random);
    x += width(feature) + gap;
  }
  trees(c, VIEW_W - 4, BASE, 2, random);

  // The plaza: a path in perspective, flower beds along the buildings, lamp posts.
  for (let y = BASE + 2; y < VIEW_H; y += 1) {
    const half = 10 + (y - BASE) * 0.55;
    rect(c, VIEW_W / 2 - half, y, half * 2, 1, shade(mood.ground[0], 0.12));
  }
  for (let fx = 0; fx < VIEW_W; fx += 3) {
    if (Math.abs(fx - VIEW_W / 2) < 14) continue;
    rect(c, fx, BASE, 3, 3, (fx / 3) % 4 === 0 ? '#e86a8a' : (fx / 3) % 4 === 2 ? '#ffd24a' : '#3f8f4a');
  }
  for (const lx of [60, 150, 330, 420]) lamp(c, lx, BASE + 14 + Math.abs(lx - VIEW_W / 2) * 0.05, mood);
}

function lamp(c: Ctx, x: number, base: number, mood: Mood) {
  rect(c, x, base - 22, 2, 22, '#3a3f52');
  rect(c, x - 2, base - 25, 6, 4, '#4a5068');
  rect(c, x - 1, base - 24, 4, 2, mood.lights ? '#ffe28a' : '#f2f2f2');
  if (mood.lights) disc(c, x + 1, base - 23, 7, '#ffe28a', 0.18);
  rect(c, x - 2, base, 6, 1, 'rgba(0,0,0,0.25)');
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function disc(c: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(x - half), Math.round(y + dy), half * 2, 1);
  }
  c.globalAlpha = 1;
}

function cloud(c: Ctx, x: number, y: number, w: number, color: string) {
  c.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const cx = x + (i / 3) * w;
    const r = 5 + ((i * 3) % 5);
    for (let dy = -r; dy <= 0; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      c.fillRect(Math.round(cx - half), Math.round(y + dy), half * 2, 1);
    }
  }
  c.fillRect(Math.round(x - 5), Math.round(y), Math.round(w + 10), 2);
}

function ridge(c: Ctx, color: string, base: number, amplitude: number, random: () => number) {
  const phase = random() * 10;
  for (let x = 0; x < VIEW_W; x++) {
    const h = amplitude * (0.6 + 0.4 * Math.sin(x / 37 + phase) + 0.25 * Math.sin(x / 13 + phase * 2));
    rect(c, x, base - h, 1, BASE - base + h, color);
  }
}

function peaks(c: Ctx, color: string, random: () => number) {
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 120 + random() * 40;
    const h = 40 + random() * 25;
    for (let dy = 0; dy < h; dy++) {
      const half = (dy / h) * (h * 0.9);
      rect(c, x - half, BASE - 30 - h + dy, half * 2, 1, dy < 6 ? '#f4f6ff' : shade(color, -0.12));
    }
  }
}

function volcano(c: Ctx, x: number, base: number) {
  const h = 70;
  for (let dy = 0; dy < h; dy++) {
    const half = 12 + (dy / h) * 70;
    rect(c, x - half, base - h + dy, half * 2, 1, dy < 4 ? '#ff7a3d' : '#7a4a42');
  }
  for (let i = 0; i < 5; i++) cloud(c, x - 10 + i * 6, base - h - 8 - i * 9, 14 + i * 3, `rgba(90, 80, 90, ${0.55 - i * 0.08})`);
}

function sea(c: Ctx, from: number, base: number, mood: Mood) {
  for (let y = base; y < VIEW_H; y++) {
    const t = (y - base) / (VIEW_H - base);
    rect(c, from + (1 - t) * 0, y, VIEW_W - from, 1, mix('#3f86d8', '#24569e', t));
  }
  for (let i = 0; i < 40; i++) {
    const y = base + 4 + ((i * 37) % (VIEW_H - base - 8));
    const x = from + 6 + ((i * 53) % (VIEW_W - from - 16));
    rect(c, x, y, 5, 1, mood.lights ? 'rgba(255,220,180,0.5)' : 'rgba(255,255,255,0.55)');
  }
  rect(c, from - 3, base, 3, VIEW_H - base, '#e8dcae');
}

function trees(c: Ctx, x: number, base: number, count: number, random: () => number) {
  for (let i = 0; i < count; i++) {
    const tx = x - i * 7 - random() * 3;
    const r = 6 + Math.floor(random() * 3);
    rect(c, tx - 1, base - 6, 2, 6, '#5a3e2b');
    disc(c, tx, base - 6 - r, r, '#2f7d43', 1);
    disc(c, tx - 2, base - 8 - r, r - 3, '#4aa35a', 1);
  }
}

/** Windows on a wall, lit or not. */
function windows(c: Ctx, x: number, y: number, w: number, h: number, mood: Mood, random: () => number, size = 3, gap = 4) {
  for (let wy = y + 3; wy + size < y + h - 2; wy += size + gap) {
    for (let wx = x + 3; wx + size < x + w - 2; wx += size + gap) {
      const lit = mood.lights && random() > 0.35;
      rect(c, wx, wy, size, size, lit ? '#ffd97a' : '#6f97c4');
      if (!lit) rect(c, wx, wy, size, 1, '#a9c9ec');
    }
  }
}

/** A house: walls with a shaded side, a gable roof drawn row by row, a door and windows. */
function house(c: Ctx, x: number, base: number, w: number, h: number, wall: string, roof: string, mood: Mood, random: () => number) {
  rect(c, x, base - h, w, h, wall);
  rect(c, x + w - 3, base - h, 3, h, shade(wall, -0.18));
  const roofH = Math.round(w * 0.38);
  for (let dy = 0; dy < roofH; dy++) {
    const inset = roofH - dy;
    rect(c, x - 2 + inset, base - h - roofH + dy, w + 4 - inset * 2, 1, dy === roofH - 1 ? shade(roof, -0.3) : dy < 2 ? shade(roof, 0.2) : roof);
  }
  rect(c, x + Math.round(w / 2) - 3, base - 9, 6, 9, shade(wall, -0.45));
  windows(c, x + 1, base - h, w - 4, h - 10, mood, random);
}

const BUILDERS: Record<string, (c: Ctx, x: number, base: number, mood: Mood, random: () => number) => void> = {
  house(c, x, base, mood, random) {
    const walls = ['#f2e6cf', '#e9d6c0', '#f5f0e6', '#dfe6ef'];
    const roofs = ['#c8503f', '#4f7cc8', '#5c9b5a', '#9a6b4b', '#8a5bb8'];
    house(c, x, base, 34, 20 + Math.floor(random() * 8), walls[Math.floor(random() * walls.length)], roofs[Math.floor(random() * roofs.length)], mood, random);
  },
  center(c, x, base, mood, random) {
    // The Pokémon Center: white, a red roof band, a Poké Ball sign.
    const w = 46;
    const h = 30;
    rect(c, x, base - h, w, h, '#fbf7f2');
    rect(c, x + w - 3, base - h, 3, h, '#ddd5cf');
    rect(c, x - 2, base - h - 7, w + 4, 7, '#e2463f');
    rect(c, x - 2, base - h - 7, w + 4, 2, '#ff7a6a');
    rect(c, x - 2, base - h - 1, w + 4, 1, '#9c2a26');
    disc(c, x + w / 2, base - h - 12, 5, '#e2463f', 1);
    rect(c, x + w / 2 - 5, base - h - 12, 10, 5, '#fbf7f2');
    rect(c, x + w / 2 - 5, base - h - 12, 10, 1, '#2a2a33');
    rect(c, x + w / 2 - 1, base - h - 13, 2, 3, '#2a2a33');
    rect(c, x + w / 2 - 5, base - 11, 10, 11, '#7fc7ff');
    rect(c, x + w / 2, base - 11, 1, 11, '#5aa0d8');
    windows(c, x + 2, base - h + 2, 14, 16, mood, random);
    windows(c, x + w - 18, base - h + 2, 14, 16, mood, random);
  },
  mart(c, x, base, mood, random) {
    const w = 38;
    const h = 26;
    rect(c, x, base - h, w, h, '#f4f6fb');
    rect(c, x + w - 3, base - h, 3, h, '#d4d8e4');
    rect(c, x - 2, base - h - 6, w + 4, 6, '#3f78e0');
    rect(c, x - 2, base - h - 6, w + 4, 2, '#7fa8ff');
    rect(c, x + 8, base - h + 3, w - 16, 5, '#3f78e0');
    rect(c, x + 10, base - h + 5, w - 20, 1, '#ffffff');
    rect(c, x + w / 2 - 4, base - 10, 8, 10, '#7fc7ff');
    windows(c, x + 2, base - h + 10, 12, 10, mood, random);
  },
  gym(c, x, base, mood) {
    const w = 58;
    const h = 30;
    rect(c, x, base - h, w, h, '#d9d2c4');
    rect(c, x + w - 4, base - h, 4, h, '#b8b0a2');
    for (let dy = 0; dy < 10; dy++) rect(c, x - 3 + dy, base - h - 10 + dy, w + 6 - dy * 2, 1, dy < 2 ? '#8a8496' : '#5f5a6e');
    rect(c, x + w / 2 - 6, base - h - 4, 12, 8, '#f2c94c');
    rect(c, x + w / 2 - 4, base - h - 2, 8, 4, '#c8961c');
    rect(c, x + w / 2 - 6, base - 14, 12, 14, '#4a4458');
    for (let i = 0; i < 4; i++) rect(c, x + 5 + i * 13, base - h + 6, 3, h - 6, '#ece6da');
    void mood;
  },
  tall(c, x, base, mood, random) {
    const h = 40 + Math.floor(random() * 30);
    rect(c, x, base - h, 30, h, '#b9c3d6');
    rect(c, x + 26, base - h, 4, h, '#929db3');
    windows(c, x, base - h, 26, h, mood, random, 2, 3);
  },
};

const LANDMARKS: Record<string, { width: number; draw: (c: Ctx, x: number, base: number, mood: Mood, random: () => number) => void }> = {
  lab: {
    width: 56,
    draw(c, x, base, mood, random) {
      rect(c, x, base - 28, 56, 28, '#f2f4f6');
      rect(c, x + 52, base - 28, 4, 28, '#cdd2d8');
      rect(c, x - 2, base - 33, 60, 5, '#7c8a96');
      rect(c, x + 40, base - 44, 2, 11, '#7c8a96');
      disc(c, x + 41, base - 46, 4, '#c8d0d8', 1);
      windows(c, x + 2, base - 26, 50, 16, mood, random, 4, 4);
      rect(c, x + 24, base - 10, 8, 10, '#5a6672');
    },
  },
  museum: {
    width: 66,
    draw(c, x, base) {
      rect(c, x, base - 30, 66, 30, '#c9bda8');
      for (let dy = 0; dy < 12; dy++) rect(c, x - 2 + dy * 2.5, base - 42 + dy, 70 - dy * 5, 1, dy < 2 ? '#e6dccb' : '#b0a28a');
      for (let i = 0; i < 6; i++) rect(c, x + 4 + i * 11, base - 28, 4, 28, '#efe7d8');
      rect(c, x - 2, base - 3, 70, 3, '#a89a83');
    },
  },
  bridge: {
    width: 70,
    draw(c, x, base) {
      rect(c, x, base - 10, 70, 4, '#b07a4a');
      for (let i = 0; i <= 7; i++) rect(c, x + i * 10, base - 16, 2, 16, '#8a5a34');
      rect(c, x, base - 16, 70, 2, '#d39a60');
    },
  },
  ship: {
    width: 90,
    draw(c, x, base) {
      // A big white liner in the harbor.
      for (let dy = 0; dy < 12; dy++) rect(c, x + dy, base - 12 + dy, 90 - dy * 2, 1, dy < 3 ? '#2c3e66' : '#f6f6f6');
      rect(c, x + 10, base - 22, 66, 10, '#ffffff');
      rect(c, x + 20, base - 30, 44, 8, '#f2f2f2');
      for (let i = 0; i < 3; i++) {
        rect(c, x + 26 + i * 14, base - 42, 7, 12, '#d84a3c');
        rect(c, x + 26 + i * 14, base - 42, 7, 3, '#2a2a33');
      }
      for (let i = 0; i < 12; i++) rect(c, x + 13 + i * 5, base - 18, 2, 2, '#4a6a9c');
    },
  },
  tower: {
    width: 26,
    draw(c, x, base, mood, random) {
      // A tall, quiet tower.
      rect(c, x, base - 78, 26, 78, '#6c5a8f');
      rect(c, x + 22, base - 78, 4, 78, '#55467a');
      for (let dy = 0; dy < 18; dy++) rect(c, x + 13 - (dy * 13) / 18, base - 96 + dy, 2 + (dy * 26) / 18, 1, '#4a3d6e');
      windows(c, x, base - 74, 22, 70, mood, random, 2, 6);
    },
  },
  store: {
    width: 52,
    draw(c, x, base, mood, random) {
      rect(c, x, base - 70, 52, 70, '#e8e2d6');
      rect(c, x + 48, base - 70, 4, 70, '#c8c0b0');
      rect(c, x, base - 74, 52, 4, '#3f8f52');
      windows(c, x, base - 68, 48, 64, mood, random, 3, 3);
      rect(c, x + 20, base - 10, 12, 10, '#7fc7ff');
    },
  },
  skyscraper: {
    width: 44,
    draw(c, x, base, mood, random) {
      rect(c, x, base - 100, 44, 100, '#9aa7c2');
      rect(c, x + 38, base - 100, 6, 100, '#7a87a3');
      rect(c, x + 18, base - 112, 2, 12, '#7a87a3');
      windows(c, x, base - 98, 38, 96, mood, random, 2, 3);
    },
  },
  gate: {
    width: 50,
    draw(c, x, base) {
      rect(c, x, base - 22, 50, 22, '#c9a46a');
      for (let dy = 0; dy < 10; dy++) rect(c, x - 4 + dy, base - 32 + dy, 58 - dy * 2, 1, dy < 2 ? '#8fbf4a' : '#5f9a3a');
      rect(c, x + 19, base - 14, 12, 14, '#5a3e2b');
    },
  },
  league: {
    width: 96,
    draw(c, x, base, mood, random) {
      rect(c, x, base - 40, 96, 40, '#e6e0f2');
      rect(c, x + 90, base - 40, 6, 40, '#c2b9d8');
      disc(c, x + 48, base - 40, 18, '#7b5cff', 1);
      rect(c, x + 28, base - 40, 40, 2, '#5a3fd0');
      for (let i = 0; i < 8; i++) rect(c, x + 5 + i * 12, base - 36, 4, 36, '#f6f2ff');
      rect(c, x + 3, base - 58, 2, 18, '#9a92b0');
      rect(c, x + 5, base - 58, 10, 6, '#ffcf4a');
      rect(c, x + 91, base - 58, 2, 18, '#9a92b0');
      rect(c, x + 81, base - 58, 10, 6, '#ffcf4a');
      void mood;
      void random;
    },
  },
};

/** Each city's skyline, left to right (landmarks, then services). */
const FEATURES: Record<string, string[]> = {
  pallet: ['house', 'lab', 'house', 'center'],
  viridian: ['house', 'center', 'house', 'mart', 'gym', 'house'],
  pewter: ['house', 'museum', 'center', 'mart', 'gym'],
  cerulean: ['house', 'center', 'gym', 'mart', 'bridge'],
  vermilion: ['house', 'center', 'mart', 'gym', 'ship'],
  lavender: ['house', 'tower', 'center', 'mart', 'house'],
  celadon: ['house', 'store', 'center', 'gym', 'tall', 'house'],
  fuchsia: ['gate', 'house', 'center', 'mart', 'gym', 'house'],
  saffron: ['tall', 'skyscraper', 'center', 'tall', 'gym', 'mart', 'tall'],
  cinnabar: ['lab', 'center', 'mart', 'gym'],
  indigo: ['house', 'league', 'center', 'mart'],
};
