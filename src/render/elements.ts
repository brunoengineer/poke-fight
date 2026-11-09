// How each type's specials look (plan.md §4.9): the projectile, the beam and the charge, by the move's type. A
// Psychic move throws purple energy, a Fire move a fireball, a Water move a bubble… Purely for the eyes: the hitboxes
// and the damage are the fight's (fight/frame-data.ts), whatever is drawn.
//
// Everything is drawn in art pixels (the 480×270 world), facing right: callers pass `dir` and the drawing mirrors.

export type ProjectileLook =
  | 'star'
  | 'fireball'
  | 'bubble'
  | 'spark'
  | 'leaf'
  | 'shard'
  | 'aura'
  | 'sludge'
  | 'clod'
  | 'blade'
  | 'psyche'
  | 'swarm'
  | 'rock'
  | 'shadow'
  | 'dragon'
  | 'pulse'
  | 'gear';

export type BeamLook = 'wave' | 'flame' | 'jet' | 'bolt' | 'frost' | 'rings' | 'gloom';

/** What a special leaves behind it (fx.ts): embers rise, drops fall, smoke spreads… */
export type ParticleLook = 'glow' | 'ember' | 'drop' | 'spark' | 'flake' | 'leaf' | 'debris' | 'smoke';

export interface ElementLook {
  projectile: ProjectileLook;
  beam: BeamLook;
  particle: ParticleLook;
  /** Light, main, deep. */
  colors: readonly [string, string, string];
  /** A bright color for glows and sparks (added to the scene, so it must be light). */
  energy: string;
  /** Dark energy (Ghost, Dark): drawn over the scene, since adding a dark color to it shows nothing. */
  dark: boolean;
}

const look = (
  projectile: ProjectileLook,
  beam: BeamLook,
  particle: ParticleLook,
  colors: readonly [string, string, string],
  energy = colors[1],
  dark = false,
): ElementLook => ({ projectile, beam, particle, colors, energy, dark });

export const ELEMENT_LOOKS: Record<string, ElementLook> = {
  normal: look('star', 'wave', 'glow', ['#fffbe6', '#ffe48a', '#c9a13e']),
  fire: look('fireball', 'flame', 'ember', ['#fff4b8', '#ff9a2e', '#e2361a']),
  water: look('bubble', 'jet', 'drop', ['#e8f7ff', '#62b6ff', '#2a68d4']),
  electric: look('spark', 'bolt', 'spark', ['#fffde0', '#ffe23a', '#e09a00']),
  grass: look('leaf', 'wave', 'leaf', ['#eaffd2', '#72dc4c', '#258f34']),
  ice: look('shard', 'frost', 'flake', ['#ffffff', '#a6f0ff', '#46b2e6']),
  fighting: look('aura', 'wave', 'glow', ['#fff0c8', '#ff8a3a', '#c42e1c']),
  poison: look('sludge', 'wave', 'drop', ['#f4d0ff', '#b452dc', '#5e1a80']),
  ground: look('clod', 'wave', 'debris', ['#f6e2b2', '#c89c5a', '#76552a'], '#f0c070'),
  flying: look('blade', 'wave', 'glow', ['#ffffff', '#d8d2ff', '#8e7ee6']),
  // Purple (the type's own pink is for its badge): "purple energy" is what a psychic attack looks like.
  psychic: look('psyche', 'rings', 'glow', ['#f6e2ff', '#bf6cff', '#7426d0']),
  bug: look('swarm', 'wave', 'glow', ['#f6ffc6', '#bcd832', '#62820e']),
  rock: look('rock', 'wave', 'debris', ['#f0e4ac', '#b89e46', '#6a5a20'], '#e8d488'),
  ghost: look('shadow', 'gloom', 'smoke', ['#dcc6ff', '#7c52d4', '#22103e'], '#a07cff', true),
  dragon: look('dragon', 'wave', 'glow', ['#dceaff', '#6c5cff', '#341aa6']),
  dark: look('pulse', 'gloom', 'smoke', ['#ff8aa2', '#4c2a5c', '#120818'], '#ff5d7e', true),
  steel: look('gear', 'wave', 'spark', ['#ffffff', '#c6d0e2', '#646e86'], '#e4ecff'),
  fairy: look('star', 'rings', 'glow', ['#fff0f7', '#ff9ccb', '#d4528f']),
};

/** The look of a move of this type (a typeless or unknown one looks Normal). */
export const elementLook = (type: string | null | undefined): ElementLook => ELEMENT_LOOKS[type ?? 'normal'] ?? ELEMENT_LOOKS.normal;

// ── Small helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A stable pseudo-random number in [0, 1) for these integers (no state: the same frame draws the same). */
export function hash(a: number, b = 0): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A ball lit from the front: white center → light → main → deep edge. */
function ball(ctx: Ctx, x: number, y: number, r: number, colors: readonly [string, string, string], core = '#ffffff') {
  const g = ctx.createRadialGradient(x + r * 0.2, y - r * 0.15, 0, x, y, r);
  g.addColorStop(0, core);
  g.addColorStop(0.3, colors[0]);
  g.addColorStop(0.7, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A flame tongue from (0, 0) back to (-length, offset): the fireball's tail, the shadow ball's wisps. */
export function tongue(ctx: Ctx, length: number, width: number, offset: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(width * 0.4, -width);
  ctx.quadraticCurveTo(-length * 0.45, -width * 1.15 + offset * 0.4, -length, offset);
  ctx.quadraticCurveTo(-length * 0.45, width * 1.15 + offset * 0.4, width * 0.4, width);
  ctx.closePath();
  ctx.fill();
}

/** A four-pointed twinkle. */
export function twinkle(ctx: Ctx, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.25, y - size * 0.25);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.25, y + size * 0.25);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.25, y + size * 0.25);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.25, y - size * 0.25);
  ctx.closePath();
  ctx.fill();
}

/** A closed outline around (0, 0) whose radius is `radius(angle)`. */
function blob(ctx: Ctx, points: number, radius: (angle: number, i: number) => number) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const r = radius(a, i % points);
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** A jagged line from (x1, y1) to (x2, y2), re-drawn every other frame (lightning). */
export function jagged(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, segments: number, spread: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const length = Math.hypot(nx, ny) || 1;
    const off = (hash(seed, i) - 0.5) * 2 * spread;
    ctx.lineTo(x1 + (x2 - x1) * t + (nx / length) * off, y1 + (y2 - y1) * t + (ny / length) * off);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ── Projectiles ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A projectile of this type, centered on (x, y) with radius r (the hit band's half height), travelling towards `dir`.
 * `frame` animates it; `seed` (the projectile's id) keeps two of them from flickering in step.
 */
export function drawProjectileLook(ctx: Ctx, type: string | null, x: number, y: number, r: number, dir: number, frame: number, seed = 0) {
  const l = elementLook(type);
  const [light, main, deep] = l.colors;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir < 0 ? -1 : 1, 1);
  const add = () => (ctx.globalCompositeOperation = 'lighter');
  const over = () => (ctx.globalCompositeOperation = 'source-over');
  const f = frame + seed * 7;

  switch (l.projectile) {
    case 'star': {
      add();
      glow(ctx, 0, 0, r * 2.3, l.energy, 0.75);
      for (const [back, size, alpha] of [
        [r * 1.9, 0.45, 0.55],
        [r * 3, 0.3, 0.3],
      ]) {
        ctx.globalAlpha = alpha;
        star(ctx, -back, Math.sin((f + back) * 0.3) * r * 0.25, r * size * 1.1, f * 0.3, light);
      }
      ctx.globalAlpha = 1;
      over();
      star(ctx, 0, 0, r * 1.15, f * 0.25, light, main);
      break;
    }
    case 'fireball': {
      add();
      glow(ctx, 0, 0, r * 2.6, main, 0.6);
      over();
      for (let i = 0; i < 4; i++) {
        const length = r * (2.6 + 0.7 * Math.sin(f * 0.8 + i * 1.7));
        const offset = (i - 1.5) * r * 0.36 + Math.sin(f * 0.6 + i) * r * 0.22;
        tongue(ctx, length, r * 0.62, offset, rgba(deep, 0.9));
      }
      for (let i = 0; i < 3; i++) {
        const length = r * (1.9 + 0.5 * Math.sin(f * 0.9 + i * 2.1));
        tongue(ctx, length, r * 0.5, (i - 1) * r * 0.3 + Math.sin(f * 0.7 + i) * r * 0.15, rgba(main, 0.95));
      }
      tongue(ctx, r * (1.2 + 0.25 * Math.sin(f * 1.1)), r * 0.38, Math.sin(f * 0.5) * r * 0.1, rgba(light, 0.95));
      ball(ctx, r * 0.1, 0, r * 0.95, [light, main, deep], '#fffbe8');
      break;
    }
    case 'bubble': {
      add();
      glow(ctx, 0, 0, r * 1.9, main, 0.35);
      over();
      for (const [back, size, phase] of [
        [r * 1.75, 0.38, 0],
        [r * 2.7, 0.24, 2],
        [r * 3.4, 0.16, 4],
      ]) {
        bubble(ctx, -back, Math.sin(f * 0.25 + phase) * r * 0.45, r * size, r * size, light, main, deep);
      }
      const wobble = Math.sin(f * 0.35) * 0.07;
      bubble(ctx, 0, 0, r * (1 + wobble), r * (1 - wobble), light, main, deep);
      break;
    }
    case 'spark': {
      add();
      glow(ctx, 0, 0, r * 2.6, main, 0.85);
      ctx.lineCap = 'round';
      const turn = Math.floor(f / 2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + hash(turn, i + seed) * 0.9;
        const reach = r * (1.5 + hash(turn + 9, i) * 0.8);
        ctx.strokeStyle = rgba(main, 0.7);
        ctx.lineWidth = 2.4;
        jagged(ctx, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, Math.cos(a) * reach, Math.sin(a) * reach, 4, r * 0.3, turn * 13 + i);
        ctx.strokeStyle = light;
        ctx.lineWidth = 1;
        jagged(ctx, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, Math.cos(a) * reach, Math.sin(a) * reach, 4, r * 0.3, turn * 13 + i);
      }
      ball(ctx, 0, 0, r * 0.7, [light, main, main]);
      break;
    }
    case 'leaf': {
      add();
      glow(ctx, 0, 0, r * 1.8, main, 0.4);
      over();
      for (let i = 0; i < 3; i++) {
        const a = f * 0.32 + (i / 3) * TAU;
        ctx.save();
        ctx.translate(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
        ctx.rotate(a + Math.PI / 2);
        leaf(ctx, r * 0.78, r * 0.36, light, main, deep);
        ctx.restore();
      }
      break;
    }
    case 'shard': {
      add();
      glow(ctx, 0, 0, r * 2, main, 0.6);
      for (let k = 0; k < 3; k++) {
        const twinkling = 0.5 + 0.5 * Math.sin(f * 0.5 + k * 2);
        twinkle(ctx, -r * (1.9 + k * 0.9), Math.sin(k * 2.3 + f * 0.1) * r * 0.6, r * 0.35 * twinkling + 0.6, light);
      }
      over();
      const g = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, main);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(r * 1.7, 0);
      ctx.lineTo(r * 0.1, -r * 0.62);
      ctx.lineTo(-r * 1.3, 0);
      ctx.lineTo(r * 0.1, r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 1.7, 0);
      ctx.lineTo(-r * 1.3, 0);
      ctx.stroke();
      break;
    }
    case 'aura': {
      add();
      glow(ctx, 0, 0, r * 2.4, main, 0.6);
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const y = (k - 1) * r * 0.55;
        ctx.strokeStyle = rgba(light, 0.55 - k * 0.1);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r * 1.2, y);
        ctx.lineTo(-r * (2.6 + hash(Math.floor(f / 3), k) * 1.2), y);
        ctx.stroke();
      }
      over();
      ball(ctx, 0, 0, r, [light, main, deep], '#fffbe6');
      add();
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.3;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.18, f * 0.4 + k * Math.PI, f * 0.4 + k * Math.PI + 1.6);
        ctx.stroke();
      }
      break;
    }
    case 'sludge': {
      add();
      glow(ctx, 0, 0, r * 1.9, main, 0.35);
      over();
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.15);
      g.addColorStop(0, light);
      g.addColorStop(0.45, main);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      blob(ctx, 20, a => r * (1 + 0.13 * Math.sin(a * 3 + f * 0.3) + 0.08 * Math.sin(a * 5 - f * 0.2)));
      ctx.fill();
      ctx.strokeStyle = rgba(light, 0.75);
      ctx.lineWidth = 0.8;
      for (const [bx, by, br] of [
        [r * 0.25, r * 0.2, r * 0.22],
        [-r * 0.35, r * 0.4, r * 0.14],
      ]) {
        ctx.beginPath();
        ctx.arc(bx, by + Math.sin(f * 0.2 + bx) * r * 0.1, br, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = rgba('#ffffff', 0.7);
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.26, r * 0.14, -0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'clod': {
      over();
      ctx.rotate(f * 0.22);
      ctx.fillStyle = main;
      blob(ctx, 9, (_, i) => r * (0.82 + 0.25 * hash(i, 4)));
      ctx.fill();
      ctx.strokeStyle = deep;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(light, 0.55);
      blob(ctx, 9, (a, i) => (Math.cos(a + 2.2) > 0.1 ? r * (0.62 + 0.2 * hash(i, 4)) : r * 0.1));
      ctx.fill();
      ctx.fillStyle = deep;
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(Math.cos(k * 1.9) * r * 0.45, Math.sin(k * 2.7) * r * 0.45, r * 0.18, r * 0.18);
      }
      break;
    }
    case 'blade': {
      add();
      glow(ctx, 0, 0, r * 2, main, 0.45);
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const y = (k - 1) * r * 0.7;
        const shift = ((f * 2 + k * 5) % 12) / 12;
        ctx.strokeStyle = rgba(light, 0.5 * (1 - shift));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * (1 + shift * 2), y);
        ctx.quadraticCurveTo(-r * (2 + shift * 2), y - r * 0.3, -r * (3 + shift * 2), y);
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(-r, 0, r * 1.2, 0);
      g.addColorStop(0, rgba(main, 0));
      g.addColorStop(0.6, main);
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(-r * 0.5, 0, r * 1.55, -1.15, 1.15);
      ctx.arc(-r * 1.05, 0, r * 1.45, 1.05, -1.05, true);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'psyche': {
      add();
      glow(ctx, 0, 0, r * 2.6, main, 0.55);
      over();
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 2; k++) {
        const phase = ((f + k * 7) % 14) / 14;
        ctx.strokeStyle = rgba(k ? main : deep, 0.95 * (1 - phase));
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.9 + phase * 1.4), 0, TAU);
        ctx.stroke();
      }
      ball(ctx, 0, 0, r * 0.95, [main, main, deep], light);
      add();
      for (let k = 0; k < 3; k++) {
        const a = -f * 0.18 + (k / 3) * TAU;
        twinkle(ctx, Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45, r * 0.3, light);
      }
      break;
    }
    case 'swarm': {
      add();
      glow(ctx, 0, 0, r * 2, main, 0.55);
      ball(ctx, 0, 0, r * 0.6, [light, main, deep]);
      for (let k = 0; k < 8; k++) {
        const a = f * (0.25 + hash(k, 2) * 0.3) + k * 1.3;
        const d = r * (0.85 + hash(k, 3) * 0.75);
        ctx.fillStyle = k % 2 ? light : main;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8, 0.9 + hash(k, 5) * 0.7, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'rock': {
      over();
      ctx.rotate(f * 0.16);
      const points = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * TAU;
        const d = r * (0.9 + 0.22 * hash(i, 8));
        return [Math.cos(a) * d, Math.sin(a) * d] as const;
      });
      ctx.fillStyle = main;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      // Lit faces on top, shaded ones below (they turn with the rock).
      points.forEach(([px, py], i) => {
        const [qx, qy] = points[(i + 1) % points.length];
        const facing = Math.sin(Math.atan2(py + qy, px + qx) + f * 0.16);
        ctx.fillStyle = facing < -0.3 ? rgba(light, 0.55) : facing > 0.4 ? rgba(deep, 0.5) : 'rgba(0,0,0,0)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(px, py);
        ctx.lineTo(qx, qy);
        ctx.closePath();
        ctx.fill();
      });
      ctx.strokeStyle = deep;
      ctx.lineWidth = 1;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'shadow': {
      add();
      glow(ctx, 0, 0, r * 2.4, l.energy, 0.6);
      over();
      for (let i = 0; i < 3; i++) {
        const length = r * (2 + 0.6 * Math.sin(f * 0.5 + i * 2));
        tongue(ctx, length, r * 0.5, (i - 1) * r * 0.5 + Math.sin(f * 0.4 + i) * r * 0.3, rgba(i === 1 ? main : deep, 0.85));
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#05000c');
      g.addColorStop(0.55, deep);
      g.addColorStop(1, main);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      add();
      ctx.strokeStyle = rgba(light, 0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(l.energy, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, -f * 0.3, -f * 0.3 + 2.2);
      ctx.stroke();
      break;
    }
    case 'dragon': {
      add();
      glow(ctx, 0, 0, r * 2.5, main, 0.55);
      over();
      for (let i = 0; i < 3; i++) {
        tongue(ctx, r * (2.3 + 0.5 * Math.sin(f * 0.7 + i * 2)), r * 0.55, (i - 1) * r * 0.42, rgba(i === 1 ? main : deep, 0.85));
      }
      tongue(ctx, r * (1.4 + 0.3 * Math.sin(f)), r * 0.35, 0, rgba(light, 0.8));
      ball(ctx, 0, 0, r * 0.95, [main, main, deep], light);
      add();
      ctx.strokeStyle = rgba(light, 0.9);
      ctx.lineWidth = 1.2;
      for (let arm = 0; arm < 2; arm++) {
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const a = -f * 0.35 + arm * Math.PI + s * 0.3;
          const d = r * (0.25 + s * 0.06);
          if (s === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        ctx.stroke();
      }
      break;
    }
    case 'pulse': {
      add();
      glow(ctx, 0, 0, r * 2.2, l.energy, 0.35);
      over();
      for (let k = 0; k < 3; k++) {
        const phase = ((f + k * 5) % 15) / 15;
        const radius = r * (0.7 + phase * 1.3);
        ctx.strokeStyle = rgba(main, 0.9 * (1 - phase));
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(light, 0.8 * (1 - phase));
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.85);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.7, deep);
      g.addColorStop(1, main);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = light;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'gear': {
      add();
      glow(ctx, 0, 0, r * 2.2, l.energy, 0.6);
      over();
      ctx.rotate(f * 0.35);
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, main);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * TAU;
        const a1 = ((i + 1) / (teeth * 2)) * TAU;
        const d = i % 2 ? r * 0.92 : r * 1.22;
        if (i === 0) ctx.moveTo(Math.cos(a0) * d, Math.sin(a0) * d);
        else ctx.lineTo(Math.cos(a0) * d, Math.sin(a0) * d);
        ctx.lineTo(Math.cos(a1) * d, Math.sin(a1) * d);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = deep;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, TAU);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, r: number, turn: number, fill: string, stroke?: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = turn + (i / 10) * TAU - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function bubble(ctx: Ctx, x: number, y: number, rx: number, ry: number, light: string, main: string, deep: string) {
  const r = Math.max(rx, ry);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, rgba('#ffffff', 0.12));
  g.addColorStop(0.7, rgba(main, 0.35));
  g.addColorStop(1, rgba(deep, 0.75));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(0.6, r * 0.1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(0.6, r * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.68, ry * 0.68, 0, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + rx * 0.4, y + ry * 0.38, Math.max(0.5, r * 0.1), 0, TAU);
  ctx.fill();
}

function leaf(ctx: Ctx, length: number, width: number, light: string, main: string, deep: string) {
  ctx.beginPath();
  ctx.moveTo(-length, 0);
  ctx.quadraticCurveTo(0, -width * 2, length, 0);
  ctx.quadraticCurveTo(0, width * 2, -length, 0);
  ctx.closePath();
  ctx.fillStyle = main;
  ctx.fill();
  ctx.strokeStyle = deep;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.strokeStyle = light;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-length * 0.8, 0);
  ctx.lineTo(length * 0.8, 0);
  ctx.stroke();
}

// ── Beams ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A beam of this type over a box on screen (`from` is the end at the attacker, `to` the far end; `top` < `bottom`).
 * The band is painted in the type's colors (deep edge → main → light core), with only a soft halo added to the scene:
 * an all-added beam turns white on a bright stage. Then each type adds its texture: flames, foam, lightning, ice
 * crystals, psychic rings…
 */
export function drawBeamLook(ctx: Ctx, type: string | null, from: number, to: number, top: number, bottom: number, frame: number, flicker = 1) {
  const l = elementLook(type);
  const [light, main, deep] = l.colors;
  const dir = to >= from ? 1 : -1;
  const length = Math.abs(to - from);
  const half = (bottom - top) / 2;
  ctx.save();
  ctx.translate(from, (top + bottom) / 2);
  ctx.scale(dir, 1);
  ctx.globalAlpha = flicker;
  const scroll = frame * 6;

  // The halo, added (soft, so it never washes out).
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createLinearGradient(0, -half * 2.4, 0, half * 2.4);
  halo.addColorStop(0, rgba(l.energy, 0));
  halo.addColorStop(0.5, rgba(l.energy, 0.32));
  halo.addColorStop(1, rgba(l.energy, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, -half * 2.4, length, half * 4.8);
  ctx.globalCompositeOperation = 'source-over';

  // The band, painted. Electricity has none: it is only the bolts.
  const thickness = l.beam === 'bolt' ? 0 : half * (0.92 + 0.08 * Math.sin(frame * 0.9));
  if (thickness > 0) {
    const band = ctx.createLinearGradient(0, -thickness, 0, thickness);
    if (l.dark) {
      band.addColorStop(0, rgba(main, 0));
      band.addColorStop(0.18, rgba(main, 0.95));
      band.addColorStop(0.5, deep);
      band.addColorStop(0.82, rgba(main, 0.95));
      band.addColorStop(1, rgba(main, 0));
    } else {
      band.addColorStop(0, rgba(deep, 0));
      band.addColorStop(0.15, rgba(deep, 0.9));
      band.addColorStop(0.32, main);
      band.addColorStop(0.46, light);
      band.addColorStop(0.5, '#ffffff');
      band.addColorStop(0.54, light);
      band.addColorStop(0.68, main);
      band.addColorStop(0.85, rgba(deep, 0.9));
      band.addColorStop(1, rgba(deep, 0));
    }
    ctx.fillStyle = band;
    ctx.fillRect(0, -thickness, length, thickness * 2);
    // A rounded head at the far end.
    ctx.beginPath();
    ctx.ellipse(length, 0, thickness * 0.7, thickness * 0.85, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  }

  switch (l.beam) {
    case 'wave':
    case 'gloom': {
      // Two strands twisting along it.
      ctx.lineWidth = 1;
      for (const [phase, color] of [
        [0, l.dark ? l.energy : light],
        [Math.PI, l.dark ? light : deep],
      ] as const) {
        ctx.strokeStyle = rgba(color, 0.85);
        ctx.beginPath();
        for (let x = 0; x <= length; x += 3) {
          const y = Math.sin((x - scroll) / 9 + phase) * half * 0.62;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'flame': {
      // Tongues licking up and down along the stream, rushing forward.
      for (let x = (scroll % 8) - 8; x < length + 4; x += 8) {
        const k = Math.floor((x - scroll) / 8);
        for (const side of [-1, 1]) {
          const size = half * (0.55 + hash(k, side + 3) * 0.6);
          ctx.fillStyle = rgba(hash(k, side + 5) > 0.45 ? main : deep, 0.95);
          ctx.beginPath();
          ctx.moveTo(x - size, side * half * 0.4);
          ctx.quadraticCurveTo(x - size * 0.2, side * (half * 0.6 + size * 1.1), x + size * 0.9, side * (half * 0.5 + size * 0.5));
          ctx.quadraticCurveTo(x + size * 0.3, side * half * 0.5, x + size * 0.6, side * half * 0.3);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = rgba(light, 0.9);
      ctx.fillRect(0, -half * 0.22, length, half * 0.44);
      break;
    }
    case 'jet': {
      // Foam streaks rushing forward, and spray at the far end.
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineCap = 'round';
      for (let k = 0; k < Math.ceil(length / 9); k++) {
        const x = ((k * 9 + scroll * 1.4) % (length + 20)) - 10;
        const y = (hash(k, 7) - 0.5) * half * 1.3;
        ctx.lineWidth = 0.8 + hash(k, 8) * 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x), y);
        ctx.lineTo(Math.min(length, x + 4 + hash(k, 9) * 7), y);
        ctx.stroke();
      }
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = k % 2 ? light : '#ffffff';
        ctx.beginPath();
        ctx.arc(length + hash(frame, k) * 8, (hash(frame + 3, k) - 0.5) * half * 3, 0.7 + hash(k, frame) * 1.2, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'bolt': {
      // Two bolts re-struck every other frame, with branches.
      const turn = Math.floor(frame / 2);
      const segments = Math.max(4, Math.round(length / 12));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let k = 0; k < 2; k++) {
        const seed = turn * 31 + k * 7;
        ctx.strokeStyle = rgba(deep, 0.75);
        ctx.lineWidth = 3.4;
        jagged(ctx, 0, 0, length, 0, segments, half * 1.1, seed);
        ctx.strokeStyle = main;
        ctx.lineWidth = 2;
        jagged(ctx, 0, 0, length, 0, segments, half * 1.1, seed);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.9;
        jagged(ctx, 0, 0, length, 0, segments, half * 1.1, seed);
      }
      ctx.strokeStyle = rgba(light, 0.9);
      ctx.lineWidth = 0.8;
      for (let k = 0; k < Math.floor(length / 40); k++) {
        const x = (k + hash(turn, k)) * 40;
        jagged(ctx, x, 0, x + 10 + hash(turn, k + 9) * 8, (hash(turn, k + 4) > 0.5 ? 1 : -1) * half * 1.6, 3, 3, turn + k);
      }
      break;
    }
    case 'frost': {
      // Ice crystals frozen along it.
      for (let x = 8 - (scroll % 14); x < length; x += 14) {
        const k = Math.floor((x + scroll) / 14);
        const size = half * (0.7 + hash(k, 4) * 0.5);
        ctx.save();
        ctx.translate(x, (hash(k, 5) - 0.5) * half * 0.9);
        ctx.rotate(frame * 0.04 + k);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = deep;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.45, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'rings': {
      // Rings travelling along it (Psybeam), in the type's colors.
      const palette = [deep, main, light];
      ctx.lineWidth = 1.4;
      for (let x = scroll % 12; x < length; x += 12) {
        const k = Math.floor((x - scroll) / 12);
        ctx.strokeStyle = palette[((k % 3) + 3) % 3];
        ctx.beginPath();
        ctx.ellipse(x, 0, 2.6, half * 1.25, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// ── The charge ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A special being charged at (x, y): a glow in the type's colors, with the projectile itself forming in it (it grows
 * until the charge ends, so the player sees what is coming: a fireball, a bubble, a stone…).
 */
export function drawChargeLook(ctx: Ctx, type: string | null, x: number, y: number, progress: number, big: boolean, dir: number, frame: number, forming: boolean) {
  const l = elementLook(type);
  const radius = (big ? 16 : 8) * progress + 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = frame % 4 < 2 ? 1 : 0.8;
  glow(ctx, x, y, radius * 2.2, l.energy, 0.9);
  glow(ctx, x, y, radius * 0.9, '#ffffff', 0.8);
  // A ring closing in: the charge's timing at a glance.
  ctx.strokeStyle = rgba(l.colors[0], 0.6 * progress);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * (3.4 - 2.2 * progress), 0, TAU);
  ctx.stroke();
  ctx.restore();
  if (forming && progress > 0.25) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (progress - 0.25) * 2);
    drawProjectileLook(ctx, type, x, y, (big ? 15 : 8) * progress, dir, frame);
    ctx.restore();
  }
}
