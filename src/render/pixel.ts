// A tiny pixel-art painter for the art drawn by code (the towns, the world map): a buffer of pixels written
// directly (fast, no smoothing, no half pixels), and the few tools pixel artists use everywhere: a light from the
// top-left, a dark outline, shading in a handful of tones with ordered dithering in between.

export type RGB = number;

export const rgb = (hex: string): RGB => parseInt(hex.slice(1), 16);

const r = (c: RGB) => (c >> 16) & 255;
const g = (c: RGB) => (c >> 8) & 255;
const b = (c: RGB) => c & 255;
const pack = (red: number, green: number, blue: number): RGB =>
  (Math.round(Math.min(255, Math.max(0, red))) << 16) | (Math.round(Math.min(255, Math.max(0, green))) << 8) | Math.round(Math.min(255, Math.max(0, blue)));

export const mix = (a: RGB, c: RGB, t: number): RGB => pack(r(a) + (r(c) - r(a)) * t, g(a) + (g(c) - g(a)) * t, b(a) + (b(c) - b(a)) * t);
/** Lighter (amount > 0, towards white) or darker (amount < 0, towards a cool dark, as pixel artists shade). */
export const tone = (c: RGB, amount: number): RGB => (amount >= 0 ? mix(c, 0xffffff, amount) : mix(c, 0x141028, -amount));

/** 2×2 ordered dithering: true on half the pixels in a checker. */
export const checker = (x: number, y: number) => ((x + y) & 1) === 0;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 ordered dithering threshold, 0–1. */
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** A fixed pseudo-random value for a pixel (0–1): textures that look random but never change. */
export function noise(x: number, y: number, seed = 0) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise (0–1) at a scale in pixels: soft blobs instead of squares. */
export function smooth(x: number, y: number, scale: number, seed = 0) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const tx = ease(fx - x0);
  const ty = ease(fy - y0);
  const top = noise(x0, y0, seed) * (1 - tx) + noise(x0 + 1, y0, seed) * tx;
  const bottom = noise(x0, y0 + 1, seed) * (1 - tx) + noise(x0 + 1, y0 + 1, seed) * tx;
  return top * (1 - ty) + bottom * ty;
}

export class Pixels {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }

  set(x: number, y: number, c: RGB) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r(c);
    this.data[i + 1] = g(c);
    this.data[i + 2] = b(c);
    this.data[i + 3] = 255;
  }

  /** Paints over what is there with some transparency (shadows, glows, tints). */
  blend(x: number, y: number, c: RGB, alpha: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    this.set(x, y, mix(this.get(x, y), c, alpha));
  }

  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, c);
  }

  blendRect(x: number, y: number, w: number, h: number, c: RGB, alpha: number) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.blend(i, j, c, alpha);
  }

  /** A soft-edged oval of transparency (a shadow on the ground), stepped like pixel art. */
  oval(cx: number, cy: number, rx: number, ry: number, c: RGB, alpha: number) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d <= 1) this.blend(x, y, c, d > 0.6 ? alpha * 0.6 : alpha);
      }
    }
  }

  /** Every pixel through a function (a time-of-day tint). */
  map(f: (c: RGB, x: number, y: number) => RGB) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, f(this.get(x, y), x, y));
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return canvas;
  }
}

/** Light comes from the top-left, a little towards the viewer. */
const LIGHT = (() => {
  const v = [-0.55, -0.65, 0.52];
  const n = Math.hypot(...v);
  return v.map(x => x / n);
})();

export interface Ball {
  x: number;
  y: number;
  r: number;
}

/**
 * Round clumps (tree tops, bushes, boulders, clouds) shaded as spheres: `tones` from dark to light, a dark outline
 * around the whole shape, and a shade line where a clump in front overlaps one behind.
 */
export function clumps(p: Pixels, balls: readonly Ball[], tones: readonly RGB[], outline: RGB) {
  if (balls.length === 0) return;
  const x0 = Math.floor(Math.min(...balls.map(c => c.x - c.r))) - 1;
  const x1 = Math.ceil(Math.max(...balls.map(c => c.x + c.r))) + 1;
  const y0 = Math.floor(Math.min(...balls.map(c => c.y - c.r))) - 1;
  const y1 = Math.ceil(Math.max(...balls.map(c => c.y + c.r))) + 1;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // Which clump each pixel belongs to: the one it is deepest in, the front one (lower) winning ties.
  const owner = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = -1;
      let depth = 0;
      balls.forEach((c, i) => {
        const d = c.r - Math.hypot(x0 + x + 0.5 - c.x, y0 + y + 0.5 - c.y);
        if (d > 0 && (best < 0 || c.y > balls[best].y + 0.5 || (Math.abs(c.y - balls[best].y) <= 0.5 && d > depth))) {
          best = i;
          depth = d;
        }
      });
      owner[y * w + x] = best;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : owner[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = at(x, y);
      if (o < 0) continue;
      const px = x0 + x;
      const py = y0 + y;
      if (at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0) {
        p.set(px, py, outline);
        continue;
      }
      const c = balls[o];
      // A clump in front (below) of this one: the pixel just above it is in its shade.
      const below = at(x, y + 1);
      if (below >= 0 && below !== o && balls[below].y > c.y) {
        p.set(px, py, tones[0]);
        continue;
      }
      const nx = (px + 0.5 - c.x) / c.r;
      const ny = (py + 0.5 - c.y) / c.r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const light = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      // Light → a tone, with dithering between two tones.
      const level = light * (tones.length - 0.01);
      const index = Math.min(tones.length - 1, Math.floor(level + (bayer(px, py) - 0.5) * 0.7));
      p.set(px, py, tones[Math.max(0, index)]);
    }
  }
}

/** A filled shape from a test (inside or not), with a dark outline. */
export function shape(p: Pixels, x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, fill: (x: number, y: number) => RGB, outline: RGB | null) {
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = outline !== null && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1));
      p.set(x, y, edge ? outline : fill(x, y));
    }
  }
}
