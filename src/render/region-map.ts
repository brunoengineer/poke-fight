// A region's world map as pixel art, painted by code (original drawings, in the spirit of the handheld games' town
// maps): the sea with its surf and shallows, beaches, grass, forests, mountain ranges with snowy peaks, lakes and
// rivers, the roads between the places (sea routes dotted over the water), and each place as a little town. 300×180
// art pixels: three per unit of the region's 100×60 map box (RegionMap in data/regions/types.ts).

import type { Region, RegionMap, TownFeature } from '../data/regions';
import { bayer, clumps, hash, mix, noise, Pixels, rgb, smooth, tone, type RGB } from './pixel';

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
function landMask(map: RegionMap): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(map.land));
  for (const i of map.islands) {
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

const bases = new Map<string, { pixels: Pixels; land: Uint8Array }>();

/** The sea, the land, the lake, the forests and the mountains: the same for every visit, painted once. */
function paintBase(map: RegionMap): { pixels: Pixels; land: Uint8Array } {
  const p = new Pixels(MAP_W, MAP_H);
  const land = landMask(map);
  // The lake and the river are water inside the land.
  const water = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map.lakes.some(lake => ((x / S - lake.x) / lake.rx) ** 2 + ((y / S - lake.y) / lake.ry) ** 2 < 1)) water[y * MAP_W + x] = 1;
    }
  }
  for (const river of map.rivers) for (let i = 0; i < river.length - 1; i++) {
    const [ax, ay] = river[i];
    const [bx, by] = river[i + 1];
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
  for (const [fx, fy, r] of map.forests) {
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
  for (const [mx, my, size] of [...map.mountains].sort((a, b) => a[1] - b[1])) mountain(p, mx * S, my * S, size);

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
export function regionPicture(region: Region, places: readonly MapPlace[], roads: readonly MapRoad[]): HTMLCanvasElement {
  let base = bases.get(region.id);
  if (!base) {
    base = paintBase(region.map);
    bases.set(region.id, base);
  }
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

  // The places, back to front: towns and cities, the League, the sanctuary.
  for (const c of [...places].sort((a, b) => a.y - b.y)) {
    const x = Math.round(c.x * S);
    const y = Math.round(c.y * S);
    const kind = iconKind(region, c.id);
    if (kind === 'league') leagueIcon(p, x, y, c.open, region.color);
    else if (kind === 'sanctuary') sanctuaryIcon(p, x, y, c.open, region.sanctuary.art.color);
    else townIcon(p, x, y, c.open, c.id, region.towns[c.id]?.row);
  }
  return p.toCanvas();
}

/**
 * The box each kind of icon covers around its place's point, in art pixels (left, top, width, height): the map
 * screen lays its markers exactly over them (the same numbers are in main.css, .place), and a test keeps every
 * region's icons and names from overlapping (region-map.test.ts).
 */
export const ICON_BOX = {
  town: { l: -12, t: -11, w: 24, h: 17 },
  city: { l: -15, t: -21, w: 30, h: 26 },
  league: { l: -18, t: -34, w: 36, h: 41 },
  sanctuary: { l: -16, t: -22, w: 32, h: 31 },
} as const;

export type IconKind = keyof typeof ICON_BOX;

/** Which icon a place has. */
export const iconKind = (region: Region, placeId: string): IconKind =>
  placeId === region.league.city
    ? 'league'
    : placeId === region.sanctuary.id
      ? 'sanctuary'
      : (region.towns[placeId]?.row.length ?? 0) >= 4
        ? 'city'
        : 'town';

// ── The places on the map ─────────────────────────────────────────────────────────────────────────────────────────
// Little pixel-art icons in 3/4 view, standing on the place's point (where its roads meet): a town of houses (bigger
// for a city), the League's palace on its plateau, the sanctuary's shrine with its floating crystal. A place not open
// yet is drawn faded, without its lights.

const GREY = rgb('#8a8496');
const WALL = rgb('#f6f1e6');
const DOOR = rgb('#6a4a3a');
const GLASS = rgb('#7fb6ee');

/** Dims a color for a place that isn't open yet. */
const dim = (c: RGB, open: boolean) => (open ? c : mix(c, GREY, 0.6));

/** A house: a roof (its top row lit, its eave dark), a white front with windows and a door, outlined. */
function house(p: Pixels, x: number, y: number, w: number, roof: RGB, open: boolean, storeys = 1, stripe?: RGB) {
  const roofH = 4;
  const wallH = storeys === 1 ? 3 : 6;
  // Outline and shadow.
  p.rect(x - 1, y, w + 2, roofH + wallH + 1, C.outline);
  p.rect(x, y - 1, w, 1, C.outline);
  for (let j = 1; j <= roofH + wallH; j++) p.blend(x + w + 1, y + j, C.outline, 0.4);
  for (let i = 0; i < w + 1; i++) p.blend(x + i, y + roofH + wallH + 1, C.outline, 0.4);
  for (let j = 0; j < roofH; j++) {
    for (let i = 0; i < w; i++) {
      const c = j === 0 ? tone(roof, 0.35) : j === roofH - 1 ? tone(roof, -0.3) : stripe && j === 2 ? stripe : roof;
      p.set(x + i, y + j, dim(c, open));
    }
  }
  for (let j = 0; j < wallH; j++) for (let i = 0; i < w; i++) p.set(x + i, y + roofH + j, dim(i === w - 1 ? tone(WALL, -0.15) : WALL, open));
  // Windows on each floor, a door on the ground floor.
  for (let f = 0; f < storeys; f++) {
    const wy = y + roofH + f * 3;
    p.set(x + 1, wy, dim(GLASS, open));
    p.set(x + w - 2, wy, dim(GLASS, open));
  }
  const door = x + Math.floor(w / 2);
  p.set(door, y + roofH + wallH - 1, dim(DOOR, open));
  if (wallH > 2) p.set(door, y + roofH + wallH - 2, dim(DOOR, open));
}

/** A round little tree. */
function bushTree(p: Pixels, x: number, y: number, open: boolean) {
  p.blend(x + 1, y + 3, C.outline, 0.35);
  p.blend(x + 2, y + 3, C.outline, 0.35);
  if (open) clumps(p, [{ x: x + 0.5, y: y, r: 2.7 }], LEAVES, rgb('#16402a'));
  else clumps(p, [{ x: x + 0.5, y: y, r: 2.7 }], LEAVES.map(c => dim(c, false)), rgb('#3a3644'));
  p.set(x, y + 2, rgb('#5e3a22'));
}

/** The ground of a town: a clearing of packed earth, dithered into the grass at its edge. */
function clearing(p: Pixels, cx: number, cy: number, rx: number, ry: number, open: boolean) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 0.75 || (d < 1 && bayer(x, y) > (d - 0.75) * 4)) p.set(x, y, dim(d < 0.4 ? rgb('#efe0b0') : rgb('#e2cc94'), open));
    }
  }
}

const ROOFS = ['#d0553d', '#4f9a4a', '#8d5bb0', '#d08a2e', '#c0465e', '#3f7cc0'].map(rgb);

/** A tall building (a skyscraper, a department store): glass and steel, rows of windows, a flat roof. */
function tower(p: Pixels, x: number, y: number, w: number, storeys: number, open: boolean, glass: RGB, roof: RGB) {
  const h = 2 + storeys * 3;
  p.rect(x - 1, y - 1, w + 2, h + 2, C.outline);
  for (let j = 1; j <= h; j++) p.blend(x + w + 1, y + j, C.outline, 0.4);
  p.rect(x, y, w, 2, dim(roof, open));
  p.rect(x, y, w, 1, dim(tone(roof, 0.35), open));
  for (let j = 2; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const window = (j - 2) % 3 !== 2 && i % 2 === 1 && i < w - 1;
      p.set(x + i, y + j, dim(window ? tone(glass, 0.35) : i === w - 1 ? tone(glass, -0.35) : glass, open));
    }
  }
  p.set(x + Math.floor(w / 2), y + h - 1, dim(DOOR, open));
}

/** The spooky Pokémon Tower: a narrow purple spire. */
function spire(p: Pixels, x: number, y: number, open: boolean) {
  tower(p, x, y + 3, 5, 4, open, rgb('#b8a8d8'), rgb('#6a4a9a'));
  for (let j = 0; j < 4; j++) for (let i = -j; i <= j; i++) p.set(x + 2 + i, y + j, j === 3 ? C.outline : dim(i < 0 ? rgb('#9a7ac8') : rgb('#6a4a9a'), open));
  p.set(x + 2, y - 1, C.outline);
}

/** A little volcano behind a town (Cinnabar): a rocky cone, a glowing crater, a wisp of smoke. */
function volcanoBack(p: Pixels, cx: number, base: number, open: boolean) {
  for (let j = 0; j < 12; j++) {
    const half = 3 + j;
    for (let i = -half; i <= half; i++) {
      const edge = Math.abs(i) === half || j === 0;
      p.set(cx + i, base - 12 + j, edge ? C.outline : dim(i < -half / 3 ? rgb('#b07a52') : (i + j) % 4 === 0 ? rgb('#6e4a32') : rgb('#8a5c3e'), open));
    }
  }
  p.rect(cx - 2, base - 12, 5, 1, dim(rgb('#ff6a2a'), open));
  p.set(cx, base - 13, dim(rgb('#ffd27a'), open));
  if (open) for (let j = 0; j < 4; j++) p.blend(cx + 1 + (j % 2), base - 15 - j, rgb('#e8e4f0'), 0.7);
}

/**
 * A town on the map, built from its plan (data/regions: its main row of buildings): the Pokémon Center and the Mart
 * in front, its landmarks behind (the gym, a tower, a skyscraper, the lab…), houses filling in. A city (four or more
 * buildings in its row) gets the full block; a town a few houses and a tree.
 */
function townIcon(p: Pixels, cx: number, cy: number, open: boolean, id: string, plan: readonly TownFeature[] | undefined) {
  const seed = hash(id);
  const row = plan ?? ['house', 'center', 'house'];
  const city = row.length >= 4;
  const roofA = ROOFS[seed % ROOFS.length];
  const roofB = ROOFS[(seed >>> 4) % ROOFS.length];
  clearing(p, cx, cy - (city ? 3 : 2), city ? 15 : 11, city ? 9 : 6, open);
  if (row.includes('volcano')) volcanoBack(p, cx + 9, cy - 9, open);
  // The back row: up to three landmarks, then houses.
  const landmarks = row.filter(f => f !== 'house' && f !== 'center' && f !== 'mart' && f !== 'volcano');
  const back = city ? [...landmarks, 'house', 'house', 'house'].slice(0, 3) : [...landmarks, 'house', 'house'].slice(0, 2);
  const slots = city ? [cx - 13, cx - 4, cx + 6] : [cx - 9, cx + 2];
  back.forEach((f, i) => {
    const x = slots[i];
    const y = cy - (city ? 11 : 9);
    const roof = i === 1 ? roofB : roofA;
    switch (f) {
      case 'gym':
        house(p, x - 1, y - 1, 9, rgb('#e0a22e'), open, 1, rgb('#ffffff'));
        break;
      case 'tower':
        spire(p, x + 1, y - 9, open);
        break;
      case 'skyscraper':
        tower(p, x, y - 8, 7, 4, open, rgb('#6aa8e0'), rgb('#7a8496'));
        break;
      case 'store':
        tower(p, x, y - 5, 7, 3, open, rgb('#e8b8c8'), rgb('#c0465e'));
        break;
      case 'tall':
        house(p, x, y - 3, 8, rgb('#7a8496'), open, 2);
        break;
      case 'lab':
        house(p, x - 1, y, 9, rgb('#a8b4c4'), open);
        p.set(x + 6, y - 2, dim(rgb('#d8dce4'), open));
        p.set(x + 6, y - 1, C.outline);
        break;
      case 'museum':
        house(p, x - 1, y, 9, rgb('#b8a68a'), open);
        for (let k = 0; k < 4; k++) p.set(x + k * 2, y + 5, dim(rgb('#d8ccb4'), open));
        break;
      default:
        house(p, x, y, 7, roof, open);
    }
  });
  // The front row: the Center and the Mart (a house where there is none).
  const center = rgb('#e04a40');
  if (city) {
    house(p, cx - 10, cy - 3, 8, center, open, 1, rgb('#ffffff'));
    house(p, cx + 1, cy - 3, 8, row.includes('mart') ? rgb('#3d7fe0') : roofB, open);
  } else {
    house(p, cx - 5, cy - 2, 8, center, open, 1, rgb('#ffffff'));
    bushTree(p, cx + 7, cy + 1, open);
  }
}

function leagueIcon(p: Pixels, cx: number, cy: number, open: boolean, color: string) {
  const accent = dim(rgb(color), open);
  const stone = [rgb('#a89c88'), rgb('#e8dfcc'), rgb('#fbf6ea')].map(c => dim(c, open));
  const gold = [rgb('#9a6a1e'), rgb('#e0aa38'), rgb('#ffe08a')].map(c => dim(c, open));
  const cliff = [rgb('#7e5a3e'), rgb('#9c7250'), rgb('#c79a6a')].map(c => dim(c, open));
  // The plateau: a rocky shelf, its top paved.
  for (let y = cy - 3; y <= cy + 6; y++) {
    for (let x = cx - 17; x <= cx + 17; x++) {
      const top = ((x - cx) / 16) ** 2 + ((y - cy + 1) / 4) ** 2 < 1;
      const side = !top && Math.abs(x - cx) <= 16 - (y - cy - 1) && y >= cy && y <= cy + 5;
      if (top) p.set(x, y, bayer(x, y) < 0.2 ? stone[0] : stone[1]);
      else if (side) p.set(x, y, y === cy + 5 || Math.abs(x - cx) === 16 - (y - cy - 1) ? C.outline : x < cx ? cliff[2] : (x + y) % 3 === 0 ? cliff[0] : cliff[1]);
    }
  }
  for (let x = cx - 16; x <= cx + 16; x++) p.blend(x + 1, cy + 6, C.outline, 0.35);
  // The hall: columns, the great door, the roof in the region's color with gold trim.
  const top = cy - 8;
  p.rect(cx - 12, top - 1, 25, 10, C.outline);
  for (let y = top; y < cy; y++) for (let x = cx - 11; x <= cx + 11; x++) p.set(x, y, (x - cx + 12) % 3 === 0 ? stone[2] : x > cx + 8 ? stone[0] : stone[1]);
  p.rect(cx - 2, cy - 4, 5, 4, gold[1]);
  p.rect(cx - 1, cy - 4, 3, 1, gold[2]);
  p.rect(cx, cy - 3, 1, 3, gold[0]);
  for (let y = top - 4; y < top; y++) {
    const inset = top - 1 - y;
    for (let x = cx - 13 + inset; x <= cx + 13 - inset; x++) p.set(x, y, x === cx - 13 + inset || x === cx + 13 - inset ? C.outline : y === top - 4 ? tone(accent, 0.3) : accent);
  }
  p.rect(cx - 13, top - 1, 27, 1, gold[1]);
  // The gable with its crest, the tower and its dome, a flag.
  for (let y = top - 9; y < top - 1; y++) {
    const half = Math.round((y - (top - 9)) * 0.9) + 1;
    for (let x = -half; x <= half; x++) p.set(cx + x, y, Math.abs(x) === half ? gold[0] : stone[2]);
  }
  p.set(cx, top - 5, gold[2]);
  p.set(cx - 1, top - 4, gold[1]);
  p.set(cx + 1, top - 4, gold[1]);
  p.set(cx, top - 4, rgb('#ffffff'));
  p.rect(cx - 3, top - 15, 7, 7, C.outline);
  p.rect(cx - 2, top - 14, 5, 6, stone[1]);
  p.set(cx, top - 12, dim(rgb('#ffd27a'), open));
  for (let y = 0; y < 4; y++) {
    const half = [1, 2, 3, 3][y];
    for (let x = -half; x <= half; x++) p.set(cx + x, top - 19 + y, Math.abs(x) === half ? gold[0] : x < 0 ? gold[2] : gold[1]);
  }
  p.rect(cx, top - 24, 1, 5, C.outline);
  p.rect(cx + 1, top - 24, 3, 2, dim(rgb('#e0403a'), open));
  // Side towers with pointed roofs.
  for (const tx of [cx - 14, cx + 12]) {
    p.rect(tx - 1, top - 5, 5, 13, C.outline);
    p.rect(tx, top - 4, 3, 11, stone[1]);
    p.set(tx + 1, top - 2, dim(rgb('#ffd27a'), open));
    for (let y = 0; y < 4; y++) for (let x = -y; x <= y; x++) p.set(tx + 1 + x, top - 9 + y, Math.abs(x) === y && y > 0 ? C.outline : tone(accent, x < 0 ? 0.25 : 0));
  }
  // Stairs and the carpet down the plateau.
  for (let s = 0; s < 3; s++) p.rect(cx - 5 - s, cy + s, 11 + s * 2, 1, s % 2 ? stone[0] : stone[2]);
  p.rect(cx - 1, cy, 3, 4, dim(rgb('#c83040'), open));
  if (open) {
    // Gold glints.
    for (const [x, y] of [
      [cx - 6, top - 20],
      [cx + 7, top - 16],
    ]) {
      p.set(x, y, rgb('#fff6c8'));
      p.blend(x - 1, y, rgb('#fff6c8'), 0.5);
      p.blend(x + 1, y, rgb('#fff6c8'), 0.5);
      p.blend(x, y - 1, rgb('#fff6c8'), 0.5);
      p.blend(x, y + 1, rgb('#fff6c8'), 0.5);
    }
  }
}

function sanctuaryIcon(p: Pixels, cx: number, cy: number, open: boolean, color: string) {
  const glow = open ? rgb(color) : GREY;
  const marble = [rgb('#7a7e9e'), rgb('#b4b7d2'), rgb('#e2e4f4')].map(c => dim(c, open));
  // A soft halo of its light on the ground around it.
  if (open) {
    for (let y = cy - 20; y <= cy + 8; y++) {
      for (let x = cx - 18; x <= cx + 18; x++) {
        const d = Math.hypot((x - cx) / 18, (y - cy + 6) / 14);
        if (d < 1 && bayer(x, y) < (1 - d) * 0.9) p.blend(x, y, glow, 0.35);
      }
    }
  }
  // The platform: two tiers of stone, seen at a slant.
  for (const [ry, rx, oy, c] of [
    [4, 14, 4, marble[0]],
    [4, 12, 2, marble[1]],
  ] as const) {
    for (let y = Math.floor(cy + oy - ry); y <= cy + oy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy - oy) / ry) ** 2;
        if (d <= 1) p.set(x, y, d > 0.8 ? C.outline : y < cy + oy - 1 ? tone(c, 0.25) : c);
      }
    }
  }
  // The rune circle on it.
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    if (a % 5 !== 4) p.set(Math.round(cx + Math.cos(t) * 8), Math.round(cy + 2 + Math.sin(t) * 2), open ? tone(glow, 0.3) : marble[0]);
  }
  // Pillars: the arch's two, and broken ones at the edges.
  const pillar = (x: number, height: number) => {
    p.rect(x - 1, cy - height - 1, 4, height + 2, C.outline);
    for (let y = cy - height; y <= cy; y++) {
      p.set(x, y, marble[2]);
      p.set(x + 1, y, marble[1]);
    }
  };
  pillar(cx - 11, 7);
  pillar(cx + 10, 9);
  pillar(cx - 6, 15);
  pillar(cx + 5, 15);
  // The lintel across the arch, its runes lit.
  p.rect(cx - 9, cy - 19, 19, 4, C.outline);
  p.rect(cx - 8, cy - 18, 17, 2, marble[2]);
  if (open) for (let x = cx - 6; x <= cx + 6; x += 3) p.set(x, cy - 17, tone(glow, 0.4));
  // The crystal, floating in the arch.
  const tones = open ? [tone(glow, -0.35), glow, tone(glow, 0.45), rgb('#ffffff')] : [marble[0], marble[1], marble[2], marble[2]];
  for (let y = -5; y <= 5; y++) {
    const half = Math.round((1 - Math.abs(y) / 5.5) * 3);
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half;
      p.set(cx + x, cy - 8 + y, edge ? (open ? tone(glow, -0.6) : C.outline) : x < 0 ? (y < 0 ? tones[3] : tones[2]) : y < 0 ? tones[1] : tones[0]);
    }
  }
  if (open) {
    for (const [x, y] of [
      [cx - 3, cy - 15],
      [cx + 4, cy - 11],
      [cx - 4, cy - 4],
    ]) p.set(x, y, rgb('#ffffff'));
  }
}
