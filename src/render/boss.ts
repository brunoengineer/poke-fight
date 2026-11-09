// Draws the legendary bosses' attacks (fight/boss.ts). Like the rest of render/, it only reads the fight state.
//
// Two layers: drawBossBack() under the fighters (ground warnings, danger zones, the enraged aura) and drawBossFront()
// over them (the crescent wave, the sphere, meteors, shockwaves, the vortex). Warnings are always red; the energy is
// the boss's own type color.
//
// Cheap on purpose: gradients are made once per color around (0, 0) with radius 1 and placed with translate/scale;
// the crescent is one cached Path2D; nothing else is allocated per frame. Particles live in fx.ts (capped there).

import {
  BOSS_ATTACK,
  bossStage,
  METEOR,
  NOVA,
  novaRadius,
  QUAKE,
  RAMPAGE,
  SLASH,
  VORTEX,
  type BossAttack,
} from '../fight/boss';
import { BODY_HEIGHT, SUB } from '../fight/constants';
import type { Fighter, FightState } from '../fight/state';
import { typeColor } from './colors';
import { VIEW_W } from './screen';
import { FLOOR_Y } from './stage';

const TAU = Math.PI * 2;
const WARN = '#ff3b4a';
const X = (x: number) => x / SUB;
/** The middle of a standing body, on screen. */
const BODY_MID = FLOOR_Y - BODY_HEIGHT / SUB / 2;

/** "#rrggbb" + alpha → "rgba(…)" (gradients fade to the same color, never to grey). */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const energyOf = (boss: Fighter) => typeColor(boss.types[0]);
const foeOf = (round: FightState, boss: Fighter) => round.fighters[boss.id === 0 ? 1 : 0];
const sign = (n: number, fallback: number) => (n === 0 ? fallback : Math.sign(n));

// ── Cached gradients and paths ────────────────────────────────────────────────────────────────────────────────────

type GlowKind = 'orb' | 'sphere' | 'trail' | 'band' | 'shade';
const gradients = new Map<string, CanvasGradient>();

/**
 * A gradient made once: radial ones around (0, 0) with radius 1, linear ones from x 0 to 1. Draw a unit shape after
 * translate/scale and the gradient follows (canvas gradients live in the user space of the fill).
 */
function gradient(ctx: CanvasRenderingContext2D, kind: GlowKind, color: string): CanvasGradient {
  const key = `${kind}${color}`;
  let g = gradients.get(key);
  if (g) return g;
  switch (kind) {
    case 'orb':
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.22, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, rgba(color, 0.75));
      g.addColorStop(1, rgba(color, 0));
      break;
    case 'sphere':
      // Brighter at the rim, like a shell of energy.
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.18, rgba(color, 0.5));
      g.addColorStop(0.7, rgba(color, 0.22));
      g.addColorStop(0.93, rgba(color, 0.55));
      g.addColorStop(0.97, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, rgba(color, 0));
      break;
    case 'trail':
      g = ctx.createLinearGradient(0, 0, 1, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, rgba(color, 0.8));
      g.addColorStop(1, rgba(color, 0));
      break;
    case 'shade':
      // A dark hollow (drawn normally, not added: it darkens what is behind).
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(8,0,20,0.7)');
      g.addColorStop(0.6, 'rgba(16,0,36,0.35)');
      g.addColorStop(1, 'rgba(16,0,36,0)');
      break;
    case 'band':
      // The crescent's body: transparent at its back, white at its edge.
      g = ctx.createLinearGradient(-1, 0, 0, 0);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.55, rgba(color, 0.7));
      g.addColorStop(0.85, rgba(color, 1));
      g.addColorStop(1, 'rgba(255,255,255,1)');
      break;
  }
  gradients.set(key, g);
  return g;
}

/** A soft glowing disc (or an ellipse, with ry). */
function orb(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1, ry = r) {
  if (r <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(r, ry);
  ctx.fillStyle = gradient(ctx, 'orb', color);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/**
 * The Great Slash's crescent, facing +x with its front edge at (0, 0): an outer arc and an inner one that meets it at
 * the tips, so it is thick in the middle and sharp at the ends. In units of its height (half-height 1).
 */
const CRESCENT = { radius: 1.35, spread: 0.85, thickness: 0.2 };
let crescentPath: Path2D | null = null;
function crescent(): Path2D {
  if (crescentPath) return crescentPath;
  const { radius: r, spread, thickness } = CRESCENT;
  const ex = r * Math.cos(spread) - r;
  const ey = r * Math.sin(spread);
  // The inner circle passes through both tips and through (-thickness, 0).
  const cx = (ex * ex + ey * ey - thickness * thickness) / (2 * (ex + thickness));
  const r2 = -thickness - cx;
  const tip = Math.atan2(ey, ex - cx);
  const path = new Path2D();
  path.arc(-r, 0, r, -spread, spread);
  path.arc(cx, 0, r2, tip, -tip, true);
  path.closePath();
  crescentPath = path;
  return path;
}

/** Floor cracks: a fixed zigzag (the same every time), in units of its length. */
const CRACK = Array.from({ length: 24 }, (_, i) => ({ x: i / 23, y: (Math.sin(i * 2.7) + Math.sin(i * 1.3)) * 0.5 }));

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A red lane from x to the wall in a direction, with chevrons running that way: "something comes through here". */
function lane(ctx: CanvasRenderingContext2D, fromX: number, dir: number, top: number, frame: number, strength: number) {
  const to = dir > 0 ? VIEW_W : 0;
  const left = Math.min(fromX, to);
  const width = Math.abs(to - fromX);
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.5);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = rgba(WARN, 0.1 + 0.1 * pulse);
  ctx.fillRect(left, top, width, FLOOR_Y - top);
  ctx.fillStyle = rgba(WARN, 0.8);
  ctx.fillRect(left, top, width, 1);
  ctx.fillRect(left, FLOOR_Y - 1, width, 1);
  ctx.strokeStyle = rgba('#ffd0d4', 0.55 + 0.35 * pulse);
  ctx.lineWidth = 2;
  ctx.beginPath();
  const mid = (top + FLOOR_Y) / 2;
  const size = Math.min(10, (FLOOR_Y - top) / 3);
  for (let x = fromX + dir * (12 + ((frame * 3) % 28)); dir > 0 ? x < to - 4 : x > to + 4; x += dir * 28) {
    ctx.moveTo(x - dir * size * 0.6, mid - size);
    ctx.lineTo(x, mid);
    ctx.lineTo(x - dir * size * 0.6, mid + size);
  }
  ctx.stroke();
  ctx.restore();
}

/** A dashed red circle around the boss (a danger zone), cut at the floor. */
function dangerCircle(ctx: CanvasRenderingContext2D, x: number, radius: number, frame: number, strength: number) {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, FLOOR_Y + 2);
  ctx.clip();
  ctx.globalAlpha = strength;
  ctx.beginPath();
  ctx.arc(x, BODY_MID, radius, 0, TAU);
  ctx.fillStyle = rgba(WARN, 0.06 + 0.07 * pulse);
  ctx.fill();
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -frame;
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(WARN, 0.65 + 0.3 * pulse);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Where the danger meets the floor: bright posts the player can read at a glance.
  const reach = Math.sqrt(Math.max(0, radius * radius - (FLOOR_Y - BODY_MID) ** 2));
  ctx.save();
  ctx.globalAlpha = strength * (0.7 + 0.3 * pulse);
  for (const edge of [x - reach, x + reach]) {
    if (edge <= 0 || edge >= VIEW_W) continue;
    ctx.fillStyle = WARN;
    ctx.fillRect(edge - 2, FLOOR_Y - 22, 4, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(edge - 0.5, FLOOR_Y - 20, 1, 20);
  }
  ctx.restore();
}

/** Energy closing in on the boss while it winds up, and a red "!" over its head. */
function windUp(ctx: CanvasRenderingContext2D, boss: Fighter, a: BossAttack, color: string) {
  const t = BOSS_ATTACK[a.id].telegraph;
  const p = Math.min(1, a.frame / t);
  const x = X(boss.x);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (const k of [0, 0.5]) {
    const q = (p + k) % 1;
    ctx.globalAlpha = q * 0.9;
    ctx.strokeStyle = rgba(color, 1);
    ctx.beginPath();
    ctx.arc(x, BODY_MID, 12 + (1 - q) * 48, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  orb(ctx, color, x, BODY_MID, 22 + 14 * p, 0.35 + 0.35 * p);
  ctx.restore();
  // The "!" blinks faster as the attack gets close.
  if (Math.floor(a.frame / (p > 0.6 ? 3 : 6)) % 2 === 0) {
    const y = FLOOR_Y - X(boss.y) - 78;
    ctx.save();
    ctx.fillStyle = WARN;
    ctx.strokeStyle = '#2a0610';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 8, y + 5);
    ctx.lineTo(x - 8, y + 5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 4, 2, 5);
    ctx.fillRect(x - 1, y + 2, 2, 2);
    ctx.restore();
  }
}

// ── Back layer: warnings on the ground ────────────────────────────────────────────────────────────────────────────

export function drawBossBack(ctx: CanvasRenderingContext2D, round: FightState) {
  for (const boss of round.fighters) {
    const b = boss.boss;
    if (!b || boss.action === 'ko') continue;
    if (b.enraged) enragedAura(ctx, boss, round.frame);
    const a = b.current;
    if (!a) continue;
    const foe = foeOf(round, boss);
    const t = BOSS_ATTACK[a.id].telegraph;
    const stage = bossStage(a);
    const color = energyOf(boss);
    switch (a.id) {
      case 'slash':
        if (stage === 'telegraph') lane(ctx, X(boss.x), sign(foe.x - boss.x, boss.facing), FLOOR_Y - 150, a.frame, Math.min(1, a.frame / 10));
        break;
      case 'nova':
        if (a.frame <= t + NOVA.grow) dangerCircle(ctx, X(a.x), X(NOVA.radius), a.frame, Math.min(1, a.frame / 10));
        break;
      case 'meteor':
        drawMeteorMarks(ctx, a);
        break;
      case 'quake':
        drawCracks(ctx, boss, a, color);
        break;
      case 'rampage':
        // Before each pass, the lane it is about to run down.
        if (a.run === 'wind') lane(ctx, X(boss.x), sign(foe.x - boss.x, boss.facing), FLOOR_Y - 56, a.frame, Math.min(1, a.frame / 10));
        else if (a.run === 'turn') lane(ctx, X(boss.x), -a.dir, FLOOR_Y - 56, a.frame, 1);
        break;
      case 'vortex':
        if (a.frame > t && a.frame <= t + VORTEX.pullFrames) {
          // The eye of the vortex: a dark hollow the arms turn around.
          ctx.save();
          ctx.globalAlpha = Math.min(1, (a.frame - t) / 20);
          ctx.translate(X(a.x), BODY_MID);
          ctx.scale(150, 64);
          ctx.fillStyle = gradient(ctx, 'shade', '');
          ctx.fillRect(-1, -1, 2, 2);
          ctx.restore();
        }
        if (a.frame <= t + VORTEX.pullFrames) {
          dangerCircle(ctx, X(a.x), X(VORTEX.radius), a.frame * (a.frame > t + VORTEX.pullFrames - 40 ? 2 : 1), Math.min(1, a.frame / 10));
        }
        break;
    }
  }
}

function enragedAura(ctx: CanvasRenderingContext2D, boss: Fighter, frame: number) {
  const flicker = 0.75 + 0.25 * Math.sin(frame * 0.35) + 0.1 * Math.sin(frame * 1.7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  orb(ctx, '#ff2a3a', X(boss.x), FLOOR_Y - X(boss.y) - 26, 46, 0.55 * flicker, 40);
  ctx.restore();
}

function drawMeteorMarks(ctx: CanvasRenderingContext2D, a: BossAttack) {
  ctx.save();
  for (const m of a.parts) {
    const x = X(m.x);
    if (a.frame < m.land) {
      const p = (a.frame - m.born) / METEOR.warning;
      const blink = p > 0.65 && a.frame % 4 < 2;
      const half = METEOR.halfWidth / SUB;
      // A column of red light where it falls, as wide as the impact.
      ctx.fillStyle = rgba(WARN, 0.05 + 0.1 * p);
      ctx.fillRect(x - half, 0, half * 2, FLOOR_Y);
      ctx.fillStyle = rgba(WARN, 0.25 * p);
      ctx.fillRect(x - half, 0, 1, FLOOR_Y);
      ctx.fillRect(x + half - 1, 0, 1, FLOOR_Y);
      // The mark on the ground, filling up (a countdown) and blinking at the end.
      ctx.fillStyle = rgba(WARN, blink ? 0.9 : 0.55);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, half, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba('#ffd0d4', 0.85);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, half * p, 5 * p, 0, 0, TAU);
      ctx.fill();
      // A target ring closing in, and an arrow bobbing above.
      const ring = half + (1 - p) * 26;
      ctx.strokeStyle = rgba(blink ? '#ffffff' : WARN, 0.5 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, ring, ring * 0.3, 0, 0, TAU);
      ctx.stroke();
      const ay = FLOOR_Y - 26 - 4 * Math.abs(Math.sin(a.frame * 0.3));
      ctx.fillStyle = WARN;
      ctx.beginPath();
      ctx.moveTo(x - 6, ay - 6);
      ctx.lineTo(x + 6, ay - 6);
      ctx.lineTo(x, ay + 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // A scorch mark, fading.
      const e = (a.frame - m.land) / METEOR.linger;
      ctx.fillStyle = `rgba(20,10,10,${0.5 * (1 - e)})`;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y + 1, 18, 4, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCracks(ctx: CanvasRenderingContext2D, boss: Fighter, a: BossAttack, color: string) {
  const t = BOSS_ATTACK.quake.telegraph;
  const end = t + 1 + QUAKE.gap + QUAKE.recovery;
  if (a.frame > end + 20) return;
  const grow = Math.min(1, a.frame / t);
  const fade = a.frame > end ? 1 - (a.frame - end) / 20 : 1;
  const length = 30 + 170 * grow;
  const x = X(boss.x);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const [width, style] of [
    [4, rgba(color, 0.35 * fade)],
    [1.5, rgba('#fff2c0', (0.6 + 0.4 * Math.sin(a.frame * 0.9)) * fade)],
  ] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.beginPath();
    for (const dir of [-1, 1]) {
      ctx.moveTo(x, FLOOR_Y + 2);
      for (const c of CRACK) ctx.lineTo(x + dir * c.x * length, FLOOR_Y + 3 + c.y * 3);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ── Front layer: the attacks themselves ───────────────────────────────────────────────────────────────────────────

export function drawBossFront(ctx: CanvasRenderingContext2D, round: FightState) {
  for (const boss of round.fighters) {
    const a = boss.boss?.current;
    if (!a || boss.action === 'ko') continue;
    const color = energyOf(boss);
    const t = BOSS_ATTACK[a.id].telegraph;
    ctx.save();
    if (a.frame <= t) windUp(ctx, boss, a, color);
    ctx.globalCompositeOperation = 'lighter';
    switch (a.id) {
      case 'slash':
        drawSlash(ctx, boss, a, color, round);
        break;
      case 'nova':
        drawNova(ctx, a, color);
        break;
      case 'meteor':
        drawMeteors(ctx, boss, a, color);
        break;
      case 'quake':
        drawShocks(ctx, a, color);
        break;
      case 'rampage':
        drawRampage(ctx, boss, a, color);
        break;
      case 'vortex':
        drawVortex(ctx, a, color);
        break;
    }
    ctx.restore();
  }
}

/** Half the crescent's height on screen: from just above the floor to above the top of the screen. */
const SLASH_HALF = 122;

function drawCrescent(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, scale: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  // The band gradient runs over x -1..0: clear at the back of the tips, white at the front edge.
  ctx.fillStyle = gradient(ctx, 'band', color);
  ctx.fill(crescent());
  ctx.restore();
}

function drawSlash(ctx: CanvasRenderingContext2D, boss: Fighter, a: BossAttack, color: string, round: FightState) {
  const t = BOSS_ATTACK.slash.telegraph;
  const centerY = FLOOR_Y - SLASH_HALF + 4;
  if (a.frame <= t) {
    // The blade being raised behind the boss, growing and flickering.
    const p = a.frame / t;
    const dir = sign(foeOf(round, boss).x - boss.x, boss.facing);
    const flicker = a.frame % 3 === 0 ? 0.7 : 1;
    drawCrescent(ctx, X(boss.x) - dir * 12, BODY_MID - 26, dir, 24 + 34 * p, color, (0.35 + 0.65 * p) * flicker);
    return;
  }
  for (const wave of a.parts) {
    const x = X(wave.x);
    // Afterimages behind the wave, then the wave, then a white edge.
    for (let k = 3; k >= 1; k--) drawCrescent(ctx, x - wave.dir * k * 16, centerY, wave.dir, SLASH_HALF, color, 0.5 / (k + 0.5));
    drawCrescent(ctx, x, centerY, wave.dir, SLASH_HALF, color, 1);
    orb(ctx, color, x - wave.dir * 6, centerY, 30, 0.5, SLASH_HALF);
  }
  // Right after the release, a burst at the boss.
  const since = a.frame - t;
  if (since <= SLASH.swing) orb(ctx, color, X(a.x) + a.dir * 16, BODY_MID - 10, 30 + since * 4, 1 - since / SLASH.swing);
}

function drawNova(ctx: CanvasRenderingContext2D, a: BossAttack, color: string) {
  const t = BOSS_ATTACK.nova.telegraph;
  const x = X(a.x);
  if (a.frame <= t) {
    // The core, swelling.
    const p = a.frame / t;
    orb(ctx, color, x, BODY_MID, 8 + 18 * p, 0.6 + 0.4 * p);
    orb(ctx, '#ffffff', x, BODY_MID, 3 + 5 * p, 0.8);
    return;
  }
  const hurtEnd = t + NOVA.grow + NOVA.linger;
  const fadeP = a.frame > hurtEnd ? Math.min(1, (a.frame - hurtEnd) / NOVA.fade) : 0;
  if (fadeP >= 1) return;
  const r = X(novaRadius(a.frame)) * (1 + 0.12 * fadeP);
  const alpha = 1 - fadeP;
  const wobble = 1 + 0.015 * Math.sin(a.frame * 0.8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, FLOOR_Y + 6);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(x, BODY_MID);
  ctx.scale(r * wobble, r * wobble);
  ctx.fillStyle = gradient(ctx, 'sphere', color);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Rings: the rim, and two tilted orbits turning inside.
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba('#ffffff', 0.7);
  ctx.beginPath();
  ctx.arc(x, BODY_MID, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([r * 1.1, r * 0.35]);
  for (const [tilt, height, speed] of [
    [0.22, 0.22, 3],
    [-0.28, 0.14, -4],
  ] as const) {
    ctx.lineDashOffset = a.frame * speed;
    ctx.beginPath();
    ctx.ellipse(x, BODY_MID, r * 0.86, r * height, tilt, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** Meteors fall over their last frames before landing, from high up and a little to the side. */
const FALL = 14;

function drawMeteors(ctx: CanvasRenderingContext2D, boss: Fighter, a: BossAttack, color: string) {
  const t = BOSS_ATTACK.meteor.telegraph;
  if (a.frame <= t + METEOR.cast) {
    // The cast: a pillar of energy shoots up from the boss into the sky.
    const p = Math.min(1, a.frame / t);
    const up = a.frame > t ? 1 - (a.frame - t) / METEOR.cast : p * p;
    orb(ctx, color, X(boss.x), BODY_MID - 100 * up, 10 + 8 * up, 0.9, 110 * up + 10);
  }
  for (const m of a.parts) {
    const x = X(m.x);
    // Every other one comes from the other side, so they don't all look the same.
    const side = m.born % 2 === 0 ? 1 : -1;
    if (a.frame >= m.land - FALL && a.frame < m.land) {
      const q = (a.frame - (m.land - FALL) + 1) / FALL;
      const hx = x + side * (1 - q) * 70;
      const hy = -24 + (FLOOR_Y - 6 + 24) * q;
      const angle = Math.atan2(-(FLOOR_Y - 6 + 24), side * 70);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(angle);
      ctx.scale(70, 7);
      ctx.fillStyle = gradient(ctx, 'trail', color);
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(1, -0.15);
      ctx.lineTo(1, 0.15);
      ctx.lineTo(0, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      orb(ctx, color, hx, hy, 18);
      orb(ctx, '#ffffff', hx, hy, 6);
    } else if (a.frame >= m.land) {
      const e = (a.frame - m.land) / METEOR.linger;
      // A pillar of light, a flash on the ground and a ring.
      orb(ctx, color, x, FLOOR_Y - 46, 14 * (1 - e), 1 - e, 70);
      orb(ctx, color, x, FLOOR_Y - 6, 18 + 26 * e, 1 - e, (18 + 26 * e) * 0.6);
      ctx.strokeStyle = rgba('#ffffff', 0.8 * (1 - e));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, 10 + 38 * e, (10 + 38 * e) * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
  }
}

function drawShocks(ctx: CanvasRenderingContext2D, a: BossAttack, color: string) {
  for (const s of a.parts) {
    const age = a.frame - s.born;
    const fade = Math.min(1, (QUAKE.range - age) / 15);
    const x = X(s.x);
    // The glow left along the floor.
    ctx.save();
    ctx.globalAlpha *= 0.7 * fade;
    ctx.translate(x, FLOOR_Y - 3);
    ctx.scale(-s.dir * 60, 3);
    ctx.fillStyle = gradient(ctx, 'trail', color);
    ctx.fillRect(0, -1, 1, 2);
    ctx.restore();
    // The wave: a dome of energy bulging out of the floor, with a bright front.
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.translate(x, FLOOR_Y);
    ctx.scale(20, 38 + 4 * Math.sin(age * 0.9));
    ctx.fillStyle = gradient(ctx, 'orb', color);
    ctx.beginPath();
    ctx.arc(0, 0, 1, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    orb(ctx, '#ffffff', x, FLOOR_Y - 4, 7, 0.8 * fade, 16);
    // Its bright front, leaning the way it goes.
    ctx.strokeStyle = rgba('#fff4d0', 0.95 * fade);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x + s.dir * 3, FLOOR_Y, 10, 26, 0, s.dir > 0 ? -Math.PI / 2 : Math.PI, s.dir > 0 ? 0 : -Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.8 * fade);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x - s.dir * 4, FLOOR_Y, 14, 18, 0, s.dir > 0 ? -Math.PI / 2 : Math.PI, s.dir > 0 ? 0 : -Math.PI / 2);
    ctx.stroke();
    // Rocks thrown up as it passes.
    ctx.fillStyle = rgba('#e8d2a8', 0.9 * fade);
    for (let k = 0; k < 4; k++) {
      const rx = x - s.dir * (6 + k * 7);
      const ry = FLOOR_Y - 4 - Math.abs(Math.sin(age * 0.35 + k * 1.9)) * (10 + k * 4);
      ctx.fillRect(Math.round(rx), Math.round(ry), 2 + (k % 2), 2);
    }
  }
}

function drawRampage(ctx: CanvasRenderingContext2D, boss: Fighter, a: BossAttack, color: string) {
  if (a.run !== 'run') return;
  const x = X(boss.x);
  const dir = a.dir;
  // A charging aura and speed lines streaming behind.
  orb(ctx, color, x + dir * 6, BODY_MID - 2, 36, 0.75, 28);
  ctx.strokeStyle = rgba('#ffffff', 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const y = BODY_MID - 22 + ((k * 13 + a.frame * 5) % 44);
    const start = x - dir * (18 + ((k * 17 + a.frame * 9) % 26));
    ctx.moveTo(start, y);
    ctx.lineTo(start - dir * (24 + (k % 3) * 10), y);
  }
  ctx.stroke();
  // Sparks off its front.
  orb(ctx, '#ffffff', x + dir * (X(RAMPAGE.halfWidth) - 4), BODY_MID, 8, 0.6 + 0.4 * Math.sin(a.frame));
}

function drawVortex(ctx: CanvasRenderingContext2D, a: BossAttack, color: string) {
  const t = BOSS_ATTACK.vortex.telegraph;
  const burst = t + VORTEX.pullFrames + 1;
  const x = X(a.x);
  if (a.frame > t && a.frame < burst) {
    const p = (a.frame - t) / VORTEX.pullFrames;
    const rot = a.frame * (0.08 + 0.12 * p);
    // Three spiral arms turning faster and faster, and the core.
    ctx.save();
    // The arms stay above the ground.
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, FLOOR_Y + 6);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, alpha] of [
      [6, 0.22],
      [2, 0.8],
    ] as const) {
      ctx.lineWidth = width;
      for (let arm = 0; arm < 3; arm++) {
        ctx.strokeStyle = rgba(arm === 0 && width < 3 ? '#ffffff' : color, alpha * (0.4 + 0.6 * Math.min(1, p * 4)));
        ctx.beginPath();
        for (let s = 0; s <= 20; s++) {
          const q = s / 20;
          const angle = -rot + arm * (TAU / 3) + q * 2.4;
          const radius = 14 + q * 112;
          const px = x + Math.cos(angle) * radius;
          const py = BODY_MID + Math.sin(angle) * radius * 0.42;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    orb(ctx, color, x, BODY_MID, 18 + 4 * Math.sin(a.frame * 0.5) + 10 * p, 0.9);
    orb(ctx, '#ffffff', x, BODY_MID, 6 + 3 * p, 0.9);
  } else if (a.frame >= burst && a.frame < burst + 18) {
    const e = (a.frame - burst) / 18;
    const r = X(VORTEX.radius) * (0.7 + 0.6 * e);
    orb(ctx, color, x, BODY_MID, r * 1.2, 1 - e);
    ctx.strokeStyle = rgba('#ffffff', 1 - e);
    ctx.lineWidth = 3 * (1 - e) + 1;
    ctx.beginPath();
    ctx.arc(x, BODY_MID, r, 0, TAU);
    ctx.stroke();
  }
}

// ── Pose, flash and banner timing (read by renderer.ts) ───────────────────────────────────────────────────────────

export interface Pose {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

/** How the boss's sprite moves during its attack: trembling as it winds up, then each attack's own motion. */
export function bossPose(f: Fighter): Pose | null {
  const a = f.boss?.current;
  if (f.action !== 'bossAttack' || !a) return null;
  const t = BOSS_ATTACK[a.id].telegraph;
  const pose: Pose = { dx: 0, dy: 0, scaleX: 1, scaleY: 1, angle: 0 };
  if (a.frame <= t) {
    const p = a.frame / t;
    pose.dx = (a.frame % 2 === 0 ? 1 : -1) * (p > 0.6 ? 1.5 : 0.75);
    pose.scaleX = pose.scaleY = 1 + 0.06 * p;
    if (a.id === 'quake') {
      // Rising for the slam.
      pose.dy = -18 * p * p;
      [pose.scaleX, pose.scaleY] = [0.94, 1.08];
    }
    if (a.id === 'rampage') pose.angle = -f.facing * 0.1 * p;
    return pose;
  }
  const since = a.frame - t;
  switch (a.id) {
    case 'slash':
      if (since <= SLASH.swing) {
        pose.dx = a.dir * 8;
        pose.angle = a.dir * 0.2;
      }
      break;
    case 'nova':
      pose.scaleX = pose.scaleY = since <= NOVA.grow ? 1.1 : 1;
      break;
    case 'quake':
      if (since <= 8 || (since > QUAKE.gap && since <= QUAKE.gap + 8)) [pose.scaleX, pose.scaleY] = [1.2, 0.8];
      else if (since > QUAKE.gap - 14 && since <= QUAKE.gap) pose.dy = -10 * Math.sin(((since - (QUAKE.gap - 14)) / 14) * Math.PI);
      break;
    case 'rampage':
      if (a.run === 'run') {
        pose.angle = a.dir * 0.22;
        pose.dy = -Math.abs(Math.sin(a.frame * 0.6)) * 3;
      }
      break;
    case 'vortex':
      pose.scaleX = pose.scaleY = 1 + 0.04 * Math.sin(a.frame * 0.5);
      break;
    case 'meteor':
      pose.dy = -4;
      break;
  }
  return pose;
}

/** A white flash over the screen when an attack strikes (0 = none). */
export function bossFlash(round: FightState): number {
  let flash = 0;
  for (const f of round.fighters) {
    const a = f.boss?.current;
    if (!a) continue;
    const since = a.frame - BOSS_ATTACK[a.id].telegraph;
    const fade = (frames: number, strength: number, from = 1) =>
      since >= from && since < from + frames ? strength * (1 - (since - from) / frames) : 0;
    switch (a.id) {
      case 'slash':
        flash = Math.max(flash, fade(8, 0.45));
        break;
      case 'nova':
        flash = Math.max(flash, fade(10, 0.45));
        break;
      case 'quake':
        flash = Math.max(flash, fade(5, 0.2), fade(5, 0.2, 1 + QUAKE.gap));
        break;
      case 'vortex':
        flash = Math.max(flash, fade(10, 0.35, VORTEX.pullFrames + 1));
        break;
      default:
        break;
    }
  }
  return flash;
}

/** The banner with the attack's name shows this long from the start of the attack. */
export const BOSS_BANNER_FRAMES = 75;

/** Ambient darkening of the sky while meteors fall (0..1). */
export function skyFallShade(round: FightState): number {
  let shade = 0;
  for (const f of round.fighters) {
    const a = f.boss?.current;
    if (a?.id !== 'meteor') continue;
    const t = BOSS_ATTACK.meteor.telegraph;
    const end = t + METEOR.rain + METEOR.linger;
    shade = Math.max(shade, Math.min(1, a.frame / t, (end - a.frame) / 20));
  }
  return shade;
}
