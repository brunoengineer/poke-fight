// The big specials' forms (plan.md §4.9): a quake wave, a surf wave, a tornado, a giant beam, a blizzard, a burst, a
// strike from the sky (or the ground), a barrage of rocks or meteors. The hit boxes are the fight's (fight/frame-data
// BIG); these drawings cover them, so what the player sees is what hits. Colors come from the move's type
// (render/elements.ts): a Fire tornado burns, a Flying one is wind; a Water wave is sea, a Poison one is sludge.
// Boxes are drawn at full size from their first active frame: a hit there freezes the game (hitstop), and a drawing
// still growing in would freeze smaller than what hit.

import { BODY_HEIGHT, SUB } from '../fight/constants';
import { BIG } from '../fight/frame-data';
import type { Fighter, FightState, Projectile } from '../fight/state';
import { drawBeamLook, drawProjectileLook, elementLook, glow, hash, jagged, rgba, tongue, twinkle } from './elements';
import { FLOOR_Y } from './stage';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sx = (x: number) => x / SUB;
const sy = (y: number) => FLOOR_Y - y / SUB;
const PX = SUB;

// ── Projectiles: waves, tornadoes, a barrage ──────────────────────────────────────────────────────────────────────

/** A big special's projectile, in its form. Returns false for a plain one (the caller draws it). */
export function drawBigProjectile(ctx: Ctx, p: Projectile, frame: number): boolean {
  const dir = Math.sign(p.vx) || 1;
  const x = sx(p.x);
  const type = p.attack.type;
  switch (p.form) {
    case 'quake':
      drawQuakeWave(ctx, type, x, p.halfWidth / PX, (p.y2 - p.y1) / PX, dir, frame, p.id);
      return true;
    case 'surf':
      drawSurfWave(ctx, type, x, p.halfWidth / PX, (p.y2 - p.y1) / PX, dir, frame);
      return true;
    case 'tornado':
      drawTornado(ctx, type, x, p.halfWidth / PX, (p.y2 - p.y1) / PX, frame);
      return true;
    case 'barrage': {
      // A rock (or a meteor) turned along its flight.
      const cy = sy((p.y1 + p.y2) / 2);
      const angle = Math.atan2(-(p.vy ?? 0), p.vx);
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(angle);
      drawProjectileLook(ctx, type, 0, 0, (p.y2 - p.y1) / PX / 2 + 2, 1, frame, p.id);
      ctx.restore();
      return true;
    }
    default:
      return false;
  }
}

/** Ground: rock spikes bursting out of the floor, a dust cloud behind. */
function drawQuakeWave(
  ctx: Ctx,
  type: string | null,
  x: number,
  half: number,
  height: number,
  dir: number,
  frame: number,
  seed: number,
) {
  const [light, main, deep] = elementLook(type).colors;
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.scale(dir, 1);
  // Dust behind.
  for (let k = 0; k < 5; k++) {
    const age = (frame + k * 3) % 15;
    ctx.fillStyle = rgba(light, 0.45 * (1 - age / 15));
    ctx.beginPath();
    ctx.arc(-half - age * 1.2 - k * 3, -4 - age * 0.6, 3 + age * 0.4, 0, TAU);
    ctx.fill();
  }
  // The floor split behind it, glowing.
  ctx.strokeStyle = rgba(light, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(half, 0);
  for (let k = 1; k <= 8; k++) ctx.lineTo(half - k * 7, (hash(k, seed) - 0.5) * 3);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, -2, half * 1.8, main, 0.45);
  ctx.globalCompositeOperation = 'source-over';
  // Spikes: the front one tallest; they jut out and sink back as the wave passes.
  const spikes = 5;
  for (let k = 0; k < spikes; k++) {
    const at = -half + ((k + 0.5) / spikes) * half * 2;
    const rise = 0.45 + 0.55 * (k / (spikes - 1));
    const h = height * (rise + 0.35 * hash(Math.floor(frame / 3) + k, seed)) * 1.2 + 3;
    const w = half * 0.38;
    ctx.fillStyle = k % 2 ? main : deep;
    ctx.beginPath();
    ctx.moveTo(at - w, 1);
    ctx.lineTo(at - w * 0.15, -h);
    ctx.lineTo(at + w * 0.35, -h * 0.82);
    ctx.lineTo(at + w, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(light, 0.7);
    ctx.beginPath();
    ctx.moveTo(at - w * 0.15, -h);
    ctx.lineTo(at + w * 0.35, -h * 0.82);
    ctx.lineTo(at + w * 0.1, -h * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  // Flying chips.
  ctx.fillStyle = deep;
  for (let k = 0; k < 4; k++) {
    const t = ((frame + k * 4) % 12) / 12;
    ctx.fillRect(half * (0.2 + k * 0.25) - t * 6, -height - t * 14 + t * t * 16, 2, 2);
  }
  ctx.restore();
}

/** Water (Surf), Poison (Sludge Wave): a tall wave curling forward, foam (or bubbles) on its crest. */
function drawSurfWave(
  ctx: Ctx,
  type: string | null,
  x: number,
  half: number,
  height: number,
  dir: number,
  frame: number,
) {
  const l = elementLook(type);
  const [light, main, deep] = l.colors;
  const sludge = type === 'poison';
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.scale(dir, 1);
  const sway = Math.sin(frame * 0.18) * 2;
  const back = -half - 10;
  const front = half + 2;
  const wave = new Path2D();
  wave.moveTo(back, 1);
  wave.quadraticCurveTo(back + 6, -height * 0.5, -half * 0.3, -height * 0.88 + sway);
  wave.quadraticCurveTo(half * 0.35, -height * 1.04, front + 9, -height * 0.84 + sway);
  // The lip curling over, then the hollow front face down to the floor.
  wave.quadraticCurveTo(front + 12, -height * 0.66, front + 3, -height * 0.66);
  wave.quadraticCurveTo(front - 8, -height * 0.5, front + 2, 1);
  wave.closePath();
  const body = ctx.createLinearGradient(0, -height, 0, 0);
  body.addColorStop(0, light);
  body.addColorStop(0.35, main);
  body.addColorStop(1, deep);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = body;
  ctx.fill(wave);
  ctx.globalAlpha = 1;
  // Streaks running up the face.
  ctx.save();
  ctx.clip(wave);
  ctx.strokeStyle = rgba(light, 0.55);
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) {
    const y = -((frame * 1.5 + k * 15) % 75) * (height / 75);
    ctx.beginPath();
    ctx.moveTo(back, y + 6);
    ctx.quadraticCurveTo(0, y - 4, front, y + 2);
    ctx.stroke();
  }
  ctx.restore();
  // Crest: foam (water) or bubbles (sludge).
  ctx.fillStyle = sludge ? rgba(light, 0.9) : '#ffffff';
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const cx = -half * 0.3 + t * (front + 9 + half * 0.3);
    const cy = -height * (0.9 + 0.1 * Math.sin(t * Math.PI)) + sway + Math.sin(frame * 0.4 + k) * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 2 + hash(k, Math.floor(frame / 4)) * 2, 0, TAU);
    ctx.fill();
  }
  if (sludge) {
    ctx.strokeStyle = rgba(light, 0.8);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) {
      const y = -((frame * 0.8 + k * 13) % height);
      ctx.beginPath();
      ctx.arc(-half * 0.5 + hash(k, 3) * half * 1.4, y, 1.5 + hash(k, 4) * 2, 0, TAU);
      ctx.stroke();
    }
  } else {
    // Spray flying off the lip.
    for (let k = 0; k < 6; k++) {
      const t = ((frame + k * 5) % 18) / 18;
      ctx.fillStyle = rgba('#ffffff', 1 - t);
      ctx.beginPath();
      ctx.arc(front + 6 + t * 14 + hash(k, 1) * 4, -height * 0.85 - t * 12 + t * t * 18, 1.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Fire (Fire Spin), Flying (Hurricane): a funnel spinning up from the floor. */
function drawTornado(ctx: Ctx, type: string | null, x: number, half: number, height: number, frame: number) {
  const l = elementLook(type);
  const [light, main, deep] = l.colors;
  const fire = type === 'fire';
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  const rows = 16;
  const ring = (i: number) => {
    const t = i / rows;
    return {
      y: -t * height,
      rx: half * (0.45 + t * 1.15) + Math.sin(frame * 0.25 + i * 0.8) * 2,
      cx: Math.sin(frame * 0.12 + i * 0.45) * (3 + t * 5),
    };
  };
  // The body: a soft glow up the funnel.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i <= rows; i += 4) {
    const r = ring(i);
    glow(ctx, r.cx, r.y, r.rx * 1.6, l.energy, fire ? 0.35 : 0.22);
  }
  ctx.globalCompositeOperation = 'source-over';
  // The funnel's body.
  const top = ring(rows);
  const funnel = ctx.createLinearGradient(-top.rx, 0, top.rx, 0);
  funnel.addColorStop(0, rgba(deep, 0.15));
  funnel.addColorStop(0.5, rgba(fire ? main : light, 0.5));
  funnel.addColorStop(1, rgba(deep, 0.15));
  ctx.fillStyle = funnel;
  ctx.beginPath();
  for (let i = 0; i <= rows; i++) {
    const r = ring(i);
    if (i === 0) ctx.moveTo(r.cx - r.rx, r.y);
    else ctx.lineTo(r.cx - r.rx, r.y);
  }
  for (let i = rows; i >= 0; i--) {
    const r = ring(i);
    ctx.lineTo(r.cx + r.rx, r.y);
  }
  ctx.closePath();
  ctx.fill();
  // Back halves of the rings (darker), then front halves (lighter): it turns.
  for (const front of [false, true]) {
    for (let i = 0; i <= rows; i++) {
      const r = ring(i);
      const spin = frame * 0.35 + i * 0.6;
      ctx.strokeStyle = front ? rgba(i % 3 === 0 ? light : main, 0.9) : rgba(deep, 0.75);
      ctx.lineWidth = front ? 2 : 2.6;
      ctx.beginPath();
      const start = front ? 0 : Math.PI;
      ctx.ellipse(r.cx, r.y, r.rx, r.rx * 0.24, 0, start + (spin % 1) * 0.3, start + Math.PI - 0.15);
      ctx.stroke();
    }
  }
  if (fire) {
    // Flames licking up its sides.
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(hash(k, Math.floor(frame / 5)) * rows);
      const r = ring(i);
      const side = k % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(r.cx + side * r.rx, r.y);
      ctx.rotate(Math.PI / 2 - side * 0.4); // rising, leaning out
      tongue(ctx, 8 + hash(k, frame >> 2) * 8, 2.6, 0, rgba(k % 3 ? main : light, 0.9));
      ctx.restore();
    }
  } else {
    // Wind streaks.
    ctx.strokeStyle = rgba('#ffffff', 0.7);
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const i = (k * 3 + Math.floor(frame / 3)) % rows;
      const r = ring(i);
      ctx.beginPath();
      ctx.ellipse(r.cx, r.y, r.rx * 1.25, r.rx * 0.3, 0, 0.2, 1.4);
      ctx.stroke();
    }
  }
  // Debris swept up at the base.
  ctx.fillStyle = rgba(fire ? light : deep, 0.8);
  for (let k = 0; k < 5; k++) {
    const a = frame * 0.3 + k * 1.3;
    ctx.fillRect(Math.cos(a) * half * 0.9 - 1, -4 - ((frame + k * 7) % 20) * 1.2, 2, 2);
  }
  ctx.restore();
}

// ── On the floor, behind the fighters: what is coming ─────────────────────────────────────────────────────────────

/**
 * A big special's warning: on the floor (behind the fighters) a barrage's landing spots and a strike's shadow; in
 * front of them, the strike's reticle on the opponent (behind, its sprite would hide it).
 */
export function drawBigTelegraph(ctx: Ctx, f: Fighter, round: FightState, layer: 'floor' | 'front') {
  if (f.action !== 'big') return;
  const { shape, type } = f.loadout.big;
  const l = elementLook(type);
  const move = BIG[shape];
  if (
    layer === 'floor' &&
    shape === 'barrage' &&
    move.barrage &&
    f.actionFrame >= 8 &&
    f.actionFrame <= move.startup + move.barrage.flight
  ) {
    // Marks where the rocks will land, from the charge until they do.
    const strength = Math.min(1, (f.actionFrame - 8) / 12);
    for (const [k, distance] of move.barrage.distances.entries()) {
      const x = sx(f.x + f.facing * distance);
      const pulse = 0.5 + 0.5 * Math.sin(f.actionFrame * 0.4 + k);
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.fillStyle = rgba(l.colors[2], 0.35);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, 12, 3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(l.energy, 0.6 + 0.4 * pulse);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, 8 + pulse * 5, 2 + pulse * 1.2, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (shape === 'strike' && move.strike && f.actionFrame <= move.startup) {
    // A reticle on the opponent: it follows until it locks (12 frames before the strike), then holds and flashes.
    const foe = round.fighters[f.id === 0 ? 1 : 0];
    const locked = f.target !== null;
    const x = sx(locked ? f.target! : foe.x);
    const progress = f.actionFrame / move.startup;
    const halfWidth = move.strike.halfWidth / PX;
    const color = locked ? (f.actionFrame % 4 < 2 ? '#ffffff' : l.energy) : rgba(l.energy, 0.75);
    ctx.save();
    if (layer === 'floor') {
      // A shadow on the floor (and, once locked, a faint column where it will hit).
      ctx.fillStyle = rgba(type === 'ghost' ? '#12051f' : l.colors[2], locked ? 0.55 : 0.3);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y, halfWidth * (0.6 + 0.4 * progress), 4, 0, 0, TAU);
      ctx.fill();
      if (locked) {
        const column = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        column.addColorStop(0, rgba(l.energy, 0));
        column.addColorStop(1, rgba(l.energy, 0.22));
        ctx.fillStyle = column;
        ctx.fillRect(x - halfWidth, 0, halfWidth * 2, FLOOR_Y);
      }
      ctx.restore();
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = locked ? 2.2 : 1.4;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 2;
    const r = locked ? 15 : 22 - progress * 6;
    const cy = FLOOR_Y - BODY_HEIGHT / SUB / 2;
    const turn = locked ? 0 : f.actionFrame * 0.08;
    for (let k = 0; k < 4; k++) {
      const a = turn + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(x, cy, r, a + 0.25, a + Math.PI / 2 - 0.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - r - 4, cy);
    ctx.lineTo(x - r + 4, cy);
    ctx.moveTo(x + r - 4, cy);
    ctx.lineTo(x + r + 4, cy);
    ctx.moveTo(x, cy - r - 4);
    ctx.lineTo(x, cy - r + 4);
    ctx.moveTo(x, cy + r - 4);
    ctx.lineTo(x, cy + r + 4);
    ctx.stroke();
    ctx.restore();
  }
}

// ── The attack itself: beams, storms, bursts, strikes ─────────────────────────────────────────────────────────────

/** A big special that hits with a box (solar, blizzard, burst, strike), on its active frames and fading after. */
export function drawBigAttack(ctx: Ctx, f: Fighter) {
  if (f.action !== 'big') return;
  const { shape, type } = f.loadout.big;
  const move = BIG[shape];
  const into = f.actionFrame - move.startup; // 1 on the first active frame
  if (into < 1) return;
  const active = into <= move.active;
  const fade = active ? 1 : Math.max(0, 1 - (into - move.active) / 10);
  if (fade <= 0) return;
  ctx.save();
  switch (shape) {
    case 'solar':
      drawSolar(ctx, f, into, fade);
      break;
    case 'blizzard':
      drawBlizzard(ctx, f, into, fade);
      break;
    case 'burst':
      drawBurst(ctx, f, into, fade);
      break;
    case 'strike':
      if (f.target !== null) drawStrike(ctx, type, sx(f.target), into, active, fade, move.strike!.halfWidth / PX);
      break;
  }
  ctx.restore();
}

/** Grass: a huge beam from the floor up, a sun flaring at its source. */
function drawSolar(ctx: Ctx, f: Fighter, into: number, fade: number) {
  const box = BIG.solar.hitbox!;
  const near = sx(f.x + f.facing * box.x1);
  const far = sx(f.x + f.facing * box.x2);
  const top = sy(f.y + box.y2);
  const bottom = sy(f.y + box.y1);
  const grow = 1;
  const mid = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  ctx.globalAlpha = fade;
  drawBeamLook(ctx, f.loadout.big.type, near, far, mid - half, mid + half, into, 0.92 + 0.08 * Math.sin(into));
  // A golden core and a sun at the source.
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createLinearGradient(0, mid - half * 0.4, 0, mid + half * 0.4);
  core.addColorStop(0, 'rgba(255,240,150,0)');
  core.addColorStop(0.5, 'rgba(255,240,150,0.55)');
  core.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = core;
  ctx.fillRect(Math.min(near, far), mid - half * 0.4, Math.abs(far - near), half * 0.8);
  glow(ctx, near, mid, 30 * grow + 6, '#fff3a0', 0.9);
  ctx.strokeStyle = 'rgba(255,245,180,0.8)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + into * 0.05;
    ctx.beginPath();
    ctx.moveTo(near + Math.cos(a) * 12, mid + Math.sin(a) * 12);
    ctx.lineTo(near + Math.cos(a) * (24 + 6 * Math.sin(into + k)), mid + Math.sin(a) * (24 + 6 * Math.sin(into + k)));
    ctx.stroke();
  }
}

/** Ice: a storm over the area in front: an icy haze, snow driving forward, shards. */
function drawBlizzard(ctx: Ctx, f: Fighter, into: number, fade: number) {
  const l = elementLook(f.loadout.big.type);
  const [light, main] = l.colors;
  const box = BIG.blizzard.hitbox!;
  const x0 = sx(f.x);
  const length = (box.x2 - box.x1) / PX;
  const height = (box.y2 - box.y1) / PX;
  const reach = 1;
  ctx.translate(x0, sy(f.y));
  ctx.scale(f.facing, 1);
  ctx.globalAlpha = fade;
  const haze = ctx.createLinearGradient(0, 0, length, 0);
  haze.addColorStop(0, rgba(light, 0.75));
  haze.addColorStop(0.6, rgba(main, 0.45));
  haze.addColorStop(1, rgba(main, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(length * 0.5 * reach, -height * 1.15, length * reach, -height * 0.9);
  ctx.lineTo(length * reach, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // Snow driving forward.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  for (let k = 0; k < 40; k++) {
    const x = ((hash(k, 1) * length + into * (6 + hash(k, 2) * 6)) % length) * reach;
    const y = -hash(k, 3) * height;
    ctx.lineWidth = 0.8 + hash(k, 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + hash(k, 5) * 4, y + 1.5);
    ctx.stroke();
  }
  for (let k = 0; k < 6; k++) {
    twinkle(ctx, ((hash(k, 7) * length + into * 3) % length) * reach, -hash(k, 8) * height, 2.2, '#ffffff');
  }
}

/** Psychic, Dark, Fairy: a dome of energy all around the attacker. */
function drawBurst(ctx: Ctx, f: Fighter, into: number, fade: number) {
  const l = elementLook(f.loadout.big.type);
  const [light, main, deep] = l.colors;
  const radius = BIG.burst.hitbox!.x2 / PX;
  // A flash wave runs out to the edge on the first frames.
  const wave = Math.min(1, into / 4);
  const x = sx(f.x);
  const floor = sy(f.y);
  ctx.globalAlpha = fade;
  const dome = ctx.createRadialGradient(x, floor, radius * 0.2, x, floor, radius);
  if (l.dark) {
    dome.addColorStop(0, rgba(deep, 0.2));
    dome.addColorStop(0.75, rgba(deep, 0.7));
    dome.addColorStop(1, rgba(main, 0.95));
  } else {
    dome.addColorStop(0, rgba(light, 0.15));
    dome.addColorStop(0.7, rgba(main, 0.45));
    dome.addColorStop(1, rgba(light, 0.9));
  }
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(x, floor, radius, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = l.dark ? l.energy : '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, floor, radius, Math.PI, TAU);
  ctx.stroke();
  if (wave < 1) {
    ctx.strokeStyle = rgba('#ffffff', 1 - wave);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, floor, radius * (0.3 + 0.7 * wave), Math.PI, TAU);
    ctx.stroke();
  }
  // Ripples inside.
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const phase = ((into + k * 3) % 9) / 9;
    ctx.strokeStyle = rgba(l.dark ? l.energy : light, 0.8 * (1 - phase));
    ctx.beginPath();
    ctx.arc(x, floor, radius * phase, Math.PI, TAU);
    ctx.stroke();
  }
  // A glow where it meets the floor.
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(x, floor, 0, x, floor, radius);
  rim.addColorStop(0.8, rgba(l.energy, 0));
  rim.addColorStop(1, rgba(l.energy, 0.5));
  ctx.fillStyle = rim;
  ctx.fillRect(x - radius, floor - 6, radius * 2, 6);
}

/** Electric: a thunderbolt from the sky; Ghost: shadows clawing up from the floor. On the locked spot. */
function drawStrike(
  ctx: Ctx,
  type: string | null,
  x: number,
  into: number,
  active: boolean,
  fade: number,
  halfWidth: number,
) {
  const l = elementLook(type);
  const [light, main, deep] = l.colors;
  ctx.globalAlpha = fade;
  if (type === 'ghost') {
    // Shadow flames rising from a pool on the floor, each with a purple glow around it.
    const height = 120;
    const flames = Array.from({ length: 7 }, (_, k) => ({
      x: x + (k - 3) * (halfWidth / 3.2),
      length: height * (0.5 + 0.5 * Math.sin(((k + 0.5) / 7) * Math.PI)) * (0.85 + 0.15 * Math.sin(into * 0.7 + k)),
      bend: Math.sin(into * 0.45 + k * 1.3) * 5,
      lean: (k - 3) * 0.06,
    }));
    ctx.fillStyle = rgba('#05000c', 0.85);
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y, halfWidth * 1.5, 5, 0, 0, TAU);
    ctx.fill();
    const flame = (f: (typeof flames)[number], width: number, color: string) => {
      ctx.save();
      ctx.translate(f.x, FLOOR_Y);
      ctx.rotate(Math.PI / 2 + f.lean); // a tongue trails towards -x: turned a quarter, it rises
      tongue(ctx, f.length, width, f.bend, color);
      ctx.restore();
    };
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flames) flame(f, 7, rgba(l.energy, 0.45));
    ctx.globalCompositeOperation = 'source-over';
    for (const [k, f] of flames.entries()) flame(f, 4.5, rgba(k % 2 ? deep : '#1a0b2e', 0.95));
    for (const f of flames) flame({ ...f, length: f.length * 0.55 }, 2, rgba(main, 0.9));
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, FLOOR_Y - 4, halfWidth * 1.8, l.energy, 0.55);
    return;
  }
  // Thunder: a wide glow, the bolt (struck again every other frame), branches, a flash on the floor.
  ctx.globalCompositeOperation = 'lighter';
  const shaft = ctx.createLinearGradient(x - halfWidth * 2, 0, x + halfWidth * 2, 0);
  shaft.addColorStop(0, rgba(main, 0));
  shaft.addColorStop(0.5, rgba(main, active ? 0.55 : 0.25));
  shaft.addColorStop(1, rgba(main, 0));
  ctx.fillStyle = shaft;
  ctx.fillRect(x - halfWidth * 2, 0, halfWidth * 4, FLOOR_Y);
  if (active) {
    const turn = Math.floor(into / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color] of [
      [7, rgba(deep, 0.7)],
      [4, main],
      [1.6, '#ffffff'],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      jagged(ctx, x + (hash(turn, 1) - 0.5) * 20, 0, x, FLOOR_Y, 12, halfWidth * 0.8, turn * 17);
    }
    ctx.strokeStyle = rgba(light, 0.9);
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const y = FLOOR_Y * (0.2 + k * 0.18);
      jagged(ctx, x, y, x + (hash(turn, k) - 0.5) * 60, y + 20 + hash(turn, k + 5) * 20, 4, 5, turn * 7 + k);
    }
  }
  glow(ctx, x, FLOOR_Y - 6, halfWidth * 2.6, l.energy, active ? 0.95 : 0.5);
  glow(ctx, x, FLOOR_Y - 6, halfWidth, '#ffffff', active ? 0.9 : 0.3);
}
