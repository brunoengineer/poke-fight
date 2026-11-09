// The two places that are not towns, each with a picture of its own (painted by code, 480×270 art pixels, like the
// towns in render/town.ts): the Pokémon League (a palace on its plateau at sunset, in its region's color) and the
// Legends' Sanctuary (an ancient shrine under the night sky's aurora, a crystal floating in its arch). As with the
// towns, what matters sits in the top band (above y ≈ 100), which the city screen's cards leave visible.

import { REGIONS, type Region } from '../data/regions';
import { bayer, clumps, mix, noise, Pixels, rgb, seeded, shape, smooth, tone, type RGB } from './pixel';

const W = 480;
const H = 270;
const OUTLINE = rgb('#2a2238');

export type Landmark = { kind: 'league' | 'sanctuary'; region: Region };

/** Whether this place is a region's League or its sanctuary (then it has its own picture). */
export function landmarkOf(placeId: string): Landmark | null {
  for (const region of REGIONS) {
    if (region.league.city === placeId) return { kind: 'league', region };
    if (region.sanctuary.id === placeId) return { kind: 'sanctuary', region };
  }
  return null;
}

export function paintLandmark(l: Landmark): Pixels {
  return l.kind === 'league' ? paintLeague(l.region) : paintSanctuary(l.region);
}

// ── Shared ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A vertical gradient through these colors, dithered between bands (as a pixel artist paints a sky). */
function sky(p: Pixels, y0: number, y1: number, colors: readonly RGB[]) {
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / (y1 - y0)) * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(t));
    for (let x = 0; x < W; x++) {
      const f = t - i;
      // Four steps between two colors, dithered.
      const step = Math.floor(f * 4 + bayer(x, y) * 0.999) / 4;
      p.set(x, y, mix(colors[i], colors[i + 1], step));
    }
  }
}

/** A mountain range's silhouette: a ragged ridge, filled to the bottom. */
function ridge(p: Pixels, base: number, height: number, color: RGB, seed: number, scale: number) {
  for (let x = 0; x < W; x++) {
    const top = base - height * (0.45 * smooth(x, 0, scale, seed) + 0.35 * smooth(x, 3, scale / 3, seed + 1) + 0.2 * noise(x >> 1, 0, seed));
    for (let y = Math.floor(top); y < base; y++) p.set(x, y, color);
  }
}

/** A soft glow (dithered rings of a color over what is there). */
function glow(p: Pixels, cx: number, cy: number, r: number, color: RGB, strength: number) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d < 1) p.blend(x, y, color, strength * (1 - d) * (0.75 + bayer(x, y) * 0.5));
    }
  }
}

const tree = (p: Pixels, x: number, base: number, size: number, leaves: RGB[], line: RGB) => {
  p.oval(x + 2, base + 1, 9 * size, 3 * size, OUTLINE, 0.3);
  p.rect(x - 1, base - 6 * size, 3, 6 * size, rgb('#5e3a22'));
  clumps(
    p,
    [
      { x: x - 5 * size, y: base - 12 * size, r: 7 * size },
      { x: x + 5 * size, y: base - 13 * size, r: 7 * size },
      { x, y: base - 20 * size, r: 8 * size },
      { x, y: base - 10 * size, r: 7 * size },
    ],
    leaves,
    line,
  );
};

/** A flame (braziers, lanterns): a teardrop of hot colors, flickering by its seed. */
function flame(p: Pixels, cx: number, base: number, size: number, colors: readonly RGB[], seed: number) {
  for (let y = 0; y < size * 2.4; y++) {
    const t = y / (size * 2.4);
    const half = Math.round(size * Math.sin(Math.PI * (1 - t) * 0.9) * (1 - t * 0.4));
    const sway = Math.round(Math.sin(t * 4 + seed) * t * 1.5);
    for (let x = -half; x <= half; x++) {
      const core = Math.abs(x) / Math.max(1, half);
      const c = core < 0.35 && t < 0.7 ? colors[2] : core < 0.7 ? colors[1] : colors[0];
      p.set(cx + x + sway, base - y, c);
    }
  }
}

/** Paving: stone slabs in rows (offset every other row), each a little lighter or darker. */
function paving(p: Pixels, x0: number, y0: number, w: number, h: number, tones: readonly RGB[], seed: number) {
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 6);
    for (let x = x0; x < x0 + w; x++) {
      const col = Math.floor((x - x0 + (row % 2) * 6) / 12);
      const joint = (y - y0) % 6 === 5 || (x - x0 + (row % 2) * 6) % 12 === 11;
      const shade = noise(col, row, seed) > 0.7 ? 2 : noise(col, row, seed) < 0.25 ? 0 : 1;
      p.set(x, y, joint ? tones[3] : tones[shade]);
    }
  }
}

// ── The Pokémon League: a palace at sunset ────────────────────────────────────────────────────────────────────────

export function paintLeague(region: Region): Pixels {
  const p = new Pixels(W, H);
  const accent = rgb(region.color);
  const gold = [rgb('#8a5a1a'), rgb('#d29a2e'), rgb('#f2c84a'), rgb('#fff0a8')];
  const stone = [rgb('#b9ad98'), rgb('#e6dcc6'), rgb('#f6efde'), rgb('#8f8270')];
  const random = seeded(region.id.length * 977 + 13);
  const cx = W / 2;

  // The sky at sunset, the sun going down behind the palace, long clouds.
  sky(p, 0, 92, [rgb('#2c1f5e'), rgb('#5a3a8a'), rgb('#c0567e'), rgb('#ff9a5c'), rgb('#ffd08a')]);
  glow(p, cx, 66, 70, rgb('#ffe2a0'), 0.55);
  for (let y = 46; y < 88; y++) for (let x = cx - 26; x <= cx + 26; x++) if (Math.hypot(x - cx, y - 66) < 22) p.set(x, y, y < 60 ? rgb('#fff3c4') : rgb('#ffe08a'));
  for (const [x, y, w] of [
    [40, 22, 90],
    [300, 16, 120],
    [150, 34, 70],
    [370, 40, 80],
  ]) {
    for (let i = 0; i < w; i++) {
      const thick = Math.round(3 * Math.sin((i / w) * Math.PI));
      for (let j = 0; j <= thick; j++) p.set(x + i, y + j, j === 0 ? rgb('#ffb8a0') : rgb('#d0708a'));
    }
  }
  // The plateau's far mountains, then the plateau itself.
  ridge(p, 96, 34, rgb('#7a4a7e'), 11, 70);
  ridge(p, 100, 18, rgb('#5a3a6a'), 12, 40);
  paving(p, 0, 92, W, H - 92, stone, 3);
  // Lawns on both sides, and trees.
  for (const [x0, x1] of [
    [0, 120],
    [360, W],
  ]) {
    for (let y = 92; y < H; y++) for (let x = x0; x < x1; x++) p.set(x, y, noise(x >> 1, y >> 1, 4) > 0.8 ? rgb('#5a9a48') : rgb('#4a8a40'));
  }
  const leaves = [rgb('#1f4a34'), rgb('#2f6a40'), rgb('#3f8a48'), rgb('#62a85a')];
  for (const x of [18, 58, 98, 382, 422, 462]) tree(p, x + Math.round(random() * 6), 104 + Math.round(random() * 4), 1.1, leaves, rgb('#132a20'));

  // The palace. Its walls: dressed stone, in courses of blocks (offset every other course).
  const block = (x: number, y: number) => ((y % 6 === 5 || (x + (Math.floor(y / 6) % 2) * 5) % 10 === 9) ? stone[0] : noise(x >> 3, y >> 2, 31) > 0.75 ? stone[2] : stone[1]);
  const hall = { x0: 150, x1: 330, top: 58, base: 98 };
  // Walls: lit stone, column after column, tall arched windows between them.
  shape(p, hall.x0, hall.top, hall.x1, hall.base, (x, y) => x >= hall.x0 && x <= hall.x1 && y >= hall.top && y <= hall.base, (x, y) => (y < hall.top + 3 ? stone[2] : block(x, y - hall.top)), OUTLINE);
  for (let x = hall.x0 + 6; x < hall.x1 - 4; x += 15) {
    p.rect(x, hall.top + 3, 4, hall.base - hall.top - 4, stone[2]);
    p.rect(x + 3, hall.top + 3, 1, hall.base - hall.top - 4, stone[0]);
    p.rect(x - 1, hall.top + 3, 6, 2, stone[3]);
    p.rect(x - 1, hall.base - 3, 6, 2, stone[3]);
    if (x + 15 < hall.x1 - 4 && (x < 200 || x > 268)) {
      // An arched window, lit from inside.
      const wx = x + 6;
      for (let y = hall.top + 10; y < hall.top + 30; y++) {
        for (let i = 0; i < 6; i++) {
          const arch = y < hall.top + 13 && Math.abs(i - 2.5) > 1.5 + (y - hall.top - 10);
          if (arch) continue;
          p.set(wx + i, y, i === 0 || i === 5 || y === hall.top + 29 ? OUTLINE : y < hall.top + 18 ? rgb('#fff4c2') : rgb('#ffc861'));
        }
      }
    }
  }
  // Banners between the windows, in the region's color with a gold crest.
  for (const bx of [176, 296]) {
    for (let y = hall.top + 4; y < hall.top + 34; y++) {
      const tip = y > hall.top + 29 ? Math.abs(Math.floor(y - hall.top - 29)) : 0;
      for (let i = tip; i < 10 - tip; i++) p.set(bx + i, y, i === tip || i === 9 - tip ? tone(accent, -0.4) : i < 3 ? tone(accent, 0.15) : accent);
    }
    p.rect(bx + 3, hall.top + 12, 4, 4, gold[2]);
    p.set(bx + 4, hall.top + 13, gold[3]);
  }
  // The roof: a band in the region's color with gold trim.
  for (let y = 44; y < hall.top; y++) {
    const inset = Math.round((hall.top - y) * 0.6);
    for (let x = hall.x0 - 6 + inset; x <= hall.x1 + 6 - inset; x++) {
      const edge = x === hall.x0 - 6 + inset || x === hall.x1 + 6 - inset || y === 44;
      p.set(x, y, edge ? OUTLINE : (x + y) % 4 === 0 ? tone(accent, -0.25) : y < 48 ? tone(accent, 0.25) : accent);
    }
  }
  p.rect(hall.x0 - 6, hall.top - 1, hall.x1 - hall.x0 + 13, 2, gold[2]);
  p.rect(hall.x0 - 6, hall.top + 1, hall.x1 - hall.x0 + 13, 1, gold[0]);
  // Side towers with pointed roofs and flags.
  for (const tx of [hall.x0 - 4, hall.x1 - 16]) {
    shape(p, tx, 28, tx + 20, hall.top, (x, y) => x >= tx && x <= tx + 20 && y >= 28 && y <= hall.top, (x, y) => (x < tx + 4 ? stone[2] : block(x, y)), OUTLINE);
    p.rect(tx + 8, 36, 5, 9, OUTLINE);
    p.rect(tx + 9, 37, 3, 7, rgb('#ffd27a'));
    for (let y = 10; y < 28; y++) {
      const half = Math.round(((y - 10) / 18) * 12);
      for (let x = -half; x <= half; x++) p.set(tx + 10 + x, y, Math.abs(x) === half || y === 27 ? OUTLINE : x < 0 ? tone(accent, 0.2) : tone(accent, -0.15));
    }
    p.rect(tx + 10, 2, 1, 9, OUTLINE);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 7 - j; i++) p.set(tx + 11 + i, 2 + j, j === 0 ? rgb('#ff8a7a') : rgb('#e0403a'));
  }
  // The portico: a gable with the crest, columns, the great door glowing.
  const gable = { x0: cx - 42, x1: cx + 42, top: 26 };
  for (let y = gable.top; y < hall.top + 4; y++) {
    const half = Math.round(((y - gable.top) / (hall.top + 4 - gable.top)) * 44);
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) >= half - 1 || y === hall.top + 3;
      p.set(cx + x, y, edge ? gold[1] : y < gable.top + 3 ? stone[2] : stone[1]);
    }
  }
  // The crest: a gold ring around a white heart, like a Poké Ball seen from the front.
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y);
      if (d > 8.5) continue;
      p.set(cx + x, 44 + y, d > 7 ? gold[0] : d > 5 ? (x + y < 0 ? gold[3] : gold[2]) : y === 0 || Math.abs(y) === 1 ? gold[1] : y < 0 ? accent : rgb('#ffffff'));
    }
  }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) <= 2.4) p.set(cx + x, 44 + y, Math.hypot(x, y) < 1.3 ? rgb('#ffffff') : gold[0]);
  for (const k of [-36, -22, 18, 32]) {
    p.rect(cx + k, hall.top + 4, 5, hall.base - hall.top - 4, stone[2]);
    p.rect(cx + k + 4, hall.top + 4, 1, hall.base - hall.top - 4, stone[0]);
    p.rect(cx + k - 1, hall.top + 4, 7, 2, gold[1]);
  }
  shape(p, cx - 12, 72, cx + 12, hall.base, (x, y) => Math.abs(x - cx) <= 12 && y >= 72 && y <= hall.base && !(y < 78 && Math.abs(x - cx) > 12 - (y - 72) * 2), (_, y) => (y < 80 ? rgb('#fff4c2') : rgb('#ffcf6a')), gold[0]);
  p.rect(cx, 74, 1, hall.base - 74, gold[0]);
  // The central tower and its golden dome, the flag on top.
  shape(p, cx - 14, 12, cx + 14, gable.top + 2, (x, y) => Math.abs(x - cx) <= 14 && y >= 12 && y <= gable.top + 2, (x, y) => (x < cx - 10 ? stone[2] : block(x, y)), OUTLINE);
  for (const wx of [cx - 9, cx + 4]) {
    p.rect(wx, 15, 5, 8, OUTLINE);
    p.rect(wx + 1, 16, 3, 6, rgb('#ffd27a'));
  }
  for (let y = 0; y < 12; y++) {
    const half = Math.round(16 * Math.sqrt(1 - ((11 - y) / 12) ** 2));
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) >= half;
      const lit = x < -half / 3 ? 3 : x < half / 3 ? 2 : 1;
      p.set(cx + x, y + 1, edge ? gold[0] : gold[lit - (bayer(x, y) < 0.25 ? 1 : 0)]);
    }
  }
  p.rect(cx - 16, 12, 33, 1, gold[0]);

  // The stairs down to the plaza, a red carpet, and braziers on either side.
  for (let s = 0; s < 6; s++) {
    const y = hall.base + 1 + s * 2;
    const half = 52 + s * 6;
    p.rect(cx - half, y, half * 2, 1, stone[2]);
    p.rect(cx - half, y + 1, half * 2, 1, stone[3]);
  }
  for (let y = hall.base; y < H; y++) {
    const half = 7;
    for (let x = -half; x <= half; x++) p.set(cx + x, y, Math.abs(x) === half ? gold[1] : x < -3 ? rgb('#d8384a') : rgb('#b82838'));
  }
  for (const bx of [cx - 70, cx + 70]) {
    p.oval(bx + 2, 117, 10, 3, OUTLINE, 0.35);
    p.rect(bx - 2, 100, 5, 16, stone[1]);
    p.rect(bx + 2, 100, 1, 16, stone[0]);
    for (let i = -7; i <= 7; i++) p.set(bx + i, 99, OUTLINE);
    for (let i = -6; i <= 6; i++) p.set(bx + i, 98, gold[i < 0 ? 2 : 1]);
    flame(p, bx, 97, 5, [rgb('#e2361a'), rgb('#ff9a2e'), rgb('#fff4b8')], bx);
    glow(p, bx, 90, 26, rgb('#ffcf7a'), 0.35);
  }
  // Flag poles along the plaza below.
  for (const fx of [140, 340, 100, 380]) {
    const base = fx === 140 || fx === 340 ? 150 : 200;
    p.rect(fx, base - 40, 2, 40, rgb('#d8d0c0'));
    for (let j = 0; j < 9; j++) for (let i = 0; i < 14 - Math.floor(j / 3); i++) p.set(fx + 2 + i, base - 40 + j, j < 3 ? tone(accent, 0.2) : accent);
  }
  return p;
}

// ── The Legends' Sanctuary: an ancient shrine under the aurora ────────────────────────────────────────────────────

export function paintSanctuary(region: Region): Pixels {
  const p = new Pixels(W, H);
  // The sanctuary's own color (its theme in the menus: violet in Kanto, gold in Johto…), as glowing light.
  const accent = rgb(region.sanctuary.art.color);
  const aura = tone(accent, 0.35);
  const marble = [rgb('#7a7e9e'), rgb('#a8abc8'), rgb('#cfd2e8'), rgb('#4a4c6a')];
  const random = seeded(region.id.length * 131 + 7);
  const cx = W / 2;

  // The night sky, stars, the aurora's ribbons, the moon.
  sky(p, 0, 110, [rgb('#070822'), rgb('#141640'), rgb('#2a2466'), rgb('#4a3a7e')]);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * 96);
    const bright = random();
    p.set(x, y, bright > 0.85 ? rgb('#ffffff') : bright > 0.5 ? rgb('#c8d4ff') : rgb('#7a86c8'));
    if (bright > 0.95) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.blend(x + dx, y + dy, rgb('#ffffff'), 0.5);
  }
  for (const [y0, amp, color, phase] of [
    [26, 10, accent, 0],
    [40, 8, mix(accent, rgb('#9a6aff'), 0.6), 2],
    [16, 6, mix(accent, rgb('#7aff9a'), 0.5), 4],
  ] as const) {
    for (let x = 0; x < W; x++) {
      const top = y0 + Math.sin(x / 38 + phase) * amp + Math.sin(x / 13 + phase) * 2;
      const strength = 0.5 + 0.5 * Math.sin(x / 60 + phase * 1.7);
      for (let y = Math.floor(top); y < top + 22; y++) {
        const t = (y - top) / 22;
        // Bright at the bottom edge of each ribbon, fading upwards in streaks.
        const streak = 0.6 + 0.4 * noise(x >> 1, 0, phase);
        p.blend(x, y, color, strength * streak * (t < 0.15 ? 0.15 : 0.55 * t) * (bayer(x, y) < 0.8 ? 1 : 0.5));
      }
    }
  }
  // (Right of the arch: the place's name is written over the left of the sky.)
  const moon = { x: 330, y: 24, r: 11 };
  glow(p, moon.x, moon.y, 34, rgb('#c8d4ff'), 0.4);
  for (let y = -moon.r; y <= moon.r; y++) {
    for (let x = -moon.r; x <= moon.r; x++) {
      const d = Math.hypot(x, y);
      if (d > moon.r) continue;
      const crater = noise((x + 20) >> 2, (y + 20) >> 2, 9) > 0.78;
      p.set(moon.x + x, moon.y + y, d > moon.r - 1 ? rgb('#c8cfe8') : crater ? rgb('#d8dcf0') : x + y < -6 ? rgb('#ffffff') : rgb('#f0f2ff'));
    }
  }

  // Far mountains in the mist, then the shrine's terrace.
  ridge(p, 92, 40, rgb('#1e1f4a'), 21, 80);
  for (let y = 70; y < 96; y++) for (let x = 0; x < W; x++) p.blend(x, y, rgb('#8a8ac8'), ((y - 70) / 26) * 0.35 * (bayer(x, y) < 0.7 ? 1 : 0.6));
  ridge(p, 98, 16, rgb('#141538'), 22, 30);
  paving(p, 0, 96, W, H - 96, marble, 5);
  // Moss in the joints, and a glow over the terrace.
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) if (smooth(x, y, 14, 6) > 0.68 && noise(x, y, 7) > 0.45) p.set(x, y, noise(x, y, 8) > 0.5 ? rgb('#3f7a5a') : rgb('#2f5e48'));
  // Pines in silhouette at both edges.
  for (const x of [8, 30, 54, 426, 450, 472]) {
    const h = 50 + Math.round(random() * 20);
    for (let y = 0; y < h; y++) {
      const half = Math.round((y / h) * 12) + (y % 6 < 2 ? 1 : 0);
      for (let i = -half; i <= half; i++) p.set(x + i, 104 - h + y, i < -half / 2 ? rgb('#1a2a3a') : rgb('#0f1a28'));
    }
  }

  // Broken columns on both sides, ivy on them, stone lanterns with cold flames.
  const column = (x: number, top: number, base: number, broken: boolean) => {
    shape(p, x, top, x + 11, base, (i, j) => i >= x && i <= x + 11 && j >= top && j <= base && !(broken && j < top + 3 && noise(i, 0, x) > 0.5), i => (i < x + 4 ? marble[2] : (i - x) % 4 === 3 ? marble[0] : marble[1]), OUTLINE);
    p.rect(x - 2, base - 3, 16, 3, marble[1]);
    p.rect(x - 2, base - 1, 16, 1, marble[3]);
    if (!broken) {
      p.rect(x - 2, top, 16, 3, marble[2]);
      p.rect(x - 2, top + 3, 16, 1, marble[3]);
    }
    for (let j = top + 4; j < base - 2; j++) if (noise(x, j, 3) > 0.62) p.set(x + 1 + Math.round(noise(j, x, 4) * 9), j, noise(x, j, 5) > 0.5 ? rgb('#4f9a5a') : rgb('#2f6a40'));
  };
  for (const [x, top, broken] of [
    [96, 52, true],
    [130, 40, false],
    [338, 40, false],
    [372, 58, true],
  ] as const) column(x, top, 100, broken);
  for (const lx of [176, 300]) {
    p.oval(lx + 3, 104, 9, 3, OUTLINE, 0.4);
    shape(p, lx - 5, 84, lx + 5, 103, (i, j) => j >= 84 && j <= 103 && Math.abs(i - lx) <= (j < 88 ? 7 - (j - 84) : j > 98 ? 5 : 3), () => marble[1], OUTLINE);
    p.rect(lx - 2, 89, 5, 5, rgb('#d8fbff'));
    glow(p, lx, 90, 18, aura, 0.5);
  }

  // The great arch: two pillars, a lintel carved with glowing runes.
  const arch = { x0: cx - 46, x1: cx + 46, top: 22, base: 100 };
  for (const px of [arch.x0, arch.x1 - 16]) {
    shape(p, px, arch.top + 12, px + 16, arch.base, (i, j) => i >= px && i <= px + 16 && j >= arch.top + 12 && j <= arch.base, (i, j) => (i < px + 5 ? marble[2] : bayer(i, j) < 0.3 ? marble[0] : marble[1]), OUTLINE);
    for (let j = arch.top + 20; j < arch.base - 6; j += 9) {
      p.rect(px + 6, j, 5, 2, aura);
      p.set(px + 8, j + 2, aura);
    }
  }
  shape(p, arch.x0 - 10, arch.top, arch.x1 + 10, arch.top + 13, (i, j) => i >= arch.x0 - 10 && i <= arch.x1 + 10 && j >= arch.top && j <= arch.top + 13 && !(j < arch.top + 3 && (i < arch.x0 - 6 || i > arch.x1 + 6)), (_, j) => (j < arch.top + 4 ? marble[2] : marble[1]), OUTLINE);
  for (let i = arch.x0 - 2; i < arch.x1 + 2; i += 7) {
    p.rect(i, arch.top + 6, 4, 1, aura);
    p.set(i + 1 + (i % 3), arch.top + 7, aura);
    p.set(i + 2, arch.top + 5, aura);
  }
  glow(p, cx, arch.top + 7, 60, accent, 0.18);

  // The crystal, floating inside the arch, and the rune circle under it.
  const crystal = { x: cx, y: 60 };
  glow(p, crystal.x, crystal.y, 46, accent, 0.55);
  glow(p, crystal.x, crystal.y, 18, rgb('#ffffff'), 0.35);
  for (let y = -16; y <= 16; y++) {
    const half = Math.round((1 - Math.abs(y) / 16) * (y < 0 ? 9 : 8));
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) >= half;
      const facet = x < 0 ? (y < 0 ? 3 : 2) : y < 0 ? 1 : 0;
      const tones = [tone(accent, -0.35), accent, tone(accent, 0.4), tone(accent, 0.75)];
      p.set(crystal.x + x, crystal.y + y, edge ? tone(accent, -0.6) : x === 0 ? rgb('#ffffff') : tones[facet]);
    }
  }
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(y) <= 3) p.blend(crystal.x - 3 + x, crystal.y - 7 + y, rgb('#ffffff'), 0.7);
  // The rune circle on the terrace (an ellipse seen at a slant), and a beam of light down to it.
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    for (const [rx, ry] of [
      [40, 7],
      [30, 5],
    ]) p.set(Math.round(cx + Math.cos(a) * rx), Math.round(100 + Math.sin(a) * ry), i % 9 < 6 ? aura : accent);
  }
  for (let y = crystal.y + 16; y < 100; y++) for (let x = -6; x <= 6; x++) p.blend(cx + x, y, aura, 0.25 * (1 - Math.abs(x) / 7));
  // Sparks rising around it.
  for (let i = 0; i < 40; i++) {
    const x = cx + (random() - 0.5) * 120;
    const y = 30 + random() * 70;
    p.set(x, y, random() > 0.5 ? rgb('#ffffff') : aura);
  }

  // Steps down from the terrace, and a still pool below that mirrors the aurora.
  for (let s = 0; s < 6; s++) {
    const y = 104 + s * 3;
    const half = 60 + s * 8;
    p.rect(cx - half, y, half * 2, 2, marble[2]);
    p.rect(cx - half, y + 2, half * 2, 1, marble[3]);
  }
  for (let y = 150; y < 200; y++) {
    for (let x = 90; x < 390; x++) {
      if (((x - 240) / 150) ** 2 + ((y - 175) / 25) ** 2 >= 1) continue;
      const edge = ((x - 240) / 150) ** 2 + ((y - 175) / 25) ** 2 > 0.86;
      const shimmer = noise(x >> 2, y, 12) > 0.85;
      p.set(x, y, edge ? marble[1] : shimmer ? mix(rgb('#2a2466'), accent, 0.6) : (y + (x >> 3)) % 7 === 0 ? rgb('#2a2a6a') : rgb('#16163e'));
    }
  }
  return p;
}
