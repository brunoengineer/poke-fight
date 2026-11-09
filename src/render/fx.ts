// Visual effects: particles (sparks, rings, dust, trails, glows), screen shake, and the HP "damage trail". Purely
// for the eyes: fed by the fight's events and state after each simulated frame, never touching the fight itself.

import { BOSS_ATTACK, VORTEX } from '../fight/boss';
import { activeHitbox } from '../fight/boxes';
import { BODY_HEIGHT, SUB } from '../fight/constants';
import { BIG, type BigShape } from '../fight/frame-data';
import type { ActionKind, FightEvent, FightState, Fighter, Projectile } from '../fight/state';
import { TYPE_COLORS } from './colors';
import { elementLook } from './elements';
import { FLOOR_Y } from './stage';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  /** smoke: dark puffs drawn over the scene (Ghost, Dark); chip: solid bits (leaves, rock); flake: ice twinkles. */
  kind: 'spark' | 'dust' | 'ring' | 'glow' | 'smoke' | 'chip' | 'flake';
}

export interface Fx {
  /** After each simulated frame (with that frame's events). */
  onTick(round: FightState, events: readonly FightEvent[]): void;
  /** Particles behind the fighters (dust) and in front (sparks, rings). */
  drawBack(ctx: CanvasRenderingContext2D): void;
  drawFront(ctx: CanvasRenderingContext2D): void;
  /** The screen's offset this frame (shake). */
  shake(): { x: number; y: number };
  /** The HP shown behind the bar, draining slowly after a hit (per fighter). */
  trail(id: 0 | 1, hp: number): number;
  reset(): void;
}

const sx = (x: number) => x / SUB;
const sy = (y: number) => FLOOR_Y - y / SUB;
const typeColor = (type: string | null) => (type ? (TYPE_COLORS[type] ?? '#ffffff') : '#ffffff');
/** The middle of a standing body, on screen. */
const BOSS_MID = FLOOR_Y - BODY_HEIGHT / SUB / 2;

export function createFx(): Fx {
  let particles: Particle[] = [];
  let shake = { amplitude: 0, frames: 0 };
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const trails: [number | null, number | null] = [null, null];
  const trailDelay = [0, 0];
  const lastActions: (ActionKind | null)[] = [null, null];
  /** Last frame's barrage pieces (rocks, meteors): one that is gone without a hit has landed. */
  let flying = new Map<number, Projectile>();

  const burst = (x: number, y: number, count: number, colors: string[], speed: number, kind: Particle['kind'] = 'spark') => {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 0.6,
        life: 14 + Math.floor(random() * 12),
        max: 26,
        size: kind === 'spark' ? 1 + Math.floor(random() * 2) : 3,
        color: colors[i % colors.length],
        gravity: kind === 'spark' ? 0.12 : 0,
        kind,
      });
    }
  };
  const ring = (x: number, y: number, color: string, size: number, life = 16) =>
    particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, gravity: 0, kind: 'ring' });
  const dust = (x: number, y: number, direction: number) => {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: x + (random() - 0.5) * 10,
        y: y - 2,
        vx: -direction * (0.3 + random() * 0.8),
        vy: -0.2 - random() * 0.4,
        life: 18 + Math.floor(random() * 10),
        max: 28,
        size: 2 + Math.floor(random() * 3),
        color: 'rgba(230,220,200,0.8)',
        gravity: -0.005,
        kind: 'dust',
      });
    }
  };
  const quake = (amplitude: number, frames: number) => {
    if (amplitude >= shake.amplitude) shake = { amplitude, frames };
  };
  const glowAt = (x: number, y: number, vx: number, vy: number, life: number, size: number, color: string) =>
    particles.push({ x, y, vx, vy, life, max: life, size, color, gravity: 0, kind: 'glow' });
  /** What a special of this type leaves behind it at (x, y), moving towards `dir`: embers rise, drops fall… */
  const trailOf = (type: string | null, x: number, y: number, dir: number, big: boolean) => {
    const look = elementLook(type);
    const [light, main, deep] = look.colors;
    const spread = big ? 10 : 5;
    const at = { x: x - dir * spread, y: y + (random() - 0.5) * spread * 1.4 };
    const life = big ? 18 : 12;
    const push = (kind: Particle['kind'], vx: number, vy: number, size: number, color: string, gravity = 0, length = life) =>
      particles.push({ ...at, vx, vy, life: length, max: length, size, color, gravity, kind });
    switch (look.particle) {
      case 'ember':
        return push('glow', -dir * 0.3 + (random() - 0.5) * 0.4, -0.4 - random() * 0.6, big ? 3 : 2, random() < 0.5 ? light : main, -0.01);
      case 'drop':
        return push('spark', -dir * 0.6, -0.6 + random() * 0.5, big ? 2 : 1.5, random() < 0.5 ? light : main, 0.14);
      case 'spark':
        return push('spark', (random() - 0.5) * 2.4, (random() - 0.5) * 2.4, big ? 2 : 1, random() < 0.6 ? light : look.energy, 0, 6 + Math.floor(random() * 4));
      case 'flake':
        return push('flake', -dir * 0.2, (random() - 0.5) * 0.3, big ? 2.4 : 1.6, random() < 0.5 ? '#ffffff' : light, 0.01, life + 8);
      case 'leaf':
        return push('chip', -dir * 0.5, -0.3 + random() * 0.3, big ? 2.4 : 1.6, random() < 0.5 ? main : deep, 0.03, life + 10);
      case 'debris':
        return push('chip', -dir * (0.3 + random() * 0.5), -0.8 - random() * 0.6, big ? 2.4 : 1.5, random() < 0.5 ? main : deep, 0.16);
      case 'smoke':
        return push('smoke', -dir * 0.3, -0.15 - random() * 0.2, big ? 4 : 2.5, random() < 0.5 ? main : deep, -0.004, life + 6);
      default:
        return push('glow', -dir * 0.4, (random() - 0.5) * 0.3, big ? 4 : 2, random() < 0.3 ? light : look.energy);
    }
  };
  /** A boss's attack in progress leaves particles: energy drawn in, sparks off the wave, dust behind a charge. */
  const bossParticles = (boss: Fighter) => {
    const a = boss.boss?.current;
    if (!a || boss.action === 'ko') return;
    const color = typeColor(boss.types[0] ?? null);
    const t = BOSS_ATTACK[a.id].telegraph;
    const x = sx(boss.x);
    if (a.frame <= t && a.frame % 2 === 0) {
      const angle = random() * Math.PI * 2;
      const distance = 40 + random() * 20;
      glowAt(x + Math.cos(angle) * distance, BOSS_MID + Math.sin(angle) * distance, (-Math.cos(angle) * distance) / 12, (-Math.sin(angle) * distance) / 12, 12, 2, color);
    }
    if (a.id === 'slash') {
      for (const wave of a.parts) {
        for (let k = 0; k < 2; k++) {
          glowAt(sx(wave.x) - wave.dir * random() * 10, FLOOR_Y - random() * 230, -wave.dir * (1 + random() * 2), (random() - 0.5) * 0.6, 14, 2.5, k ? '#ffffff' : color);
        }
      }
    } else if (a.id === 'rampage' && a.run === 'run' && a.frame % 3 === 0) {
      dust(x - a.dir * 14, FLOOR_Y, a.dir);
    } else if (a.id === 'vortex' && a.frame > t && a.frame <= t + VORTEX.pullFrames) {
      // Streaks pulled into the vortex.
      for (let k = 0; k < 2; k++) {
        const angle = random() * Math.PI * 2;
        const distance = 120 + random() * 50;
        glowAt(x + Math.cos(angle) * distance, BOSS_MID + Math.sin(angle) * distance * 0.45, (-Math.cos(angle) * distance) / 18, (-Math.sin(angle) * distance * 0.45) / 18, 18, 2, k ? '#ffffff' : color);
      }
    } else if (a.id === 'meteor' && a.frame <= t + 12 && a.frame % 2 === 0) {
      glowAt(x + (random() - 0.5) * 20, BOSS_MID - 20, (random() - 0.5) * 0.5, -6 - random() * 3, 20, 3, color);
    }
  };

  /** A big special's form, as it comes out and while it lasts: shakes, impacts, snow, sparks on a dome's rim… */
  const SHAKE: Record<BigShape, [number, number]> = {
    projectile: [2, 6],
    beam: [3, 12],
    rush: [2, 8],
    quake: [5, 14],
    surf: [2, 10],
    tornado: [2, 10],
    solar: [4, 16],
    blizzard: [2, 18],
    burst: [5, 14],
    strike: [6, 16],
    barrage: [2, 6],
  };
  const bigEffects = (f: Fighter) => {
    if (f.action !== 'big') return;
    const { shape, type } = f.loadout.big;
    const move = BIG[shape];
    const into = f.actionFrame - move.startup;
    if (into < 1 || into > move.active) return;
    const look = elementLook(type);
    const x = sx(f.x);
    if (into === 1) quake(...SHAKE[shape]);
    if (shape === 'strike' && f.target !== null && into === 1) {
      const at = f.target / SUB;
      burst(at, FLOOR_Y - 4, 24, ['#ffffff', look.energy, look.colors[0]], 3.6);
      ring(at, FLOOR_Y - 6, look.energy, 18, 18);
      dust(at, FLOOR_Y, -1);
      dust(at, FLOOR_Y, 1);
    } else if (shape === 'burst' && into === 1) {
      ring(x, FLOOR_Y - 20, look.energy, 30, 20);
    } else if (shape === 'burst') {
      const angle = Math.PI + random() * Math.PI;
      const radius = (move.hitbox!.x2 / SUB) * Math.min(1, into / 4);
      glowAt(x + Math.cos(angle) * radius, FLOOR_Y + Math.sin(angle) * radius, Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, 14, 2.5, look.energy);
    } else if (shape === 'blizzard') {
      const reach = (move.hitbox!.x2 - move.hitbox!.x1) / SUB;
      for (let k = 0; k < 3; k++) trailOf(type, x + f.facing * random() * reach, FLOOR_Y - random() * 80, -f.facing, true);
    } else if (shape === 'solar' && into % 2 === 0) {
      trailOf(type, x + f.facing * (20 + random() * 440), FLOOR_Y - random() * 64, -f.facing, true);
    }
  };

  return {
    onTick(round, events) {
      for (const e of events) {
        if (e.type === 'hit') {
          const target = round.fighters[e.defender];
          const attacker = round.fighters[e.attacker];
          const x = sx(target.x) - Math.sign(target.x - attacker.x) * 8;
          const y = sy(target.y) - 26;
          const special = e.source === 'elemental' || e.source === 'big';
          const color =
            e.source === 'boss'
              ? typeColor(attacker.types[0] ?? null)
              : special
                ? elementLook(e.source === 'big' ? attacker.loadout.big.type : attacker.loadout.elemental.type).energy
                : '#ffffff';
          if (e.effectiveness === 0) {
            ring(x, y, 'rgba(200,200,220,0.8)', 10);
            continue;
          }
          burst(x, y, e.big ? 28 : special ? 16 : 10, ['#ffffff', special ? color : '#ffe27a', color], e.big ? 4 : 2.6);
          // A special also bursts in its own matter: embers, drops, leaves, stones, smoke…
          if (special) {
            const type = e.source === 'big' ? attacker.loadout.big.type : attacker.loadout.elemental.type;
            for (let k = 0; k < (e.big ? 14 : 8); k++) trailOf(type, x + (random() - 0.5) * 12, y + (random() - 0.5) * 12, (random() - 0.5) * 2, e.big);
          }
          ring(x, y, color, e.big ? 34 : 16, e.big ? 22 : 14);
          if (e.effectiveness > 1) ring(x, y, '#ffd25e', 24, 20);
          quake(e.big ? 5 : e.effectiveness > 1 ? 3 : 2, e.big ? 16 : 7);
        } else if (e.type === 'block') {
          const target = round.fighters[e.defender];
          const x = sx(target.x) + target.facing * 18;
          const y = sy(target.y) - 24;
          ring(x, y, '#7fe0ff', 14, 12);
          burst(x, y, 6, ['#bff4ff', '#7fe0ff'], 1.8);
          quake(1, 4);
        } else if (e.type === 'ko') {
          const target = round.fighters[e.loser];
          burst(sx(target.x), sy(target.y) - 24, 34, ['#ffffff', '#ffd25e', '#ff6fae'], 4.5);
          ring(sx(target.x), sy(target.y) - 24, '#ffffff', 46, 26);
          quake(6, 22);
        } else if (e.type === 'bossImpact') {
          const color = typeColor(round.fighters[e.fighter].types[0] ?? null);
          const x = sx(e.x);
          if (e.attack === 'vortex') {
            burst(x, BOSS_MID, 26, ['#ffffff', color], 4.2);
            ring(x, BOSS_MID, color, 30, 20);
            quake(6, 18);
          } else if (e.attack === 'quake') {
            dust(x - 10, FLOOR_Y, -1);
            dust(x + 10, FLOOR_Y, 1);
            burst(x, FLOOR_Y - 2, 12, ['#e8d2a8', '#ffffff', color], 3);
            quake(5, 14);
          } else {
            // A meteor: debris and sparks thrown up, a ring on the ground.
            dust(x, FLOOR_Y, 1);
            burst(x, FLOOR_Y - 4, 12, ['#ffffff', '#ffe27a', color], 3.2);
            ring(x, FLOOR_Y - 6, color, 12, 14);
            quake(3, 8);
          }
        } else if (e.type === 'bossAttack' && e.phase === 'active') {
          const boss = round.fighters[e.fighter];
          if (e.attack === 'slash') quake(4, 12);
          else if (e.attack === 'nova') {
            ring(sx(boss.x), BOSS_MID, '#ffffff', 20, 18);
            quake(5, 20);
          }
        } else if (e.type === 'bossEnraged') {
          const boss = round.fighters[e.fighter];
          burst(sx(boss.x), sy(boss.y) - 26, 24, ['#ff2a3a', '#ff8a8a', '#ffffff'], 3.5);
          ring(sx(boss.x), sy(boss.y) - 26, '#ff2a3a', 26, 22);
          quake(3, 10);
        }
      }

      for (const boss of round.fighters) bossParticles(boss);

      for (const f of round.fighters) {
        const before = lastActions[f.id];
        // Dust when a dash starts or a fighter lands.
        if (f.action !== before && (f.action === 'dash' || f.action === 'backdash' || f.action === 'land')) {
          dust(sx(f.x), FLOOR_Y, f.action === 'backdash' ? -f.facing : f.facing);
        }
        lastActions[f.id] = f.action;
        // Charging a special: sparks drawn into the glow.
        if ((f.action === 'elemental' || f.action === 'big') && f.actionFrame % 3 === 0) {
          const big = f.action === 'big';
          const cx = sx(f.x) + f.facing * 22;
          const cy = sy(f.y) - 26;
          const angle = random() * Math.PI * 2;
          const distance = big ? 30 : 18;
          particles.push({
            x: cx + Math.cos(angle) * distance,
            y: cy + Math.sin(angle) * distance,
            vx: -Math.cos(angle) * distance / 10,
            vy: -Math.sin(angle) * distance / 10,
            life: 10,
            max: 10,
            size: 2,
            color: elementLook(big ? f.loadout.big.type : f.loadout.elemental.type).energy,
            gravity: 0,
            kind: 'glow',
          });
        }
        // The HP trail waits a moment, then drains to the real HP.
        const trail = trails[f.id];
        if (trail === null || f.hp > trail) {
          trails[f.id] = f.hp;
        } else if (trail > f.hp) {
          if (trailDelay[f.id] > 0) trailDelay[f.id]--;
          else trails[f.id] = Math.max(f.hp, trail - f.maxHp * 0.012);
        }
        if (events.some(e => e.type === 'hit' && e.defender === f.id)) trailDelay[f.id] = 24;
      }

      // Projectiles leave a trail of their type: embers, drops, sparks, leaves, smoke…
      for (const p of round.projectiles) {
        // A tall one (a wave, a tornado) sheds all along its height.
        const tall = p.y2 - p.y1 > 30 * SUB;
        const y = tall ? p.y1 + random() * (p.y2 - p.y1) : (p.y1 + p.y2) / 2;
        for (let k = 0; k < (tall ? 2 : 1); k++) trailOf(p.attack.type, p.x / SUB, FLOOR_Y - y / SUB, Math.sign(p.vx), p.slot === 'big');
      }
      // A barrage's rock (or meteor) that sank into the floor: debris and a thud.
      const hitNow = new Set(events.flatMap(e => (e.type === 'hit' || e.type === 'block' ? [e.attacker] : [])));
      for (const [id, p] of flying) {
        if (round.projectiles.some(q => q.id === id) || hitNow.has(p.owner)) continue;
        const x = p.x / SUB;
        dust(x, FLOOR_Y, -1);
        dust(x, FLOOR_Y, 1);
        for (let k = 0; k < 8; k++) trailOf(p.attack.type, x + (random() - 0.5) * 10, FLOOR_Y - 3, (random() - 0.5) * 2, true);
        quake(2, 6);
      }
      flying = new Map(round.projectiles.filter(p => p.vy !== undefined).map(p => [p.id, p]));
      for (const f of round.fighters) bigEffects(f);
      // Beams shed some along their length.
      for (const f of round.fighters) {
        const slot = f.action === 'big' ? 'big' : f.action === 'elemental' ? 'elemental' : null;
        const box = slot && f.loadout[slot].shape === 'beam' ? activeHitbox(f) : null;
        if (!box || !slot) continue;
        for (let k = 0; k < 2; k++) {
          const x = box.x1 / SUB + random() * ((box.x2 - box.x1) / SUB);
          trailOf(f.loadout[slot].type, x, FLOOR_Y - (box.y1 + box.y2) / 2 / SUB, f.facing, slot === 'big');
        }
      }

      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        if (p.kind === 'ring') p.size += 1.2;
        if (p.kind === 'smoke') p.size += 0.15;
        return --p.life > 0;
      });
      if (particles.length > 600) particles.splice(0, particles.length - 600);
      if (shake.frames > 0) shake.frames--;
      else shake.amplitude = 0;
    },
    drawBack(ctx) {
      for (const p of particles) {
        if (p.kind !== 'dust') continue;
        ctx.globalAlpha = (p.life / p.max) * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - p.life / p.max), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drawFront(ctx) {
      ctx.save();
      // Solid bits and dark smoke first, over the scene; then the light, added to it.
      for (const p of particles) {
        const fade = p.life / p.max;
        if (p.kind === 'smoke') {
          ctx.globalAlpha = fade * 0.65;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'chip') {
          ctx.globalAlpha = Math.min(1, fade * 1.6);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.4);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        const fade = p.life / p.max;
        if (p.kind === 'spark') {
          ctx.globalAlpha = fade;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        } else if (p.kind === 'glow') {
          ctx.globalAlpha = fade * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * fade + 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'flake') {
          ctx.globalAlpha = fade * (0.6 + 0.4 * Math.sin(p.life));
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size, p.y - 0.4, p.size * 2, 0.8);
          ctx.fillRect(p.x - 0.4, p.y - p.size, 0.8, p.size * 2);
        } else if (p.kind === 'ring') {
          ctx.globalAlpha = fade * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    shake() {
      if (shake.amplitude === 0) return { x: 0, y: 0 };
      const strength = shake.amplitude * Math.min(1, shake.frames / 6);
      return { x: Math.round((random() - 0.5) * 2 * strength), y: Math.round((random() - 0.5) * 2 * strength) };
    },
    trail(id, hp) {
      return Math.max(hp, trails[id] ?? hp);
    },
    reset() {
      particles = [];
      shake = { amplitude: 0, frames: 0 };
      trails[0] = trails[1] = null;
      lastActions[0] = lastActions[1] = null;
      flying = new Map();
    },
  };
}
