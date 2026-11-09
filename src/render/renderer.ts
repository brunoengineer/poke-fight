// Draws the fight. It only reads the state and never changes it.
//
// Layers, back to front: the place (render/stage.ts) → the trainers at the edges → dust and shadows → the Pokémon
// (sprites posed by code, or a stand-in rectangle while a sprite loads) → projectiles and beams → particles
// (render/fx.ts) → the HUD → banners, "Super effective!", the entrance's Poké Balls and "FIGHT!", K.O. → debug (F1).

import { activeHitbox, bodyBox, currentMove, isGuarding, isInvincible, movePhase, projectileBox, type WorldBox } from '../fight/boxes';
import type { BattleEvent } from '../fight/battle';
import { ELEMENTAL_COST, PP_MAX, ROUND_FRAMES, SUB } from '../fight/constants';
import { Button, has, type InputMask } from '../fight/input';
import type { FightEvent, Fighter, FightState } from '../fight/state';
import { displayHp } from '../game/pokemon';
import { t, type MessageKey } from '../i18n';
import { ENTRANCE } from '../screens/entrance';
import { EFFECT_FRAMES, type SandboxView } from '../screens/sandbox';
import { PIXEL_FONT, TYPE_COLORS, typeColor } from './colors';
import { createFx } from './fx';
import { VIEW_H, VIEW_W } from './screen';
import { getSprite, type Sprite } from './sprites';
import { drawStage, FLOOR_Y, type StageSpec } from './stage';
import { drawBall, drawTrainer, handOf } from './trainers';

export { FLOOR_Y, TYPE_COLORS };

const sx = (x: number) => Math.round(x / SUB);
const sy = (y: number) => FLOOR_Y - Math.round(y / SUB);
const font = (size: number, weight = 'bold') => `${weight} ${size}px ${PIXEL_FONT}`;

export interface Renderer {
  draw(view: SandboxView): void;
  /** After each simulated frame: effects follow the fight. */
  onTick(view: SandboxView, events: readonly BattleEvent[]): void;
  /** The place with nobody in it: behind the title, the story and the menus. */
  backdrop(stage: StageSpec): void;
  reset(): void;
}

export function createRenderer(ctx: CanvasRenderingContext2D): Renderer {
  const fx = createFx();
  /** Ambient animation (clouds, lights…) runs on real time, so it also moves while menus are open. */
  const ambient = () => Math.floor(performance.now() / (1000 / 60));

  return {
    draw(view) {
      const { round } = view.battle;
      ctx.imageSmoothingEnabled = false;
      ctx.textBaseline = 'top';
      const shake = fx.shake();
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawStage(ctx, view.stage, ambient());
      drawTrainers(ctx, view);
      fx.drawBack(ctx);
      for (const f of round.fighters) drawShadow(ctx, f, view);
      for (const f of round.fighters) drawFighter(ctx, f, view);
      drawProjectiles(ctx, round, ambient());
      fx.drawFront(ctx);
      drawEntranceBalls(ctx, view);
      ctx.restore();
      drawHud(ctx, view, fx.trail);
      drawBanner(ctx, view);
      drawEffect(ctx, view);
      drawFightText(ctx, view);
      if (view.debug) drawDebug(ctx, view);
      if (view.flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * view.flash) / 8})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      drawPhase(ctx, view);
    },
    onTick(view, events) {
      const fightEvents = events.filter((e): e is FightEvent => e.type !== 'roundStart' && e.type !== 'battleOver');
      fx.onTick(view.battle.round, fightEvents);
    },
    backdrop(stage) {
      ctx.imageSmoothingEnabled = false;
      drawStage(ctx, stage, ambient());
      // A soft veil, so the menus read well over it.
      ctx.fillStyle = 'rgba(8, 10, 24, 0.35)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    },
    reset() {
      fx.reset();
    },
  };
}

// ── Small drawing helpers ─────────────────────────────────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text with a dark outline (readable over any background). */
function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string | CanvasGradient, outline = 'rgba(10,10,25,0.9)', width = 3) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function fillBox(ctx: CanvasRenderingContext2D, b: WorldBox) {
  ctx.fillRect(sx(b.x1), sy(b.y2), sx(b.x2) - sx(b.x1), sy(b.y1) - sy(b.y2));
}

function strokeBox(ctx: CanvasRenderingContext2D, b: WorldBox) {
  ctx.strokeRect(sx(b.x1) + 0.5, sy(b.y2) + 0.5, sx(b.x2) - sx(b.x1) - 1, sy(b.y1) - sy(b.y2) - 1);
}

// ── Trainers and the entrance ─────────────────────────────────────────────────────────────────────────────────

/** How a fighter looks during the entrance: hidden until its ball bursts, then growing out of the light. */
function entranceLook(view: SandboxView, f: Fighter) {
  const entrance = view.entrance;
  const none = { hidden: false, scale: 1, glow: 0, dx: 0, dy: 0 };
  if (!entrance || !entrance.sides[f.id]) return none;
  const frame = entrance.frame;
  if (view.trainers[f.id]) {
    if (frame < ENTRANCE.burst) return { ...none, hidden: true };
    if (frame >= ENTRANCE.grown) return none;
    const p = (frame - ENTRANCE.burst) / (ENTRANCE.grown - ENTRANCE.burst);
    const eased = 1 - (1 - p) ** 3;
    return { ...none, scale: 0.15 + 0.85 * eased, glow: 1 - p };
  }
  // A wild Pokémon leaps in from its side of the screen.
  if (frame < ENTRANCE.throwStart) return { ...none, hidden: true };
  if (frame >= ENTRANCE.burst) return none;
  const p = (frame - ENTRANCE.throwStart) / (ENTRANCE.burst - ENTRANCE.throwStart);
  return { ...none, dx: (1 - p) * (f.id === 1 ? 160 : -160), dy: -Math.sin(p * Math.PI) * 36 };
}

function drawTrainers(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const frame = view.entrance?.frame ?? Infinity;
  view.trainers.forEach((look, side) => {
    if (!look) return;
    const throwing = view.entrance?.sides[side] && frame >= ENTRANCE.throwStart - 6 && frame < ENTRANCE.throwStart + 8 ? 1 : 0;
    drawTrainer(ctx, side as 0 | 1, look, throwing);
  });
}

function drawEntranceBalls(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const entrance = view.entrance;
  if (!entrance) return;
  const frame = entrance.frame;
  for (const f of view.battle.round.fighters) {
    if (!entrance.sides[f.id] || !view.trainers[f.id]) continue;
    const target = { x: sx(f.x), y: FLOOR_Y - 18 };
    if (frame >= ENTRANCE.throwStart && frame < ENTRANCE.burst) {
      const p = (frame - ENTRANCE.throwStart) / (ENTRANCE.burst - ENTRANCE.throwStart);
      const hand = handOf(f.id);
      const x = hand.x + (target.x - hand.x) * p;
      const y = hand.y + (target.y - hand.y) * p - Math.sin(p * Math.PI) * 60;
      drawBall(ctx, x, y, frame * 0.45 * (f.id === 0 ? 1 : -1), 5);
    } else if (frame >= ENTRANCE.burst && frame < ENTRANCE.burst + 12) {
      // The ball bursts open: a flash of light and a ring.
      const p = (frame - ENTRANCE.burst) / 12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 10 + p * 40);
      glow.addColorStop(0, `rgba(255,255,255,${1 - p})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(target.x - 60, target.y - 60, 120, 120);
      ctx.strokeStyle = `rgba(255,220,240,${1 - p})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6 + p * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawFightText(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const entrance = view.entrance;
  if (!entrance?.first || entrance.frame < ENTRANCE.fightText) return;
  const p = (entrance.frame - ENTRANCE.fightText) / (ENTRANCE.total - ENTRANCE.fightText);
  const scale = p < 0.25 ? 0.6 + (p / 0.25) * 0.6 : 1.2 - Math.min(0.2, (p - 0.25) * 0.4);
  ctx.save();
  ctx.translate(VIEW_W / 2, 112);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(34);
  const gradient = ctx.createLinearGradient(0, -16, 0, 16);
  gradient.addColorStop(0, '#fff6c8');
  gradient.addColorStop(0.5, '#ffd25e');
  gradient.addColorStop(1, '#ff8a3d');
  ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
  outlined(ctx, t('fight.start'), 0, 0, gradient, '#2a0f3a', 5);
  ctx.restore();
}

// ── Fighters ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A shadow on the floor, so jumps read clearly. */
function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter, view: SandboxView) {
  const look = entranceLook(view, f);
  if (look.hidden) return;
  const width = Math.max(10, 30 - Math.round((f.y / SUB - look.dy) / 6)) * look.scale;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(sx(f.x) + look.dx, FLOOR_Y + 1, width / 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

const spriteOf = (f: Fighter) => (f.speciesId !== null ? getSprite(f.speciesId) : null);

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, view: SandboxView) {
  const look = entranceLook(view, f);
  if (look.hidden) return;
  ctx.save();
  if (look.dx || look.dy || look.scale !== 1) {
    // Grow (or leap) around the fighter's feet.
    ctx.translate(sx(f.x) + look.dx, sy(f.y) + look.dy);
    ctx.scale(look.scale, look.scale);
    ctx.translate(-sx(f.x), -sy(f.y));
  }
  if (look.glow > 0) ctx.filter = `brightness(${1 + look.glow * 5})`;
  const sprite = spriteOf(f);
  if (sprite) drawPokemon(ctx, f, sprite);
  else drawPlaceholder(ctx, f);
  ctx.restore();
  if (!view.entrance) drawMoveEffects(ctx, f, sprite !== null);
}

/**
 * The sprite, posed by code. Front sprites look to the screen's left, so a Pokémon facing right is mirrored.
 * All movement comes from the fight state (frames), never from real time.
 */
function drawPokemon(ctx: CanvasRenderingContext2D, f: Fighter, sprite: Sprite) {
  const move = currentMove(f);
  const phase = move ? movePhase(move, f.actionFrame) : null;
  let [dx, dy, scaleX, scaleY, angle, alpha] = [0, 0, 1, 1, 0, 1];
  const bob = (period: number) => Math.round(1 - Math.cos((f.actionFrame / period) * Math.PI * 2));

  switch (f.action) {
    case 'idle':
    case 'guard':
      dy = -bob(60);
      scaleY = 1 + 0.02 * Math.sin((f.actionFrame / 60) * Math.PI * 2);
      break;
    case 'walkForward':
    case 'walkBack':
      dy = -bob(16);
      break;
    case 'prejump':
    case 'land':
      [scaleX, scaleY] = [1.14, 0.84];
      break;
    case 'jump':
      if (f.vy > 0) [scaleX, scaleY] = [0.92, 1.1];
      break;
    case 'attack':
    case 'airAttack':
      // Wind up, then lunge forward.
      dx = f.facing * (phase === 'startup' ? -3 : phase === 'active' ? 7 : 2);
      angle = f.facing * (phase === 'active' ? 0.14 : phase === 'startup' ? -0.05 : 0);
      break;
    case 'elemental':
    case 'big':
      if (phase === 'startup') dx = f.actionFrame % 2 === 0 ? 1 : -1; // trembling while charging
      if (phase === 'active') dx = f.facing * 3;
      break;
    case 'dash':
    case 'backdash':
      angle = f.facing * (f.action === 'dash' ? 0.18 : -0.15);
      scaleX = 1.08;
      break;
    case 'hitstun':
    case 'blockstun':
      dx = f.actionFrame <= 6 ? (f.actionFrame % 2 === 0 ? 2 : -2) : 0;
      angle = f.action === 'hitstun' ? -f.facing * 0.12 : 0;
      break;
    case 'airHitstun':
      angle = -f.facing * 0.6;
      break;
    case 'ko':
      angle = -f.facing * (f.y === 0 ? Math.PI / 2 : 0.8);
      alpha = 0.75;
      break;
    default:
      break;
  }
  if (isInvincible(f) && f.action !== 'ko') alpha = 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx(f.x) + dx, sy(f.y) + dy);
  ctx.rotate(angle);
  ctx.scale(f.facing === 1 ? -scaleX : scaleX, scaleY);
  const justHit = (f.action === 'hitstun' || f.action === 'airHitstun') && f.actionFrame <= 3;
  if (justHit) ctx.filter = 'brightness(0) invert(1)'; // a white flash
  // Lying down (rotated a quarter turn), the sprite is lifted so it rests on the floor.
  const lying = f.action === 'ko' && f.y === 0;
  ctx.drawImage(sprite.image, -sprite.width / 2, lying ? -sprite.width / 2 - sprite.height / 2 : -sprite.height);
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, f: Fighter) {
  ctx.save();
  if (f.action === 'ko' && f.y === 0) {
    ctx.fillStyle = '#6b6f7a';
    ctx.fillRect(Math.min(VIEW_W - 48, Math.max(0, sx(f.x) - 24)), FLOOR_Y - 14, 48, 14);
    ctx.restore();
    return;
  }
  if (isInvincible(f)) ctx.globalAlpha = 0.5;
  const justHit = (f.action === 'hitstun' || f.action === 'airHitstun') && f.actionFrame <= 3;
  ctx.fillStyle = f.action === 'ko' ? '#6b6f7a' : justHit ? '#ffffff' : typeColor(f.types[0]);
  fillBox(ctx, bodyBox(f));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx(f.x) + f.facing * 8 - 2, sy(f.y) - 40, 4, 4);
  ctx.restore();
}

/** Charge glows, beams, the placeholder's attack "limb", the rush's trail and the guard shield. */
function drawMoveEffects(ctx: CanvasRenderingContext2D, f: Fighter, hasSprite: boolean) {
  if (f.action === 'ko') return;
  ctx.save();
  const move = currentMove(f);
  const phase = move ? movePhase(move, f.actionFrame) : null;
  const charging = (f.action === 'elemental' || f.action === 'big') && phase === 'startup';

  if (f.action === 'big' && move?.rush && phase === 'active') {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = typeColor(f.loadout.big.type);
    const body = bodyBox(f);
    for (const back of [30, 18, 8]) fillBox(ctx, { ...body, x1: body.x1 - f.facing * back * SUB, x2: body.x2 - f.facing * back * SUB });
    ctx.globalAlpha = 1;
  }

  if (charging && move) {
    const slot = f.action === 'big' ? 'big' : 'elemental';
    const progress = f.actionFrame / move.startup;
    const radius = (slot === 'big' ? 16 : 8) * progress + 2;
    const x = sx(f.x) + f.facing * 22;
    const y = sy(f.y) - 26;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.35, typeColor(f.loadout[slot].type));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.globalAlpha = f.actionFrame % 4 < 2 ? 1 : 0.75;
    ctx.fillRect(x - radius * 2, y - radius * 2, radius * 4, radius * 4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  const hitbox = activeHitbox(f);
  const slot = f.action === 'big' ? 'big' : f.action === 'elemental' ? 'elemental' : null;
  if (hitbox && slot && f.loadout[slot].shape === 'beam') {
    const color = typeColor(f.loadout[slot].type);
    const top = sy(hitbox.y2);
    const height = sy(hitbox.y1) - top;
    const left = sx(hitbox.x1);
    const width = sx(hitbox.x2) - left;
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, top, 0, top + height);
    beam.addColorStop(0, 'rgba(0,0,0,0)');
    beam.addColorStop(0.5, color);
    beam.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beam;
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(f.actionFrame);
    ctx.fillRect(left, top - 3, width, height + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, top + height / 2 - 1, width, 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  } else if (hitbox && !hasSprite) {
    ctx.fillStyle = slot ? typeColor(f.loadout[slot].type) : '#ffffff';
    ctx.globalAlpha = 0.6;
    fillBox(ctx, hitbox);
    ctx.globalAlpha = 1;
  }

  if (isGuarding(f)) {
    // A shimmering shield in front.
    const x = sx(f.x) + f.facing * 18;
    const y = sy(f.y) - 24;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(127,224,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - f.facing * 14, y, 26, -0.9, 0.9, f.facing === -1);
    if (f.facing === -1) {
      ctx.beginPath();
      ctx.arc(x + 14, y, 26, Math.PI - 0.9, Math.PI + 0.9);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(127,224,255,0.12)';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, round: FightState, frame: number) {
  ctx.save();
  for (const p of round.projectiles) {
    const b = projectileBox(p);
    const cx = (sx(b.x1) + sx(b.x2)) / 2;
    const cy = (sy(b.y1) + sy(b.y2)) / 2;
    const radius = Math.max(4, (sy(b.y1) - sy(b.y2)) / 2);
    const color = typeColor(p.attack.type ?? 'normal');
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.2);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.3, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (p.slot === 'big') {
      // A big projectile has a spinning ring.
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.3, radius * 0.5, frame / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Texts over the fight ──────────────────────────────────────────────────────────────────────────────────────

/** "Super effective!" and friends, popping up above the Pokémon that was hit. */
function drawEffect(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { effect } = view;
  if (!effect) return;
  const f = view.battle.round.fighters[effect.fighter];
  const age = EFFECT_FRAMES - effect.frames;
  const rise = Math.round(age / 3);
  const pop = age < 8 ? 1 + 0.5 * (1 - age / 8) : 1;
  ctx.save();
  ctx.translate(Math.min(VIEW_W - 70, Math.max(70, sx(f.x))), sy(f.y) - 84 - rise);
  ctx.scale(pop, pop);
  ctx.font = font(13);
  ctx.textAlign = 'center';
  ctx.globalAlpha = Math.min(1, effect.frames / 10);
  const fill = effect.text === 'effect.super' ? '#ffd25e' : effect.text === 'effect.none' ? '#d0d4e0' : '#9ad0ff';
  outlined(ctx, t(effect.text), 0, 0, fill);
  ctx.restore();
}

/** The tutorial's instruction or a battle's intro, under the HUD. */
function drawBanner(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { banner } = view;
  // The choose menu takes the middle of the screen.
  if (!banner || view.battle.phase === 'choose') return;
  const text = t(banner.key, banner.params);
  ctx.save();
  ctx.font = font(10);
  const width = Math.min(VIEW_W - 20, Math.ceil(ctx.measureText(text).width) + 30);
  const height = banner.step ? 30 : 20;
  const left = (VIEW_W - width) / 2;
  const top = 50;
  roundRect(ctx, left, top, width, height, 6);
  const fill = ctx.createLinearGradient(left, 0, left + width, 0);
  fill.addColorStop(0, 'rgba(40,24,80,0.92)');
  fill.addColorStop(1, 'rgba(18,22,52,0.92)');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,94,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  let y = top + 5;
  if (banner.step) {
    ctx.font = font(8, 'normal');
    ctx.fillStyle = '#b9c0e0';
    ctx.fillText(t('tutorial.step', { step: banner.step.number, total: banner.step.total }), VIEW_W / 2, y);
    y += 11;
    ctx.font = font(10);
  }
  ctx.fillStyle = '#ffd25e';
  ctx.fillText(text, VIEW_W / 2, y);
  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function drawHud(ctx: CanvasRenderingContext2D, view: SandboxView, trail: (id: 0 | 1, hp: number) => number) {
  const { battle } = view;
  const width = 200;
  for (const f of battle.round.fighters) {
    const mirror = f.id === 1;
    const left = mirror ? VIEW_W - 8 - width : 8;
    ctx.save();
    // The panel.
    roundRect(ctx, left, 5, width, 40, 7);
    const panel = ctx.createLinearGradient(0, 5, 0, 45);
    panel.addColorStop(0, 'rgba(22,26,58,0.82)');
    panel.addColorStop(1, 'rgba(10,12,30,0.82)');
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,175,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Name and level.
    ctx.font = font(10);
    ctx.textAlign = mirror ? 'right' : 'left';
    const nameX = mirror ? left + width - 8 : left + 8;
    outlined(ctx, f.name, nameX, 9, '#ffffff', 'rgba(0,0,0,0.5)', 2);
    ctx.font = font(8, 'normal');
    ctx.textAlign = mirror ? 'left' : 'right';
    ctx.fillStyle = '#b9c0e0';
    ctx.fillText(t('hud.level', { level: f.level }), mirror ? left + 8 : left + width - 8, 10);

    // Type badges, after the name.
    ctx.font = font(8, 'normal');
    const nameWidth = (() => {
      ctx.font = font(10);
      const w = ctx.measureText(f.name).width;
      ctx.font = font(6);
      return w;
    })();
    let badgeX = mirror ? nameX - nameWidth - 6 : nameX + nameWidth + 6;
    for (const type of f.types) {
      const label = t(`type.${type}` as MessageKey).toUpperCase();
      const w = ctx.measureText(label).width + 6;
      const x = mirror ? badgeX - w : badgeX;
      roundRect(ctx, x, 10, w, 8, 3);
      ctx.fillStyle = typeColor(type);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 3, 11);
      badgeX = mirror ? x - 3 : x + w + 3;
    }

    // HP: a draining "damage trail" behind the bar; it empties from the center side.
    const barX = left + 8;
    const barW = width - 16;
    const ratio = f.hp / f.maxHp;
    const trailRatio = trail(f.id, f.hp) / f.maxHp;
    roundRect(ctx, barX, 22, barW, 8, 3);
    ctx.fillStyle = 'rgba(40,12,24,0.9)';
    ctx.fill();
    const fill = (r: number) => Math.round(barW * r);
    const at = (w: number) => (mirror ? barX + barW - w : barX);
    ctx.fillStyle = 'rgba(255,240,240,0.9)';
    ctx.fillRect(at(fill(trailRatio)), 23, fill(trailRatio), 6);
    const hp = ctx.createLinearGradient(0, 22, 0, 30);
    const [top, bottom] = ratio > 0.5 ? ['#7dffb0', '#24b864'] : ratio > 0.2 ? ['#ffe27a', '#e09a2a'] : ['#ff8a8a', '#c82a3e'];
    hp.addColorStop(0, top);
    hp.addColorStop(1, bottom);
    ctx.fillStyle = hp;
    ctx.fillRect(at(fill(ratio)), 23, fill(ratio), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(at(fill(ratio)), 23, fill(ratio), 1);

    // PP: marks every ¼ (one elemental special); glowing purple when full (the big special is ready).
    const ppW = 112;
    const ppX = mirror ? barX + barW - ppW : barX;
    const ppFill = Math.round((ppW * f.pp) / PP_MAX);
    roundRect(ctx, ppX, 33, ppW, 5, 2);
    ctx.fillStyle = 'rgba(16,22,52,0.95)';
    ctx.fill();
    const full = f.pp >= PP_MAX;
    const pp = ctx.createLinearGradient(ppX, 0, ppX + ppW, 0);
    pp.addColorStop(0, full ? '#e0a0ff' : '#4fc3ff');
    pp.addColorStop(1, full ? '#a46bff' : '#6c8cff');
    ctx.fillStyle = pp;
    if (full) {
      ctx.shadowColor = '#c38bff';
      ctx.shadowBlur = 6 + 3 * Math.sin(performance.now() / 120);
    }
    ctx.fillRect(mirror ? ppX + ppW - ppFill : ppX, 34, ppFill, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10,12,30,0.9)';
    for (let mark = ELEMENTAL_COST; mark < PP_MAX; mark += ELEMENTAL_COST) ctx.fillRect(ppX + Math.round((ppW * mark) / PP_MAX), 33, 1, 5);

    // The team: a little Poké Ball each (grey when fainted, a gold ring on the one fighting).
    battle.teams[f.id].forEach((member, i) => {
      const x = mirror ? left + 12 + i * 10 : left + width - 12 - i * 10;
      const y = 36;
      if (member.hp > 0) drawBall(ctx, x, y, 0, 3.2);
      else {
        ctx.fillStyle = '#4a4e62';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (i === battle.active[f.id]) {
        ctx.strokeStyle = '#ffd25e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 4.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  // Player 1's switch: ready (with its key), or used until a Pokémon faints.
  if (view.switching && battle.phase === 'fight' && battle.teams[0].filter(m => m.hp > 0).length > 1) {
    const ready = battle.switchReady;
    const text = t(ready ? 'hud.switch' : 'hud.switchUsed');
    ctx.save();
    ctx.font = font(8);
    const w = Math.ceil(ctx.measureText(text).width) + 12;
    roundRect(ctx, 8, 48, w, 12, 4);
    ctx.fillStyle = ready ? 'rgba(108,140,255,0.85)' : 'rgba(20,22,48,0.7)';
    ctx.fill();
    ctx.fillStyle = ready ? '#ffffff' : '#7e86ab';
    ctx.textAlign = 'left';
    ctx.fillText(text, 14, 50);
    ctx.restore();
  }

  // The timer.
  const seconds = Math.ceil(battle.round.timer / 60);
  const hurry = battle.round.timer < 10 * 60 && battle.round.timer < ROUND_FRAMES;
  ctx.save();
  roundRect(ctx, VIEW_W / 2 - 16, 6, 32, 22, 6);
  const timer = ctx.createLinearGradient(0, 6, 0, 28);
  timer.addColorStop(0, hurry ? '#ff6b6b' : '#6c8cff');
  timer.addColorStop(1, hurry ? '#a8203a' : '#5a3ac0');
  ctx.fillStyle = timer;
  ctx.fill();
  ctx.font = font(15);
  ctx.textAlign = 'center';
  outlined(ctx, String(seconds).padStart(2, '0'), VIEW_W / 2, 9, '#ffffff', 'rgba(0,0,0,0.4)', 2);

  // In the demo: who plays player 2, and the controls.
  if (view.tools) {
    ctx.font = font(8, 'normal');
    ctx.fillStyle = '#c9cfe8';
    const p2 = view.opponent.startsWith('cpu-')
      ? t('hud.cpu', { difficulty: t(`difficulty.${view.opponent.slice(4)}` as MessageKey), style: t(`style.${view.style}` as MessageKey) })
      : t('hud.dummy', { mode: t(`dummy.${view.opponent}` as MessageKey) });
    ctx.fillText(`${p2}${view.infinitePp ? ` · ${t('hud.infinitePp')}` : ''}`, VIEW_W / 2, 31);
  }
  if (view.tools || view.banner?.step) {
    roundRect(ctx, 16, VIEW_H - 26, VIEW_W - 32, view.tools ? 22 : 12, 5);
    ctx.fillStyle = 'rgba(8,10,24,0.55)';
    ctx.fill();
    ctx.font = font(8, 'normal');
    ctx.fillStyle = '#d8dcf0';
    ctx.fillText(t('controls.fight'), VIEW_W / 2, VIEW_H - 24);
    if (view.tools) ctx.fillText(t('controls.sandbox'), VIEW_W / 2, VIEW_H - 14);
  }
  ctx.restore();
}

// ── Phases: KO, choosing the next Pokémon, battle over ───────────────────────────────────────────────────────────

function drawPhase(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { battle } = view;
  ctx.save();
  ctx.textAlign = 'center';
  if (battle.phase === 'ko') {
    const p = Math.min(1, battle.phaseFrame / 12);
    ctx.translate(VIEW_W / 2, 100);
    ctx.scale(2 - p, 2 - p);
    ctx.globalAlpha = p;
    ctx.font = font(36);
    ctx.textBaseline = 'middle';
    const gradient = ctx.createLinearGradient(0, -18, 0, 18);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#ff6fae');
    outlined(ctx, t(battle.round.timeOver ? 'fight.time' : 'fight.ko'), 0, 0, gradient, '#2a0f3a', 5);
  } else if (battle.phase === 'choose') {
    const team = battle.teams[0];
    const top = 70;
    const height = 40 + team.length * 16;
    const titles = { fainted: 'battle.choose', next: 'battle.next', switch: 'battle.switch' } as const;
    roundRect(ctx, VIEW_W / 2 - 120, top - 10, 240, height, 8);
    ctx.fillStyle = 'rgba(14,16,40,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,175,255,0.35)';
    ctx.stroke();
    ctx.font = font(10);
    ctx.fillStyle = '#ffd25e';
    ctx.fillText(t(titles[battle.chooseReason]), VIEW_W / 2, top - 4);
    team.forEach((member, i) => {
      const y = top + 14 + i * 16;
      const selected = i === battle.cursor;
      if (selected) {
        roundRect(ctx, VIEW_W / 2 - 110, y - 3, 220, 14, 4);
        ctx.fillStyle = 'rgba(108,140,255,0.35)';
        ctx.fill();
      }
      ctx.font = font(9, selected ? 'bold' : 'normal');
      ctx.fillStyle = member.hp === 0 ? '#6b6f7a' : selected ? '#ffffff' : '#b9c0e0';
      ctx.textAlign = 'left';
      const fighting = i === battle.active[0] && member.hp > 0;
      ctx.fillText(`${selected ? '▶ ' : '  '}${member.name}${fighting ? ` · ${t('battle.inBattle')}` : ''}`, VIEW_W / 2 - 104, y);
      ctx.textAlign = 'right';
      ctx.fillText(member.hp === 0 ? t('battle.fainted') : `${displayHp(member.hp)}/${displayHp(member.maxHp)}`, VIEW_W / 2 + 104, y);
    });
    ctx.textAlign = 'center';
    ctx.font = font(8, 'normal');
    ctx.fillStyle = '#9aa3c7';
    ctx.fillText(t(battle.chooseReason === 'switch' ? 'battle.switchKeys' : 'battle.chooseKeys'), VIEW_W / 2, top + 16 + team.length * 16);
  } else if (battle.phase === 'over') {
    // The results screen (DOM) shows over a dimmed fight.
    ctx.fillStyle = 'rgba(6, 8, 20, 0.5)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}

// ── Debug overlay (F1) ────────────────────────────────────────────────────────────────────────────────────────────

function drawDebug(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { round } = view.battle;
  ctx.save();
  ctx.lineWidth = 1;
  for (const f of round.fighters) {
    // No hurt box while invincible: that's how the back dash's invincible frames show up.
    if (!isInvincible(f)) {
      ctx.strokeStyle = '#4cd964';
      strokeBox(ctx, bodyBox(f));
    }
    const hitbox = activeHitbox(f);
    if (hitbox) {
      ctx.strokeStyle = '#ff3b30';
      strokeBox(ctx, hitbox);
    }
  }
  ctx.strokeStyle = '#ff3b30';
  for (const p of round.projectiles) strokeBox(ctx, projectileBox(p));

  ctx.font = '8px monospace';
  ctx.fillStyle = '#ffffff';
  round.fighters.forEach(f => {
    ctx.textAlign = f.id === 0 ? 'left' : 'right';
    const x = f.id === 0 ? 16 : VIEW_W - 16;
    ctx.fillText(describeAction(f), x, 50);
    ctx.fillText(`x ${(f.x / SUB).toFixed(1)} y ${(f.y / SUB).toFixed(1)} hp ${f.hp} combo ${f.combo}`, x, 60);
  });
  ctx.textAlign = 'center';
  ctx.fillText(`frame ${round.frame}${round.hitstop > 0 ? `  hitstop ${round.hitstop}` : ''}`, VIEW_W / 2, 40);
  if (view.advantage) {
    const { kind, value } = view.advantage;
    ctx.fillText(`on ${kind}: ${value > 0 ? '+' : ''}${value}`, VIEW_W / 2, 50);
  }
  if (view.cpu) ctx.fillText(`CPU ${view.cpu}`, VIEW_W / 2, 60);
  ctx.textAlign = 'left';
  view.history.forEach((entry, row) => {
    ctx.fillStyle = row === 0 ? '#ffffff' : '#9aa4c0';
    ctx.fillText(`${String(entry.frames).padStart(2)} ${describeInput(entry.mask)}`, 16, 74 + row * 10);
  });
  ctx.restore();
}

function describeAction(f: Fighter): string {
  const length = f.actionLength > 0 ? `/${f.actionLength}` : '';
  const move = currentMove(f);
  const phase = move ? ` ${movePhase(move, f.actionFrame)}` : '';
  return `${f.action} ${f.actionFrame}${length}${phase}`;
}

const ARROWS: Record<number, string> = {
  [Button.Up]: '↑',
  [Button.Down]: '↓',
  [Button.Left]: '←',
  [Button.Right]: '→',
  [Button.Up | Button.Left]: '↖',
  [Button.Up | Button.Right]: '↗',
  [Button.Down | Button.Left]: '↙',
  [Button.Down | Button.Right]: '↘',
};

export function describeInput(mask: InputMask): string {
  const directions = mask & (Button.Up | Button.Down | Button.Left | Button.Right);
  const buttons = [
    has(mask, Button.Physical) && 'J',
    has(mask, Button.Special) && 'K',
    has(mask, Button.Big) && 'I',
    has(mask, Button.Guard) && 'L',
    has(mask, Button.Dash) && 'Dash',
  ].filter(Boolean);
  return [ARROWS[directions] ?? '·', ...buttons].join(' ');
}
