// Life in the places' pictures during a fight: falling leaves, pollen and light rays outdoors, sparkles on water,
// bubbles under the sea, dust in caves, snow, embers, lightning, stars, spotlights. Purely visual and stateless:
// every particle's position is a function of its number and the time, so nothing needs updating or storing.
// The 'back' layer is drawn over the picture, behind the fighters; the 'front' layer passes in front of them.

import type { Backdrop } from '../data/art';
import { FLOOR_Y } from './stage';
import { VIEW_H, VIEW_W } from './screen';

type Kind = 'leaves' | 'water' | 'bubbles' | 'dust' | 'snow' | 'embers' | 'storm' | 'stars' | 'arena';

const KINDS: Record<Backdrop, Kind> = {
  route: 'leaves',
  meadow: 'leaves',
  forest: 'leaves',
  city: 'dust',
  beach: 'water',
  beachshore: 'water',
  river: 'water',
  deepsea: 'bubbles',
  mountain: 'dust',
  earthycave: 'dust',
  dampcave: 'dust',
  icecave: 'snow',
  volcanocave: 'embers',
  desert: 'dust',
  thunderplains: 'storm',
  space: 'stars',
  spl: 'arena',
};

/** A repeatable pseudo-random number in [0, 1) for particle `i` (and a salt, for independent values). */
const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Wraps a value into [0, size). */
const wrap = (value: number, size: number) => ((value % size) + size) % size;

export function drawAmbience(ctx: CanvasRenderingContext2D, backdrop: Backdrop, frame: number, layer: 'back' | 'front') {
  const kind = KINDS[backdrop];
  ctx.save();
  if (layer === 'back') {
    floorShade(ctx);
    if (kind === 'leaves') sunRays(ctx, frame);
  }
  PAINTERS[kind](ctx, frame, layer);
  ctx.restore();
}

/** A soft darker band where the fighters stand: it ties them to the picture's ground. */
function floorShade(ctx: CanvasRenderingContext2D) {
  const band = ctx.createLinearGradient(0, FLOOR_Y - 18, 0, VIEW_H);
  band.addColorStop(0, 'rgba(8, 10, 24, 0)');
  band.addColorStop(0.35, 'rgba(8, 10, 24, 0.16)');
  band.addColorStop(1, 'rgba(8, 10, 24, 0.34)');
  ctx.fillStyle = band;
  ctx.fillRect(0, FLOOR_Y - 18, VIEW_W, VIEW_H - FLOOR_Y + 18);
}

function sunRays(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(frame / 240 + i * 1.7) * 10;
    const x = 60 + i * 110 + sway;
    const ray = ctx.createLinearGradient(x, 0, x + 60, VIEW_H * 0.8);
    ray.addColorStop(0, `rgba(255, 244, 200, ${0.09 + 0.03 * Math.sin(frame / 90 + i)})`);
    ray.addColorStop(1, 'rgba(255, 244, 200, 0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 26, 0);
    ctx.lineTo(x + 110, VIEW_H * 0.85);
    ctx.lineTo(x + 50, VIEW_H * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

type Painter = (ctx: CanvasRenderingContext2D, frame: number, layer: 'back' | 'front') => void;

const PAINTERS: Record<Kind, Painter> = {
  leaves(ctx, frame, layer) {
    const count = layer === 'back' ? 14 : 4;
    for (let i = 0; i < count; i++) {
      const seed = i + (layer === 'front' ? 100 : 0);
      const speed = 0.25 + rand(seed) * 0.35;
      const y = wrap(rand(seed, 1) * VIEW_H + frame * speed, VIEW_H + 20) - 10;
      const x = wrap(rand(seed, 2) * VIEW_W + frame * 0.3 + Math.sin(frame / 40 + seed) * 14, VIEW_W);
      const size = layer === 'front' ? 3.2 : 1.6 + rand(seed, 3);
      const spin = frame / 30 + seed;
      ctx.fillStyle = ['#7ac94f', '#a8d75a', '#e3b84a', '#5fae49'][seed % 4];
      ctx.globalAlpha = layer === 'front' ? 0.85 : 0.7;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.scale(1, Math.abs(Math.cos(spin)) * 0.8 + 0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Pollen drifting in the light.
    if (layer === 'back') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const x = wrap(rand(i, 4) * VIEW_W + Math.sin(frame / 120 + i) * 20 + frame * 0.05, VIEW_W);
        const y = 30 + rand(i, 5) * 170 + Math.sin(frame / 70 + i * 2) * 8;
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(frame / 25 + i);
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  },
  water(ctx, frame, layer) {
    if (layer === 'front') return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const phase = (frame / 50 + rand(i)) % 1;
      const x = rand(i, 1) * VIEW_W;
      const y = 70 + rand(i, 2) * 90;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y, 4, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  },
  bubbles(ctx, frame, layer) {
    const count = layer === 'back' ? 16 : 5;
    ctx.strokeStyle = 'rgba(200, 235, 255, 0.6)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < count; i++) {
      const seed = i + (layer === 'front' ? 50 : 0);
      const y = VIEW_H - wrap(frame * (0.3 + rand(seed) * 0.4) + rand(seed, 1) * VIEW_H, VIEW_H + 20);
      const x = rand(seed, 2) * VIEW_W + Math.sin(frame / 30 + seed) * 4;
      const r = layer === 'front' ? 3 : 1 + rand(seed, 3) * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  dust(ctx, frame, layer) {
    if (layer === 'front') return;
    for (let i = 0; i < 24; i++) {
      const x = wrap(rand(i) * VIEW_W + frame * (0.15 + rand(i, 1) * 0.3), VIEW_W);
      const y = 40 + rand(i, 2) * 190 + Math.sin(frame / 60 + i) * 6;
      ctx.globalAlpha = 0.18 + 0.2 * rand(i, 3);
      ctx.fillStyle = '#f4e6c8';
      ctx.fillRect(x, y, 1, 1);
    }
  },
  snow(ctx, frame, layer) {
    const count = layer === 'back' ? 40 : 10;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < count; i++) {
      const seed = i + (layer === 'front' ? 200 : 0);
      const y = wrap(rand(seed) * VIEW_H + frame * (0.3 + rand(seed, 1) * 0.4), VIEW_H);
      const x = wrap(rand(seed, 2) * VIEW_W + Math.sin(frame / 50 + seed) * 10, VIEW_W);
      const size = layer === 'front' ? 2.2 : 1;
      ctx.globalAlpha = layer === 'front' ? 0.9 : 0.7;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  embers(ctx, frame, layer) {
    const count = layer === 'back' ? 22 : 6;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const seed = i + (layer === 'front' ? 300 : 0);
      const life = (frame * (0.004 + rand(seed) * 0.004) + rand(seed, 1)) % 1;
      const x = rand(seed, 2) * VIEW_W + Math.sin(frame / 25 + seed) * 6;
      const y = VIEW_H - life * VIEW_H * 0.9;
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
      ctx.fillStyle = life < 0.5 ? '#ffd27a' : '#ff6a3d';
      const size = layer === 'front' ? 2 : 1.2;
      ctx.fillRect(x, y, size, size);
    }
    if (layer === 'back') {
      // Heat glowing from below.
      const glow = ctx.createLinearGradient(0, VIEW_H, 0, VIEW_H - 80);
      glow.addColorStop(0, `rgba(255, 90, 40, ${0.16 + 0.05 * Math.sin(frame / 20)})`);
      glow.addColorStop(1, 'rgba(255, 90, 40, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(0, VIEW_H - 80, VIEW_W, 80);
    }
  },
  storm(ctx, frame, layer) {
    if (layer === 'front') return;
    // A flash every few seconds, and sparks in the grass.
    const cycle = frame % 300;
    if (cycle < 10) {
      ctx.globalAlpha = (cycle < 3 ? 0.35 : 0.15) * (1 - cycle / 10);
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const phase = (frame / 20 + rand(i)) % 1;
      ctx.globalAlpha = phase < 0.2 ? 1 - phase * 5 : 0;
      ctx.fillStyle = '#ffe94a';
      ctx.fillRect(rand(i, 1) * VIEW_W, 150 + rand(i, 2) * 100, 1, 2);
    }
  },
  stars(ctx, frame, layer) {
    if (layer === 'front') return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(frame / (30 + rand(i) * 40) + i));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rand(i, 1) * VIEW_W, rand(i, 2) * 180, 1, 1);
    }
  },
  arena(ctx, frame, layer) {
    if (layer === 'front') return;
    // Two spotlights sweeping the stage.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const x = VIEW_W / 2 + Math.sin(frame / 160 + i * Math.PI) * 170;
      const light = ctx.createRadialGradient(x, FLOOR_Y, 0, x, FLOOR_Y, 70);
      light.addColorStop(0, 'rgba(255, 220, 230, 0.16)');
      light.addColorStop(1, 'rgba(255, 220, 230, 0)');
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, 70, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      const beam = ctx.createLinearGradient(VIEW_W / 2 + (i ? 120 : -120), 0, x, FLOOR_Y);
      beam.addColorStop(0, 'rgba(255, 230, 240, 0.12)');
      beam.addColorStop(1, 'rgba(255, 230, 240, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(VIEW_W / 2 + (i ? 120 : -120) - 6, 0);
      ctx.lineTo(VIEW_W / 2 + (i ? 120 : -120) + 6, 0);
      ctx.lineTo(x + 50, FLOOR_Y);
      ctx.lineTo(x - 50, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
    }
  },
};
