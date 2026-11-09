// Draws the fight. It only reads the state and never changes it.
//
// Layers, back to front: the place (render/stage.ts) → the trainers at the edges → dust, a boss's ground warnings and
// shadows → the Pokémon (sprites posed by code, or a stand-in rectangle while a sprite loads) → projectiles and beams →
// a boss's attacks (render/boss.ts) → particles (render/fx.ts) → the HUD → banners (a boss attack's name), "Super
// effective!", the entrance's Poké Balls and "FIGHT!", K.O. → debug (F1).

import { activeHitbox, bodyBox, currentMove, isGuarding, isInvincible, movePhase, projectileBox, type WorldBox } from '../fight/boxes';
import type { BattleEvent } from '../fight/battle';
import { ELEMENTAL_COST, PP_MAX, ROUND_FRAMES, SUB } from '../fight/constants';
import { Button, has, type InputMask } from '../fight/input';
import type { Fighter, FightState } from '../fight/state';
import { displayHp } from '../game/pokemon';
import { t, type MessageKey } from '../i18n';
import { ENTRANCE } from '../screens/entrance';
import { EFFECT_FRAMES, isFightEvent, type SandboxView } from '../screens/sandbox';
import { BODY_FONT, DISPLAY_FONT, TYPE_COLORS, typeColor } from './colors';
import { backdropUrl } from '../data/art';
import { drawAmbience } from './ambience';
import { BOSS_BANNER_FRAMES, bossFlash, bossPose, drawBossBack, drawBossFront, skyFallShade } from './boss';
import { drawBeamLook, drawChargeLook, drawProjectileLook, elementLook } from './elements';
import { createFx } from './fx';
import { getImage } from './images';
import { VIEW_H, VIEW_W } from './screen';
import { getSprite, type Sprite } from './sprites';
import { drawStage, FLOOR_Y } from './stage';
import { drawBall, drawTrainer, handOf } from './trainers';

export { FLOOR_Y, TYPE_COLORS };

/**
 * Device pixels per art pixel for the frame being drawn (set by draw()). Positions snap to whole device pixels, so a
 * sprite moves smoothly and its pixels never land between two screen pixels (that's what made sprites flicker).
 */
let deviceScale = 1;
const snap = (value: number) => Math.round(value * deviceScale) / deviceScale;
const sx = (x: number) => snap(x / SUB);
const sy = (y: number) => FLOOR_Y - snap(y / SUB);
/** Titles and names: the menus' display font. Small labels: the menus' text font. Both drawn at full resolution. */
const font = (size: number, weight = 'bold') =>
  weight === 'normal' ? `600 ${size * 0.92}px ${BODY_FONT}` : `italic 800 ${size * 1.2}px ${DISPLAY_FONT}`;

export interface Renderer {
  /** `pad`: the player uses a controller (the switch menu shows Ⓐ / Ⓑ instead of keys). */
  draw(view: SandboxView, options?: { pad?: boolean }): void;
  /** After each simulated frame: effects follow the fight. */
  onTick(view: SandboxView, events: readonly BattleEvent[]): void;
  reset(): void;
}

export function createRenderer(ctx: CanvasRenderingContext2D): Renderer {
  const fx = createFx();
  /** Ambient animation (clouds, lights…) runs on real time, so it also moves while menus are open. */
  const ambient = () => Math.floor(performance.now() / (1000 / 60));

  return {
    draw(view, options = {}) {
      const { round } = view.battle;
      // Everything below is laid out in art pixels; the canvas holds a whole number of device pixels per art pixel.
      deviceScale = Math.max(1, Math.round(ctx.canvas.width / VIEW_W));
      ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.imageSmoothingEnabled = false;
      ctx.textBaseline = 'top';
      const shake = fx.shake();
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawStage(ctx, view.stage, ambient());
      drawSkyShade(ctx, skyFallShade(round));
      drawTrainers(ctx, view);
      fx.drawBack(ctx);
      drawBossBack(ctx, round);
      for (const f of round.fighters) drawShadow(ctx, f, view);
      for (const f of round.fighters) drawFighter(ctx, f, view);
      drawProjectiles(ctx, round, round.frame);
      drawBossFront(ctx, round);
      // Leaves, snow, embers… passing in front of the fighters, once the place's picture shows.
      if (view.stage.backdrop && getImage(backdropUrl(view.stage.backdrop))) drawAmbience(ctx, view.stage.backdrop, ambient(), 'front');
      fx.drawFront(ctx);
      drawEntranceBalls(ctx, view);
      ctx.restore();
      drawHud(ctx, view, fx.trail);
      drawBanner(ctx, view);
      drawBossBanner(ctx, view);
      drawEffect(ctx, view);
      drawFightText(ctx, view);
      if (view.debug) drawDebug(ctx, view);
      const flash = Math.max((0.55 * view.flash) / 8, bossFlash(round));
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      drawPhase(ctx, view, options.pad === true);
    },
    onTick(view, events) {
      const fightEvents = events.filter(isFightEvent);
      fx.onTick(view.battle.round, fightEvents);
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

/**
 * A soft shadow under each Pokémon. Its middle sits a little above the feet line, so the feet stand *in* it (a shadow
 * centered below the feet made grounded Pokémon look like they float); it shrinks and fades as they jump.
 */
function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter, view: SandboxView) {
  const look = entranceLook(view, f);
  if (look.hidden) return;
  const height = f.y / SUB - look.dy;
  const lift = Math.min(1, height / 60);
  const sprite = spriteOf(f);
  const base = sprite ? Math.min(40, Math.max(18, sprite.width * 0.7)) : 30;
  const rx = (base / 2) * (1 - lift * 0.45) * look.scale;
  const ry = Math.max(1.5, rx * 0.2);
  const x = sx(f.x) + look.dx;
  const y = FLOOR_Y - ry * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  shade.addColorStop(0, `rgba(0, 0, 0, ${0.5 * (1 - lift * 0.6)})`);
  shade.addColorStop(0.6, `rgba(0, 0, 0, ${0.32 * (1 - lift * 0.6)})`);
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

  switch (f.action) {
    case 'idle':
    case 'guard':
      // Breathing: the body swells a little, the feet stay planted.
      scaleY = 1 + 0.025 * Math.sin((f.actionFrame / 60) * Math.PI * 2);
      break;
    case 'walkForward':
    case 'walkBack':
      // A step: a small bounce (a squash on each footfall, a lift between them).
      dy = -Math.max(0, Math.sin((f.actionFrame / 16) * Math.PI * 2)) * 1.5;
      scaleY = 1 - 0.03 * Math.max(0, -Math.sin((f.actionFrame / 16) * Math.PI * 2));
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
    case 'bossAttack': {
      const pose = bossPose(f);
      if (pose) ({ dx, dy, scaleX, scaleY, angle } = pose);
      break;
    }
    default:
      break;
  }
  if (isInvincible(f) && f.action !== 'ko') alpha = 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(snap(sx(f.x) + dx), snap(sy(f.y) + dy));
  ctx.rotate(angle);
  ctx.scale(f.facing === 1 ? -scaleX : scaleX, scaleY);
  const justHit = (f.action === 'hitstun' || f.action === 'airHitstun') && f.actionFrame <= 3;
  if (justHit) ctx.filter = 'brightness(0) invert(1)'; // a white flash
  // Lying down (rotated a quarter turn), the sprite is lifted so it rests on the floor.
  const lying = f.action === 'ko' && f.y === 0;
  // Whole art pixels (an odd width would put the sprite half a pixel off).
  const left = -Math.floor(sprite.width / 2);
  ctx.drawImage(sprite.image, left, lying ? -Math.floor(sprite.width / 2) - Math.floor(sprite.height / 2) : -sprite.height);
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
    // The type's glow, with the projectile itself forming in it (a fireball, a bubble, a stone…).
    const slot = f.action === 'big' ? 'big' : 'elemental';
    const { type, shape } = f.loadout[slot];
    drawChargeLook(ctx, type, sx(f.x) + f.facing * 22, sy(f.y) - 26, f.actionFrame / move.startup, slot === 'big', f.facing, f.actionFrame, shape === 'projectile');
  }

  const hitbox = activeHitbox(f);
  const slot = f.action === 'big' ? 'big' : f.action === 'elemental' ? 'elemental' : null;
  if (hitbox && slot && f.loadout[slot].shape === 'beam') {
    // From the attacker's front to the far end, in the type's look (flames, foam, lightning, ice, psychic rings…).
    const [near, far] = f.facing === 1 ? [sx(hitbox.x1), sx(hitbox.x2)] : [sx(hitbox.x2), sx(hitbox.x1)];
    drawBeamLook(ctx, f.loadout[slot].type, near, far, sy(hitbox.y2), sy(hitbox.y1), f.actionFrame, 0.88 + 0.12 * Math.sin(f.actionFrame));
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
    const color = elementLook(p.attack.type).energy;
    // The type's projectile: a fireball, a bubble, purple psychic energy, a spinning stone…
    drawProjectileLook(ctx, p.attack.type, cx, cy, p.slot === 'big' ? radius * 0.8 : radius * 1.2, Math.sign(p.vx), frame, p.id);
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

/** A small Poké Ball with a dark outline: red and white, or all greys (not caught yet). */
function drawOwnedBall(ctx: CanvasRenderingContext2D, x: number, y: number, owned: boolean) {
  const r = 4.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#16121e';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.fillStyle = owned ? '#e8404a' : '#8a8a96';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.fillStyle = owned ? '#f4f4f4' : '#c4c4cc';
  ctx.fill();
  ctx.fillStyle = '#16121e';
  ctx.fillRect(x - r, y - 0.6, r * 2, 1.2);
  ctx.beginPath();
  ctx.arc(x, y, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = owned ? '#ffffff' : '#d8d8de';
  ctx.fill();
  // A glint on the top half.
  ctx.fillStyle = owned ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
  ctx.fillRect(x - 2.5, y - 3, 1.2, 1.2);
  ctx.restore();
}

// ── Legendary bosses: their HUD, the attack's name, the darkened sky ─────────────────────────────────────────────

/** Gradients at fixed places (the HUD panels, the banner, the sky) are made once. */
const cachedGradients = new Map<string, CanvasGradient>();
function cachedGradient(key: string, make: () => CanvasGradient): CanvasGradient {
  let g = cachedGradients.get(key);
  if (!g) cachedGradients.set(key, (g = make()));
  return g;
}

/** While meteors fall, the sky darkens to a deep red. */
function drawSkyShade(ctx: CanvasRenderingContext2D, shade: number) {
  if (shade <= 0) return;
  ctx.save();
  ctx.globalAlpha = shade;
  ctx.fillStyle = cachedGradient('sky', () => {
    const g = ctx.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, 'rgba(36,4,22,0.75)');
    g.addColorStop(0.6, 'rgba(70,10,30,0.3)');
    g.addColorStop(1, 'rgba(70,10,30,0)');
    return g;
  });
  ctx.fillRect(0, 0, VIEW_W, 170);
  ctx.restore();
}

/** A gold frame around a legendary's panel; it pulses red once the boss is enraged. */
function drawGoldFrame(ctx: CanvasRenderingContext2D, left: number, width: number, enraged: boolean, frame: number) {
  ctx.save();
  if (enraged) {
    roundRect(ctx, left - 2.5, 2.5, width + 5, 45, 9);
    ctx.strokeStyle = `rgba(255,50,70,${0.35 + 0.3 * Math.sin(frame * 0.2)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  roundRect(ctx, left - 1, 4, width + 2, 42, 8);
  ctx.strokeStyle = cachedGradient(`frame${left}`, () => {
    const g = ctx.createLinearGradient(left, 0, left + width, 0);
    g.addColorStop(0, '#b07818');
    g.addColorStop(0.3, '#fff1b0');
    g.addColorStop(0.55, '#e0a530');
    g.addColorStop(0.8, '#fff1b0');
    g.addColorStop(1, '#b07818');
    return g;
  });
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, left + 1.5, 6.5, width - 3, 37, 6);
  ctx.strokeStyle = 'rgba(255,220,120,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** A small gold crown (centered on x, y). */
function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 4);
  ctx.lineTo(x - 6, y - 3);
  ctx.lineTo(x - 3, y);
  ctx.lineTo(x, y - 5);
  ctx.lineTo(x + 3, y);
  ctx.lineTo(x + 6, y - 3);
  ctx.lineTo(x + 6, y + 4);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2000';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd25e';
  ctx.fill();
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(x - 6, y - 1, 12, 1);
  ctx.fillStyle = '#ff4a6a';
  ctx.fillRect(x - 1, y + 1, 2, 2);
  ctx.restore();
}

/** A legendary's HP bar: four segments (each one its normal HP), with a gold rim. */
function drawBossBar(ctx: CanvasRenderingContext2D, barX: number, barW: number, mirror: boolean, enraged: boolean, frame: number) {
  ctx.save();
  if (enraged) {
    ctx.fillStyle = `rgba(255,40,60,${0.12 + 0.12 * Math.sin(frame * 0.25)})`;
    ctx.fillRect(barX, 23, barW, 6);
  }
  for (let k = 1; k < 4; k++) {
    const x = Math.round(barX + (barW * k) / 4);
    ctx.fillStyle = 'rgba(10,10,25,0.95)';
    ctx.fillRect(x - 1, 22, 2, 8);
    ctx.fillStyle = '#ffd25e';
    ctx.fillRect(x - 1, 20, 2, 2);
    ctx.fillRect(x - 1, 30, 2, 2);
  }
  roundRect(ctx, barX - 0.5, 21.5, barW + 1, 9, 3);
  ctx.strokeStyle = 'rgba(255,210,94,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // "×4" at the bar's outer end (the end that empties last).
  ctx.font = font(7);
  ctx.textAlign = mirror ? 'right' : 'left';
  outlined(ctx, '×4', mirror ? barX + barW - 2 : barX + 2, 22, '#ffe9a0', 'rgba(0,0,0,0.8)', 2);
  ctx.restore();
}

/** "LEGENDARY" (or "ENRAGED!") under the panel. */
function drawBossTag(ctx: CanvasRenderingContext2D, x: number, mirror: boolean, enraged: boolean, frame: number) {
  const text = t(enraged ? 'boss.enraged' : 'boss.legendary');
  ctx.save();
  ctx.font = font(8);
  const w = Math.ceil(ctx.measureText(text).width) + 12;
  const left = mirror ? x - w : x;
  roundRect(ctx, left, 47, w, 12, 4);
  ctx.fillStyle = enraged ? 'rgba(96,8,22,0.9)' : 'rgba(58,34,4,0.88)';
  ctx.fill();
  ctx.strokeStyle = enraged ? '#ff5a6a' : '#ffd25e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = enraged ? (Math.floor(frame / 8) % 2 === 0 ? '#ff9aa4' : '#ffffff') : '#ffd25e';
  ctx.fillText(text, left + w / 2, 48);
  ctx.restore();
}

/** The attack's name in a red ribbon when it starts, and how to survive it under it. */
function drawBossBanner(ctx: CanvasRenderingContext2D, view: SandboxView) {
  if (view.battle.phase !== 'fight') return;
  const a = view.battle.round.fighters.find(f => f.boss?.current)?.boss?.current;
  if (!a || a.frame > BOSS_BANNER_FRAMES) return;
  const age = a.frame;
  const pop = age < 6 ? 0.5 + (age / 6) * 0.65 : age < 10 ? 1.15 - ((age - 6) / 4) * 0.15 : 1;
  const alpha = age > BOSS_BANNER_FRAMES - 12 ? (BOSS_BANNER_FRAMES - age) / 12 : 1;
  const name = t(`boss.attack.${a.id}`);
  const hint = t(`boss.hint.${a.id}`);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(VIEW_W / 2, 72);
  ctx.scale(pop, pop);
  ctx.font = font(18);
  const w = Math.ceil(ctx.measureText(name).width) + 56;
  // A slanted ribbon with gold edges.
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 10, -13);
  ctx.lineTo(w / 2 + 6, -13);
  ctx.lineTo(w / 2 - 10, 13);
  ctx.lineTo(-w / 2 - 6, 13);
  ctx.closePath();
  ctx.fillStyle = cachedGradient('ribbon', () => {
    const g = ctx.createLinearGradient(-160, 0, 160, 0);
    g.addColorStop(0, 'rgba(70,6,30,0.2)');
    g.addColorStop(0.2, 'rgba(120,10,40,0.92)');
    g.addColorStop(0.8, 'rgba(70,14,90,0.92)');
    g.addColorStop(1, 'rgba(40,10,70,0.2)');
    return g;
  });
  ctx.fill();
  ctx.fillStyle = '#ffd25e';
  ctx.fillRect(-w / 2 + 10, -14, w - 4, 1.5);
  ctx.fillRect(-w / 2 - 6, 12.5, w - 4, 1.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = cachedGradient('bannerText', () => {
    const g = ctx.createLinearGradient(0, -10, 0, 10);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.5, '#ffd25e');
    g.addColorStop(1, '#ff8a3d');
    return g;
  });
  outlined(ctx, name, 0, 0, gold, '#2a0610', 4);
  ctx.font = font(8, 'normal');
  const hw = Math.ceil(ctx.measureText(hint).width) + 14;
  roundRect(ctx, -hw / 2, 17, hw, 12, 4);
  ctx.fillStyle = 'rgba(10,8,24,0.8)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(hint, 0, 23.5);
  ctx.restore();
}

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
    // A legendary: a gold frame and a crown before its name.
    const crown = f.boss ? 13 : 0;
    if (f.boss) {
      drawGoldFrame(ctx, left, width, f.boss.enraged, battle.round.frame);
      drawCrown(ctx, mirror ? left + width - 14 : left + 14, 14);
    }

    // Name and level.
    ctx.font = font(10);
    ctx.textAlign = mirror ? 'right' : 'left';
    const nameX = mirror ? left + width - 8 - crown : left + 8 + crown;
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
    // Wild fights: a Poké Ball left of the opponent's name, in color if the player has this species, grey if not.
    if (mirror && view.owned !== null) {
      drawOwnedBall(ctx, snap(nameX - nameWidth - 8), 14, view.owned);
      badgeX -= 14;
    }
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
    if (f.boss) drawBossBar(ctx, barX, barW, mirror, f.boss.enraged, battle.round.frame);

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
    if (f.boss) drawBossTag(ctx, mirror ? left + width - 8 : left + 8, mirror, f.boss.enraged, battle.round.frame);
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
    // Training shows three lines (the controls, the free special's motion, the tools); a tutorial only the controls.
    const top = view.tools ? VIEW_H - 36 : VIEW_H - 26;
    roundRect(ctx, 16, top, VIEW_W - 32, view.tools ? 32 : 12, 5);
    ctx.fillStyle = 'rgba(8,10,24,0.55)';
    ctx.fill();
    ctx.font = font(8, 'normal');
    ctx.fillStyle = '#d8dcf0';
    ctx.fillText(t('controls.fight'), VIEW_W / 2, top + 2);
    if (view.tools) {
      ctx.fillText(t('motion.hint'), VIEW_W / 2, top + 12);
      ctx.fillText(t('controls.sandbox'), VIEW_W / 2, top + 22);
    }
  }
  ctx.restore();
}

// ── Phases: KO, choosing the next Pokémon, battle over ───────────────────────────────────────────────────────────

function drawPhase(ctx: CanvasRenderingContext2D, view: SandboxView, pad: boolean) {
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
    const keys = battle.chooseReason === 'switch' ? (pad ? 'battle.switchPad' : 'battle.switchKeys') : pad ? 'battle.choosePad' : 'battle.chooseKeys';
    ctx.fillText(t(keys), VIEW_W / 2, top + 16 + team.length * 16);
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
