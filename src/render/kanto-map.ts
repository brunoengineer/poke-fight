// The world map as pixel art, painted by code (an original drawing of the region, in the spirit of the handheld
// games' town maps): the sea with its surf and shallows, beaches, grass, forests, mountain ranges with snowy peaks,
// a lake and a river, the roads between the cities (sea routes dotted over the water), and each city as a little
// town. 300×180 art pixels: three per unit of the map's 100×60 box (data/art.ts KANTO_MAP).

import { bayer, clumps, mix, noise, Pixels, rgb, smooth, tone, type RGB } from './pixel';

export const MAP_W = 300;
export const MAP_H = 180;
/** Art pixels per unit of the 100 × 60 map box. */
const S = 3;

export interface MapPlace {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

export interface MapRoad {
  from: string;
  to: string;
  open: boolean;
}

// The land: the mainland and Cinnabar Island (shapes made for this map, roughly the region's), in map-box units.
const MAINLAND = 'M5 7 Q18 1 36 4 Q52 1 66 4 Q84 3 89 13 Q94 26 88 38 Q82 49 66 48 Q58 55 46 56 Q36 55 32 49 L18 49 Q8 46 8 32 Q3 18 5 7 Z';
const ISLANDS: { x: number; y: number; r: number }[] = [
  { x: 21, y: 55.5, r: 4.4 },
  // A few islets, for the sea routes to pass by.
  { x: 33, y: 57.5, r: 1.2 },
  { x: 95, y: 44, r: 1.4 },
  { x: 3, y: 52, r: 1.6 },
];
const LAKE = { x: 67, y: 9.5, rx: 4.2, ry: 2.2 };
/** The river from the lake to the north shore. */
const RIVER: [number, number][] = [
  [67, 9],
  [71, 7.5],
  [74, 6],
  [77, 4.5],
  [80, 3],
];

/** Mountain ranges: [x, y (foot), size]. Mt. Moon, the Rock Tunnel, Victory Road and the plateau, and a few hills. */
const MOUNTAINS: [number, number, number][] = [
  // Mt. Moon
  [34, 11, 1.1],
  [38, 9.5, 1.3],
  [41.5, 11.5, 1],
  [36.5, 13, 0.8],
  [44, 10, 0.8],
  // Rock Tunnel
  [70, 17, 1.2],
  [73.5, 19, 1],
  [67.5, 19.5, 0.8],
  [76, 16.5, 0.8],
  // Victory Road and the Indigo Plateau
  [11, 20, 1.2],
  [14, 22.5, 1],
  [8.5, 23.5, 0.9],
  [6.5, 14, 0.8],
  [16, 6.5, 0.9],
  [19, 8, 0.7],
  // The eastern hills
  [84, 30, 0.8],
  [86.5, 33, 0.7],
];

/** Forests: [x, y, radius]. Viridian Forest, the woods around the Safari Zone, groves along the routes. */
const FORESTS: [number, number, number][] = [
  [17.5, 22, 5.5],
  [27, 20, 2.5],
  [47, 44, 4.5],
  [39, 47, 2.5],
  [80, 40, 3],
  [52, 18, 2.2],
  [12, 40, 3],
  [62, 36, 2],
];

const C = {
  deep: rgb('#1f4fa8'),
  sea: rgb('#2f6fd0'),
  shallow: rgb('#4f9ae8'),
  surf: rgb('#a8dcff'),
  foam: rgb('#eef9ff'),
  sand: rgb('#f0dca0'),
  sandDark: rgb('#d8bc7c'),
  grass: rgb('#6cc04a'),
  grassDark: rgb('#4f9e3e'),
  grassLight: rgb('#8fd660'),
  road: rgb('#f2e2aa'),
  roadEdge: rgb('#b8955a'),
  roadLocked: rgb('#a9a088'),
  outline: rgb('#2a2238'),
};

const LEAVES = [rgb('#1f5a34'), rgb('#2f7a40'), rgb('#3f9a48'), rgb('#62b85a'), rgb('#8ed676')];

/** The land as a mask, from the shapes drawn on a small canvas (only this module's own canvas is read). */
function landMask(): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(MAINLAND));
  for (const i of ISLANDS) {
    ctx.beginPath();
    ctx.arc(i.x, i.y, i.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const land = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < land.length; i++) land[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  // A rugged coast: bite into the land and push it out, here and there.
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? 0 : land[y * MAP_W + x]);
  const next = land.slice();
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const edge = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1);
      const n = noise(x >> 1, y >> 1, 11);
      if (land[y * MAP_W + x] && edge < 4 && n > 0.8) next[y * MAP_W + x] = 0;
      if (!land[y * MAP_W + x] && edge > 1 && n < 0.25) next[y * MAP_W + x] = 1;
    }
  }
  return next;
}

/** For every pixel, how far the nearest pixel of the other kind (land / water) is, up to `max`. */
function distances(land: Uint8Array, max: number): Uint8Array {
  const d = new Uint8Array(MAP_W * MAP_H).fill(max);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const me = land[y * MAP_W + x];
      let best = max;
      for (let j = -max; j <= max && best > 1; j++) {
        for (let i = -max; i <= max; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
          if (land[yy * MAP_W + xx] !== me) best = Math.min(best, Math.max(Math.abs(i), Math.abs(j)));
        }
      }
      d[y * MAP_W + x] = best;
    }
  }
  return d;
}

let base: { pixels: Pixels; land: Uint8Array } | null = null;

/** The sea, the land, the lake, the forests and the mountains: the same for every visit, painted once. */
function paintBase(): { pixels: Pixels; land: Uint8Array } {
  const p = new Pixels(MAP_W, MAP_H);
  const land = landMask();
  // The lake and the river are water inside the land.
  const water = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (((x / S - LAKE.x) / LAKE.rx) ** 2 + ((y / S - LAKE.y) / LAKE.ry) ** 2 < 1) water[y * MAP_W + x] = 1;
    }
  }
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, ay] = RIVER[i];
    const [bx, by] = RIVER[i + 1];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = Math.round((ax + (bx - ax) * t) * S);
      const y = Math.round((ay + (by - ay) * t) * S + Math.sin(t * Math.PI * 2) * 1.5);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) water[(y + dy) * MAP_W + x + dx] = 1;
    }
  }
  for (let i = 0; i < land.length; i++) if (water[i]) land[i] = 0;
  const dist = distances(land, 6);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const d = dist[i];
      let c: RGB;
      if (!land[i]) {
        if (water[i]) {
          c = d <= 1 ? C.surf : C.shallow;
        } else {
          // The sea: surf at the coast, then shallows, then deeper water (dithered between the bands).
          const depth = d + (bayer(x, y) - 0.5) * 1.6;
          c = d <= 1 ? (noise(x >> 1, y >> 1, 2) > 0.35 ? C.foam : C.surf) : depth < 2.4 ? C.surf : depth < 4.4 ? C.shallow : C.sea;
          if (d >= 6 && bayer(x, y) < 0.35 + (y / MAP_H) * 0.3) c = mix(C.sea, C.deep, 0.6);
          // Little white caps.
          if (d >= 5 && y % 6 === 0 && noise(x >> 2, y, 3) > 0.86 && (x & 3) !== 0) c = C.surf;
        }
      } else {
        // Beaches, then grass with lighter and darker patches and tufts.
        if (d <= 2 && !nearInlandWater(water, x, y)) {
          c = d === 1 ? C.sandDark : C.sand;
        } else {
          // Large soft patches (dithered at their edges) and a few tufts.
          const n = smooth(x, y, 22, 5) * 0.7 + smooth(x, y, 9, 6) * 0.3;
          c = n > 0.7 + (bayer(x, y) - 0.5) * 0.12 ? C.grassLight : n < 0.24 + (bayer(x, y) - 0.5) * 0.12 ? C.grassDark : C.grass;
          if (noise(x, y, 7) > 0.985) c = C.grassDark;
        }
      }
      p.set(x, y, c);
    }
  }

  // Forests: little round trees, back to front.
  const trees: [number, number][] = [];
  for (const [fx, fy, r] of FORESTS) {
    for (let y = -r; y <= r; y += 1.1) {
      for (let x = -r; x <= r; x += 1.3) {
        const tx = (fx + x + (noise(Math.round(x * 10), Math.round(y * 10), fx) - 0.5) * 0.8) * S;
        const ty = (fy + y + (noise(Math.round(y * 10), Math.round(x * 10), fy) - 0.5) * 0.6) * S;
        if (Math.hypot(x / r, y / r) > 1 || !land[Math.round(ty) * MAP_W + Math.round(tx)]) continue;
        trees.push([Math.round(tx), Math.round(ty)]);
      }
    }
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [tx, ty] of trees) {
    p.blend(tx + 1, ty + 1, C.outline, 0.35);
    p.blend(tx + 2, ty + 1, C.outline, 0.35);
    clumps(p, [{ x: tx + 0.5, y: ty - 2, r: 3.2 }], LEAVES, rgb('#16402a'));
    p.set(tx, ty + 1, rgb('#5e3a22'));
  }

  // Mountains, back to front.
  for (const [mx, my, size] of [...MOUNTAINS].sort((a, b) => a[1] - b[1])) mountain(p, mx * S, my * S, size);

  // A compass rose in the sea.
  compass(p, 282, 160);
  return { pixels: p, land };
}

function nearInlandWater(water: Uint8Array, x: number, y: number) {
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (water[(y + j) * MAP_W + x + i]) return true;
  return false;
}

/**
 * A mountain: a few peaks of different heights side by side (never one triangle), each with a lit left face and a
 * shaded right face, crevices running down, snow on the high ones, and grass creeping up its foot.
 */
function mountain(p: Pixels, cx: number, foot: number, size: number) {
  const seed = Math.round(cx * 7 + foot);
  const peaks = [
    { x: cx, h: 15 * size, slope: 1.25 },
    { x: cx - (5 + noise(seed, 1) * 3) * size, h: (8 + noise(seed, 2) * 3) * size, slope: 1.1 },
    { x: cx + (5 + noise(seed, 3) * 4) * size, h: (9 + noise(seed, 4) * 4) * size, slope: 1.2 },
  ];
  const heightAt = (x: number) => {
    let best = 0;
    let owner = peaks[0];
    for (const pk of peaks) {
      // A ragged slope: steps and bumps, as rock would.
      const v = pk.h - Math.abs(x - pk.x) * pk.slope + (noise(Math.round(x), seed, 5) - 0.5) * 1.6;
      if (v > best) {
        best = v;
        owner = pk;
      }
    }
    return { height: best, owner };
  };
  const inside = (x: number, y: number) => y <= foot && foot - y < heightAt(x).height;
  const rock = { lit: [rgb('#d8ad78'), rgb('#ecc896')], shade: [rgb('#7e5a3e'), rgb('#9c7250')], crack: rgb('#5e4030') };
  const left = Math.floor(cx - 24 * size);
  const right = Math.ceil(cx + 24 * size);
  // Its shadow on the grass, to the bottom-right.
  for (let x = left; x <= right; x++) if (inside(x, foot)) p.blend(x + 2, foot + 1, C.outline, 0.3);
  for (let x = left; x <= right; x++) {
    const { height, owner } = heightAt(x);
    if (height <= 0) continue;
    for (let y = Math.floor(foot - height); y <= foot; y++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1) || !inside(x - 1, y) || !inside(x + 1, y)) {
        p.set(x, y, C.outline);
        continue;
      }
      const up = (foot - y) / owner.h;
      const lit = x < owner.x + (noise(y, seed, 6) - 0.5) * 1.2;
      const tones = lit ? rock.lit : rock.shade;
      let c = tones[bayer(x, y) < up ? 1 : 0];
      // Crevices: short dark streaks running down the faces.
      if (noise(Math.round(x + (foot - y) * (lit ? 0.5 : -0.5)), seed, 7) > 0.84 && up < 0.8) c = lit ? rock.shade[1] : rock.crack;
      // Snow on the high peaks, with a ragged edge.
      if (owner.h >= 11 && up > 0.62 + (noise(x, seed, 8) - 0.5) * 0.25) c = lit ? rgb('#ffffff') : rgb('#b4c2de');
      // Grass climbing the foot.
      if (foot - y < 2 + noise(x, seed, 9) * 2) c = lit ? C.grass : C.grassDark;
      p.set(x, y, c);
    }
  }
}

function compass(p: Pixels, cx: number, cy: number) {
  const gold = rgb('#f2d27a');
  const white = rgb('#ffffff');
  for (let i = -7; i <= 7; i++) {
    const w = Math.max(0, 2 - Math.floor(Math.abs(i) / 3));
    for (let k = -w; k <= w; k++) {
      p.set(cx + k, cy + i, i < 0 ? white : gold);
      p.set(cx + i, cy + k, i < 0 ? gold : white);
    }
  }
  p.set(cx, cy, C.outline);
}

/** The world map for this visit: the base picture, plus the roads and the towns (which change as cities open). */
export function kantoPicture(places: readonly MapPlace[], roads: readonly MapRoad[]): HTMLCanvasElement {
  base ??= paintBase();
  const p = new Pixels(MAP_W, MAP_H);
  p.data.set(base.pixels.data);
  const land = base.land;
  const at = new Map(places.map(c => [c.id, c]));

  // Roads: along one axis, then the other (as on a town map); over the sea they are dotted sea routes.
  for (const road of [...roads].sort((a, b) => Number(a.open) - Number(b.open))) {
    const a = at.get(road.from);
    const b = at.get(road.to);
    if (!a || !b) continue;
    const ax = Math.round(a.x * S);
    const ay = Math.round(a.y * S);
    const bx = Math.round(b.x * S);
    const by = Math.round(b.y * S);
    const corner = Math.abs(bx - ax) > Math.abs(by - ay) ? [bx, ay] : [ax, by];
    const points: [number, number][] = [];
    const walk = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) points.push([Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1))]);
    };
    walk(ax, ay, corner[0], corner[1]);
    walk(corner[0], corner[1], bx, by);
    points.forEach(([x, y], i) => {
      const onLand = land[y * MAP_W + x] === 1;
      if (!onLand) {
        // A sea route: dots.
        if (i % 4 < 2) {
          p.set(x, y, road.open ? C.foam : C.surf);
          p.set(x + 1, y, road.open ? C.foam : C.surf);
        }
        return;
      }
      if (!road.open && i % 5 === 4) return;
      // Two pixels wide, with a darker edge under it.
      p.set(x + 1, y + 1, road.open ? C.roadEdge : tone(C.roadLocked, -0.3));
      p.set(x, y, road.open ? C.road : C.roadLocked);
      p.set(x + 1, y, road.open ? C.road : C.roadLocked);
      p.set(x, y + 1, road.open ? C.road : C.roadLocked);
    });
  }

  // The towns: a little plaza with roofs (the Pokémon Center's red, the Mart's blue, houses).
  for (const c of places) town(p, Math.round(c.x * S), Math.round(c.y * S), c.open, c.id);
  return p.toCanvas();
}

function town(p: Pixels, cx: number, cy: number, open: boolean, id: string) {
  const x0 = cx - 6;
  const y0 = cy - 5;
  const plaza = open ? rgb('#e9e2cf') : rgb('#bdb6aa');
  p.rect(x0 - 1, y0 - 1, 14, 12, C.outline);
  p.rect(x0, y0, 12, 10, plaza);
  p.rect(x0, y0, 12, 1, tone(plaza, 0.4));
  const roofs = id === 'indigo' ? [rgb('#3a3f8f'), rgb('#e04a40'), rgb('#3a3f8f')] : [rgb('#e04a40'), rgb('#3d7fe0'), rgb('#d08a2e')];
  const spots: [number, number][] = [
    [1, 1],
    [7, 1],
    [4, 6],
  ];
  spots.forEach(([dx, dy], i) => {
    const roof = open ? roofs[i] : mix(roofs[i], rgb('#8a8496'), 0.6);
    p.rect(x0 + dx, y0 + dy, 4, 2, roof);
    p.rect(x0 + dx, y0 + dy, 4, 1, tone(roof, 0.35));
    p.rect(x0 + dx, y0 + dy + 2, 4, 1, open ? rgb('#f8f6f0') : rgb('#cfc9c0'));
    p.set(x0 + dx + 1, y0 + dy + 2, open ? rgb('#4f86c2') : rgb('#8a8496'));
  });
  // Its shadow.
  for (let i = 0; i < 14; i++) p.blend(x0 + i, y0 + 11, C.outline, 0.35);
  for (let j = 0; j < 12; j++) p.blend(x0 + 13, y0 + j, C.outline, 0.35);
}
