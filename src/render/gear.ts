// The player's gear as little pixel-art pictures (32×32, drawn by code with render/pixel.ts; PokeAPI has no Pokédex
// or bag sprite): the Pokédex (the classic red device: a big blue lens, three lights, a hinge, a green screen) and
// the bag (a yellow backpack: a handle, a flap with a buckle, a front pocket). The city's bottom bar shows them.

import { Pixels, rgb, shape, tone, type RGB } from './pixel';

export type Gear = 'pokedex' | 'bag';

const SIZE = 32;
const cache = new Map<Gear, string>();

/** The picture as an image URL (painted once). */
export function gearPicture(gear: Gear): string {
  let url = cache.get(gear);
  if (!url) {
    const p = new Pixels(SIZE, SIZE);
    (gear === 'pokedex' ? paintPokedex : paintBag)(p);
    url = p.toCanvas().toDataURL('image/png');
    cache.set(gear, url);
  }
  return url;
}

/** A rectangle with its corners cut (rounded, in pixels). */
const rounded = (x0: number, y0: number, x1: number, y1: number, cut = 2) => (x: number, y: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.min(x - x0, x1 - x);
  const dy = Math.min(y - y0, y1 - y);
  return dx + dy >= cut;
};

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Lit on the left, shaded on the right and along the bottom. */
const lit = (base: RGB, x0: number, x1: number, y1: number) => (x: number, y: number) => {
  if (x <= x0 + 1) return tone(base, 0.28);
  if (x >= x1 - 2 || y >= y1 - 1) return tone(base, -0.25);
  return base;
};

function paintPokedex(p: Pixels) {
  const outline = rgb('#2a1218');
  const red = rgb('#e3343c');
  // The body.
  shape(p, 6, 2, 25, 29, rounded(6, 2, 25, 29, 3), lit(red, 6, 25, 29), outline);
  // The hinge, between the lid (lens and lights) and the screen.
  for (let x = 7; x <= 24; x++) p.set(x, 12, tone(red, -0.45));
  for (let x = 7; x <= 24; x++) p.set(x, 13, tone(red, 0.2));
  // The big blue lens: a white ring, blue glass, a glint.
  shape(p, 7, 3, 15, 11, disc(11, 7, 3.6), () => rgb('#f4f6ff'), outline);
  shape(p, 8, 4, 14, 10, disc(11, 7, 2.3), (x, y) => (x + y < 17 ? rgb('#8fd0ff') : rgb('#2f86e0')), null);
  p.set(10, 6, rgb('#ffffff'));
  // Three small lights: red, yellow, green.
  ([
    [17, '#ff4a4a'],
    [20, '#ffd84a'],
    [23, '#5ee36a'],
  ] as const).forEach(([x, color]) => {
    p.set(x, 5, rgb(color));
    p.set(x, 4, outline);
    p.set(x, 6, outline);
  });
  // The screen.
  shape(p, 9, 15, 22, 23, rounded(9, 15, 22, 23, 1), (_x, y) => (y === 16 ? rgb('#d8f4c8') : y % 2 ? rgb('#a6dc96') : rgb('#9ad08a')), outline);
  for (let x = 11; x <= 17; x++) p.set(x, 19, rgb('#5f9a52'));
  for (let x = 11; x <= 15; x++) p.set(x, 21, rgb('#5f9a52'));
  // A d-pad and two buttons.
  for (const [x, y] of [
    [10, 26],
    [11, 25],
    [11, 26],
    [11, 27],
    [12, 26],
  ]) p.set(x, y, rgb('#2a2230'));
  p.set(19, 26, rgb('#2a2230'));
  p.set(22, 26, rgb('#2a2230'));
  p.set(19, 25, tone(red, 0.4));
  p.set(22, 25, tone(red, 0.4));
}

function paintBag(p: Pixels) {
  const outline = rgb('#3a2410');
  const yellow = rgb('#f2b23a');
  const flap = rgb('#d98a1e');
  // The handle.
  shape(p, 11, 2, 20, 9, (x, y) => {
    const d = Math.hypot(x - 15.5, (y - 8) * 1.2);
    return y <= 8 && d <= 5.2 && d >= 3;
  }, () => rgb('#8a5a2a'), outline);
  // The body.
  shape(p, 5, 7, 26, 29, rounded(5, 7, 26, 29, 4), lit(yellow, 5, 26, 29), outline);
  // The flap: darker, with a rounded lower edge, and its buckle.
  shape(
    p,
    6,
    8,
    25,
    17,
    (x, y) => rounded(5, 7, 26, 29, 4)(x, y) && y >= 8 && y <= 15 + (Math.abs(x - 15.5) < 5 ? 2 : Math.abs(x - 15.5) < 8 ? 1 : 0),
    lit(flap, 6, 25, 17),
    null,
  );
  for (let x = 7; x <= 24; x++) {
    const bottom = 15 + (Math.abs(x - 15.5) < 5 ? 2 : Math.abs(x - 15.5) < 8 ? 1 : 0);
    p.set(x, bottom + 1, tone(flap, -0.5));
  }
  shape(p, 13, 15, 18, 20, rounded(13, 15, 18, 20, 1), (_x, y) => (y === 16 ? rgb('#f4f0e0') : rgb('#bdb6a4')), outline);
  // The front pocket, with stitches.
  shape(p, 9, 21, 22, 27, rounded(9, 21, 22, 27, 1), () => tone(yellow, 0.12), tone(yellow, -0.45));
  for (let x = 11; x <= 20; x += 2) p.set(x, 23, tone(yellow, -0.3));
}
