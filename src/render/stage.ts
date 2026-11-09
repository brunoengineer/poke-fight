// The arena's backgrounds. Since milestone 11 a place shows its picture (a Showdown battle background, data/art.ts),
// graded so the fighters stand out; until it loads (or offline, or in the browser tests) the place is painted by
// code: one look per kind of place, the still layers drawn once into an offscreen canvas, the moving parts (clouds,
// light rays, water, crystals, spotlights, stars, the crowd) every frame from a frame counter.

import { backdropUrl, type Backdrop } from '../data/art';
import { drawAmbience } from './ambience';
import { getImage } from './images';
import { VIEW_H, VIEW_W } from './screen';

export const FLOOR_Y = 230;

export type StageId = 'route' | 'forest' | 'cave' | 'sea' | 'gym' | 'league' | 'safari' | 'stadium';

export interface StageSpec {
  id: StageId;
  /** The gym's type color (the walls and the emblem take it). */
  tint?: string;
  /** The place's picture (drawn instead of the painted stage once it has loaded). */
  backdrop?: Backdrop;
}

/** A small, repeatable random sequence (the same scenery every time). */
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const cache = new Map<string, HTMLCanvasElement>();

export function drawStage(ctx: CanvasRenderingContext2D, spec: StageSpec, frame: number): void {
  const picture = spec.backdrop ? getImage(backdropUrl(spec.backdrop)) : null;
  if (picture) {
    drawPicture(ctx, picture, spec);
    if (spec.backdrop) drawAmbience(ctx, spec.backdrop, frame, 'back');
    return;
  }
  const key = `${spec.id}:${spec.tint ?? ''}`;
  let still = cache.get(key);
  if (!still) {
    still = document.createElement('canvas');
    still.width = VIEW_W;
    still.height = VIEW_H;
    const c = still.getContext('2d');
    if (c) PAINT[spec.id](c, spec);
    cache.set(key, still);
  }
  ctx.drawImage(still, 0, 0);
  ANIMATE[spec.id]?.(ctx, spec, frame);
}

/**
 * The place's picture, covering the arena with its bottom edge on the screen's bottom (the ground of a battle
 * background is in its lower half, where the fighters stand). Then a soft grade: darker toward the bottom and the
 * sides, a little of the gym's color, so the sprites and the HUD read well over any picture.
 */
function drawPicture(ctx: CanvasRenderingContext2D, image: HTMLImageElement, spec: StageSpec) {
  const scale = Math.max(VIEW_W / image.naturalWidth, VIEW_H / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  // Drawn at the screen's resolution: crisp pixel art (no smoothing).
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, (VIEW_W - width) / 2, VIEW_H - height, width, height);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  shade.addColorStop(0, 'rgba(10, 12, 30, 0.35)');
  shade.addColorStop(0.35, 'rgba(10, 12, 30, 0)');
  shade.addColorStop(0.8, 'rgba(10, 12, 30, 0.08)');
  shade.addColorStop(1, 'rgba(10, 12, 30, 0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const sides = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.6, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.6, VIEW_W * 0.62);
  sides.addColorStop(0, 'rgba(0, 0, 0, 0)');
  sides.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = sides;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (spec.tint) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = spec.tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────

function vertical(c: CanvasRenderingContext2D, top: number, bottom: number, stops: string[]) {
  const g = c.createLinearGradient(0, top, 0, bottom);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  c.fillStyle = g;
  c.fillRect(0, top, VIEW_W, bottom - top);
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  c.restore();
}

/** A jagged mountain range (sharp) or rolling hills (smooth) along a base line. */
function ridge(c: CanvasRenderingContext2D, color: string, base: number, height: number, seed: number, step: number, smooth: boolean) {
  const random = seeded(seed);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, FLOOR_Y);
  let previous = base - random() * height;
  c.lineTo(0, previous);
  for (let x = step; x <= VIEW_W + step; x += step) {
    const y = base - random() * height;
    if (smooth) c.quadraticCurveTo(x - step / 2, previous - height * 0.3, x, y);
    else c.lineTo(x, y);
    previous = y;
  }
  c.lineTo(VIEW_W, FLOOR_Y);
  c.closePath();
  c.fill();
}

function ground(c: CanvasRenderingContext2D, top: string, bottom: string, stripe: string, edge: string) {
  vertical(c, FLOOR_Y, VIEW_H, [top, bottom]);
  c.fillStyle = stripe;
  // Stripes closer together near the horizon: a little perspective.
  for (let i = 0, y = FLOOR_Y + 4; y < VIEW_H; i++, y += 3 + i * 2) c.fillRect(0, y, VIEW_W, 1);
  c.fillStyle = edge;
  c.fillRect(0, FLOOR_Y, VIEW_W, 2);
}

function roundTree(c: CanvasRenderingContext2D, x: number, base: number, size: number, leaf: string, trunk: string) {
  c.fillStyle = trunk;
  c.fillRect(x - 2, base - size * 0.6, 4, size * 0.6);
  c.fillStyle = leaf;
  c.beginPath();
  c.arc(x, base - size * 0.8, size * 0.55, 0, Math.PI * 2);
  c.arc(x - size * 0.35, base - size * 0.6, size * 0.4, 0, Math.PI * 2);
  c.arc(x + size * 0.35, base - size * 0.6, size * 0.4, 0, Math.PI * 2);
  c.fill();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, size, 0, Math.PI * 2);
  c.arc(x + size * 1.1, y + size * 0.2, size * 0.8, 0, Math.PI * 2);
  c.arc(x - size * 1.1, y + size * 0.25, size * 0.7, 0, Math.PI * 2);
  c.fill();
}

// ── Painting each place (the still layers) ────────────────────────────────────────────────────────────────────

const PAINT: Record<StageId, (c: CanvasRenderingContext2D, spec: StageSpec) => void> = {
  route(c) {
    vertical(c, 0, FLOOR_Y, ['#4aa6ff', '#8fd1ff', '#d8f2ff']);
    glow(c, 390, 52, 70, 'rgba(255,245,200,0.9)');
    c.fillStyle = '#fff8d8';
    c.beginPath();
    c.arc(390, 52, 14, 0, Math.PI * 2);
    c.fill();
    ridge(c, '#9dbbe0', 175, 45, 7, 24, false);
    ridge(c, '#7fb07a', 200, 22, 11, 40, true);
    const random = seeded(3);
    for (let x = -10; x < VIEW_W + 20; x += 16 + random() * 14) roundTree(c, x, 218, 16 + random() * 10, '#3f8f45', '#5a3d24');
    ground(c, '#7ccb5c', '#4e9a3c', 'rgba(255,255,255,0.08)', '#a6e07f');
    for (let i = 0; i < 40; i++) {
      c.fillStyle = ['#ffe36e', '#ff9cc2', '#ffffff'][i % 3];
      c.fillRect(Math.floor(random() * VIEW_W), FLOOR_Y + 6 + Math.floor(random() * 32), 2, 2);
    }
  },
  forest(c) {
    vertical(c, 0, FLOOR_Y, ['#1f4a35', '#3f7d55', '#9fd0a4']);
    const random = seeded(5);
    for (let layer = 0; layer < 3; layer++) {
      const shade = ['#2b5e3a', '#21492d', '#163522'][layer];
      for (let x = -20; x < VIEW_W + 30; x += 22 + random() * 26) {
        const width = 6 + layer * 3 + random() * 4;
        c.fillStyle = '#3a2a1c';
        c.fillRect(x, 40 + layer * 20, width, FLOOR_Y);
        c.fillStyle = shade;
        c.beginPath();
        c.ellipse(x + width / 2, 40 + layer * 25 + random() * 20, 26 + layer * 6, 30, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    ground(c, '#4c7d33', '#2b4a1d', 'rgba(255,255,255,0.05)', '#7fb04f');
  },
  cave(c) {
    vertical(c, 0, FLOOR_Y, ['#0d0a14', '#241a33', '#33263f']);
    const random = seeded(9);
    ridge(c, '#1a1424', 200, 70, 13, 30, false);
    c.fillStyle = '#120d1b';
    for (let x = 0; x < VIEW_W; x += 14 + random() * 18) {
      const length = 15 + random() * 45;
      c.beginPath();
      c.moveTo(x - 6, 0);
      c.lineTo(x + 6, 0);
      c.lineTo(x, length);
      c.closePath();
      c.fill();
    }
    ground(c, '#3b3045', '#1d1724', 'rgba(255,255,255,0.04)', '#5b4a6a');
    for (let i = 0; i < 18; i++) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(random() * VIEW_W, FLOOR_Y + 10 + random() * 28, 4 + random() * 8, 2 + random() * 2, 0, 0, Math.PI * 2);
      c.fill();
    }
  },
  sea(c) {
    vertical(c, 0, 178, ['#ff8a5c', '#ffb98a', '#ffe3b3']);
    glow(c, 240, 178, 120, 'rgba(255,230,160,0.8)');
    c.fillStyle = '#fff1b8';
    c.beginPath();
    c.arc(240, 178, 26, Math.PI, 0);
    c.fill();
    vertical(c, 178, 214, ['#2d77c2', '#1c4f8c']);
    ground(c, '#f0d79a', '#c9a865', 'rgba(255,255,255,0.12)', '#fff0c4');
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0, 214, VIEW_W, 3);
    vertical(c, 217, FLOOR_Y, ['#e8cf8f', '#f0d79a']);
  },
  gym(c, spec) {
    const tint = spec.tint ?? '#6c8cff';
    vertical(c, 0, FLOOR_Y, ['#0d0f1f', '#171a33', '#22264a']);
    c.save();
    c.globalAlpha = 0.25;
    vertical(c, 0, FLOOR_Y, ['rgba(0,0,0,0)', tint]);
    c.restore();
    // The emblem.
    c.save();
    c.globalAlpha = 0.35;
    c.strokeStyle = tint;
    c.lineWidth = 6;
    c.beginPath();
    c.arc(240, 105, 58, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(240, 105, 42, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    // Pillars.
    for (const x of [40, 120, 360, 440]) {
      c.fillStyle = '#2c315a';
      c.fillRect(x - 9, 30, 18, FLOOR_Y - 30);
      c.fillStyle = tint;
      c.globalAlpha = 0.6;
      c.fillRect(x - 9, 30, 18, 3);
      c.globalAlpha = 1;
    }
    // Tiled floor.
    vertical(c, FLOOR_Y, VIEW_H, ['#2a2f4f', '#151830']);
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = -12; i <= 12; i++) {
      c.beginPath();
      c.moveTo(240 + i * 10, FLOOR_Y);
      c.lineTo(240 + i * 60, VIEW_H);
      c.stroke();
    }
    c.fillStyle = tint;
    c.fillRect(0, FLOOR_Y, VIEW_W, 2);
  },
  league(c) {
    vertical(c, 0, FLOOR_Y, ['#0b0618', '#1f0f3a', '#3a1d5c']);
    for (const x of [30, 110, 370, 450]) {
      const g = c.createLinearGradient(x - 10, 0, x + 10, 0);
      g.addColorStop(0, '#8a6a22');
      g.addColorStop(0.5, '#f2cf6a');
      g.addColorStop(1, '#8a6a22');
      c.fillStyle = g;
      c.fillRect(x - 10, 20, 20, FLOOR_Y - 20);
      c.fillStyle = '#b02a4a';
      c.fillRect(x - 7, 40, 14, 50);
      c.fillStyle = '#f2cf6a';
      c.fillRect(x - 7, 88, 14, 2);
    }
    vertical(c, FLOOR_Y, VIEW_H, ['#2b1748', '#120822']);
    c.fillStyle = '#f2cf6a';
    c.fillRect(0, FLOOR_Y, VIEW_W, 2);
    c.globalAlpha = 0.15;
    vertical(c, FLOOR_Y + 2, FLOOR_Y + 30, ['#f2cf6a', 'rgba(0,0,0,0)']);
    c.globalAlpha = 1;
  },
  safari(c) {
    vertical(c, 0, FLOOR_Y, ['#ff7a4a', '#ffb066', '#ffe0a0']);
    glow(c, 120, 120, 90, 'rgba(255,220,150,0.8)');
    c.fillStyle = '#fff0c0';
    c.beginPath();
    c.arc(120, 120, 22, 0, Math.PI * 2);
    c.fill();
    ridge(c, '#c27a52', 205, 20, 21, 50, true);
    // Acacias.
    for (const [x, size] of [
      [300, 1],
      [420, 0.8],
      [60, 0.7],
    ] as const) {
      c.fillStyle = '#3d2419';
      c.fillRect(x - 2, 175 - 30 * size, 4, 50 * size);
      c.beginPath();
      c.ellipse(x, 172 - 32 * size, 40 * size, 9 * size, 0, 0, Math.PI * 2);
      c.fill();
    }
    ground(c, '#d8b063', '#a3772f', 'rgba(255,255,255,0.08)', '#f0cf86');
  },
  stadium(c) {
    vertical(c, 0, FLOOR_Y, ['#060a1c', '#101a3a', '#1b2a55']);
    // The stands: rows of seats.
    for (let row = 0; row < 6; row++) {
      c.fillStyle = row % 2 ? '#141c3a' : '#18224a';
      c.fillRect(0, 120 + row * 14, VIEW_W, 14);
    }
    c.fillStyle = '#0c1228';
    c.fillRect(0, 204, VIEW_W, 26);
    vertical(c, FLOOR_Y, VIEW_H, ['#3f9a55', '#25683a']);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(0, FLOOR_Y + 8, VIEW_W, 1);
    c.fillStyle = '#ffffff';
    c.fillRect(0, FLOOR_Y, VIEW_W, 2);
  },
};

// ── The moving parts ──────────────────────────────────────────────────────────────────────────────────────────

const ANIMATE: Partial<Record<StageId, (c: CanvasRenderingContext2D, spec: StageSpec, frame: number) => void>> = {
  route(c, _, frame) {
    for (const [x0, y, size, speed] of [
      [40, 40, 8, 0.05],
      [220, 28, 11, 0.03],
      [340, 70, 7, 0.07],
    ]) {
      const x = ((x0 + frame * speed) % (VIEW_W + 80)) - 40;
      cloud(c, x, y, size, 'rgba(255,255,255,0.85)');
    }
  },
  forest(c, _, frame) {
    // Sun rays through the leaves.
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      c.globalAlpha = 0.05 + 0.03 * Math.sin(frame / 50 + i * 1.7);
      c.fillStyle = '#fff6c0';
      c.beginPath();
      const x = 80 + i * 110;
      c.moveTo(x, 0);
      c.lineTo(x + 30, 0);
      c.lineTo(x + 90, FLOOR_Y);
      c.lineTo(x + 40, FLOOR_Y);
      c.closePath();
      c.fill();
    }
    c.restore();
  },
  cave(c, _, frame) {
    // Glowing crystals.
    for (const [x, y, phase] of [
      [70, 196, 0],
      [180, 208, 2],
      [330, 200, 4],
      [430, 192, 1],
    ]) {
      const alpha = 0.5 + 0.35 * Math.sin(frame / 30 + phase);
      glow(c, x, y, 26, 'rgba(110,240,255,0.55)', alpha);
      c.fillStyle = `rgba(150,250,255,${0.6 + alpha * 0.4})`;
      c.beginPath();
      c.moveTo(x, y - 12);
      c.lineTo(x + 5, y);
      c.lineTo(x, y + 4);
      c.lineTo(x - 5, y);
      c.closePath();
      c.fill();
    }
  },
  sea(c, _, frame) {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 9; i++) {
      const y = 182 + i * 4;
      const offset = (frame * (0.2 + i * 0.05) + i * 37) % 60;
      for (let x = -60 + offset; x < VIEW_W; x += 60) c.fillRect(Math.round(x), y, 12 + (i % 3) * 4, 1);
    }
  },
  gym(c, spec, frame) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const sway = Math.sin(frame / 80 + (side > 0 ? 1.5 : 0)) * 40;
      c.globalAlpha = 0.08;
      c.fillStyle = spec.tint ?? '#ffffff';
      c.beginPath();
      c.moveTo(240 + side * 200, 0);
      c.lineTo(240 + side * 180, 0);
      c.lineTo(240 + sway - 50, FLOOR_Y);
      c.lineTo(240 + sway + 50, FLOOR_Y);
      c.closePath();
      c.fill();
    }
    c.restore();
  },
  league(c, _, frame) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const angle = Math.sin(frame / 70 + i * 2.1) * 0.6;
      c.globalAlpha = 0.07;
      c.fillStyle = ['#ff6fae', '#6c8cff', '#ffd25e'][i];
      c.save();
      c.translate(120 + i * 120, -10);
      c.rotate(angle);
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(8, 0);
      c.lineTo(60, FLOOR_Y + 20);
      c.lineTo(-60, FLOOR_Y + 20);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  },
  safari(c, _, frame) {
    // Tall grass swaying in front.
    c.fillStyle = '#b8902f';
    for (let x = 0; x < VIEW_W; x += 7) {
      const sway = Math.sin(frame / 25 + x / 30) * 2;
      c.beginPath();
      c.moveTo(x, VIEW_H);
      c.lineTo(x + 3 + sway, VIEW_H - 14 - (x % 3) * 3);
      c.lineTo(x + 5, VIEW_H);
      c.closePath();
      c.fill();
    }
  },
  stadium(c, _, frame) {
    const random = seeded(17);
    // Stars and a cheering crowd.
    for (let i = 0; i < 40; i++) {
      const x = random() * VIEW_W;
      const y = random() * 100;
      c.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(frame / 40 + i)})`;
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    for (let i = 0; i < 160; i++) {
      const x = random() * VIEW_W;
      const row = Math.floor(random() * 6);
      const bounce = Math.sin(frame / 12 + i) > 0.6 ? 1 : 0;
      c.fillStyle = ['#ff6fae', '#6c8cff', '#ffd25e', '#5ee6a0', '#d9dff5'][i % 5];
      c.globalAlpha = 0.55;
      c.fillRect(Math.round(x), 124 + row * 14 - bounce, 2, 3);
    }
    c.globalAlpha = 1;
    glow(c, 30, 20, 60, 'rgba(255,255,230,0.5)');
    glow(c, 450, 20, 60, 'rgba(255,255,230,0.5)');
  },
};
