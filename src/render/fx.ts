// Visual effects: particles (sparks, rings, dust, trails, glows), screen shake, and the HP "damage trail". Purely
// for the eyes: fed by the fight's events and state after each simulated frame, never touching the fight itself.

import { BOSS_ATTACK, VORTEX } from '../fight/boss';
import { BODY_HEIGHT, SUB } from '../fight/constants';
import type { ActionKind, FightEvent, FightState, Fighter } from '../fight/state';
import { TYPE_COLORS } from './colors';
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
  kind: 'spark' | 'dust' | 'ring' | 'glow';
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
                ? typeColor(e.source === 'big' ? attacker.loadout.big.type : attacker.loadout.elemental.type)
                : '#ffffff';
          if (e.effectiveness === 0) {
            ring(x, y, 'rgba(200,200,220,0.8)', 10);
            continue;
          }
          burst(x, y, e.big ? 28 : special ? 16 : 10, ['#ffffff', '#ffe27a', color], e.big ? 4 : 2.6);
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
            color: typeColor(big ? f.loadout.big.type : f.loadout.elemental.type),
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

      // Projectiles leave a trail of their color.
      for (const p of round.projectiles) {
        const big = p.slot === 'big';
        particles.push({
          x: p.x / SUB - Math.sign(p.vx) * (big ? 10 : 5),
          y: FLOOR_Y - (p.y1 + p.y2) / 2 / SUB + (random() - 0.5) * (big ? 10 : 5),
          vx: -Math.sign(p.vx) * 0.4,
          vy: (random() - 0.5) * 0.3,
          life: big ? 16 : 10,
          max: big ? 16 : 10,
          size: big ? 4 : 2,
          color: typeColor(p.attack.type),
          gravity: 0,
          kind: 'glow',
        });
      }

      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        if (p.kind === 'ring') p.size += 1.2;
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
    },
  };
}
