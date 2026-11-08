// Draws one picture of the sandbox. It only reads the state and never changes it.
// Fighters are placeholder rectangles until the Pokémon sprites arrive (milestone 4).

import { activeHitbox, attackPhase, bodyBox, currentAttack, isInvincible, type WorldBox } from '../fight/boxes';
import { SUB } from '../fight/constants';
import { Button, has, type InputMask } from '../fight/input';
import type { Fighter } from '../fight/state';
import type { SandboxView } from '../screens/sandbox';
import { VIEW_H, VIEW_W } from './screen';

export const FLOOR_Y = 230;

const COLORS = {
  sky: '#1b2440',
  floor: '#2f4a2a',
  floorEdge: '#4f7a46',
  fighters: ['#4a90d9', '#d9534a'],
  limb: ['#a8d1ff', '#ffb0a8'],
  hurt: '#ffffff',
  ko: '#6b6f7a',
  text: '#ffffff',
  dim: '#9aa4c0',
  hpBack: '#3a1c1c',
  hp: '#f2c94c',
  hurtbox: '#4cd964',
  hitbox: '#ff3b30',
};

const sx = (x: number) => Math.round(x / SUB);
const sy = (y: number) => FLOOR_Y - Math.round(y / SUB);

export function render(ctx: CanvasRenderingContext2D, view: SandboxView): void {
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
  drawArena(ctx);
  view.state.fighters.forEach(f => drawFighter(ctx, f));
  drawHud(ctx, view);
  if (view.debug) drawDebug(ctx, view);
  if (view.state.winner !== null) drawKo(ctx, view);
}

function drawArena(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, VIEW_W, FLOOR_Y);
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);
  ctx.fillStyle = COLORS.floorEdge;
  ctx.fillRect(0, FLOOR_Y, VIEW_W, 2);
}

function fillBox(ctx: CanvasRenderingContext2D, b: WorldBox) {
  ctx.fillRect(sx(b.x1), sy(b.y2), sx(b.x2) - sx(b.x1), sy(b.y1) - sy(b.y2));
}

function strokeBox(ctx: CanvasRenderingContext2D, b: WorldBox) {
  ctx.strokeRect(sx(b.x1) + 0.5, sy(b.y2) + 0.5, sx(b.x2) - sx(b.x1) - 1, sy(b.y1) - sy(b.y2) - 1);
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  ctx.save();
  if (f.action === 'ko' && f.y === 0) {
    // Lying on the floor.
    ctx.fillStyle = COLORS.ko;
    ctx.fillRect(sx(f.x) - 24, FLOOR_Y - 14, 48, 14);
    ctx.restore();
    return;
  }
  if (isInvincible(f)) ctx.globalAlpha = 0.5;
  const justHit = (f.action === 'hitstun' || f.action === 'airHitstun') && f.actionFrame <= 3;
  ctx.fillStyle = f.action === 'ko' ? COLORS.ko : justHit ? COLORS.hurt : COLORS.fighters[f.id];
  fillBox(ctx, bodyBox(f));

  // Eye, on the side the fighter faces.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx(f.x) + f.facing * 8 - 2, sy(f.y) - 40, 4, 4);

  // The attack's "limb", only while it can hit.
  const hitbox = activeHitbox(f);
  if (hitbox) {
    ctx.fillStyle = COLORS.limb[f.id];
    fillBox(ctx, hitbox);
  }
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const barWidth = 200;
  view.state.fighters.forEach(f => {
    const left = f.id === 0 ? 16 : VIEW_W - 16 - barWidth;
    const filled = Math.round((barWidth * f.hp) / f.maxHp);
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(left, 12, barWidth, 8);
    ctx.fillStyle = COLORS.hp;
    // Bars empty towards the center, like most fighting games.
    ctx.fillRect(f.id === 0 ? left + barWidth - filled : left, 12, filled, 8);
    ctx.font = '8px monospace';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = f.id === 0 ? 'left' : 'right';
    ctx.fillText(f.id === 0 ? 'P1' : `DUMMY (${view.dummy})`, f.id === 0 ? left : left + barWidth, 23);
  });

  ctx.font = '8px monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'center';
  ctx.fillText('WASD/arrows move · J attack · Space dash · F1 debug · F2 dummy · R reset', VIEW_W / 2, VIEW_H - 12);
}

function drawKo(ctx: CanvasRenderingContext2D, view: SandboxView) {
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px monospace';
  ctx.fillText('K.O.', VIEW_W / 2, 80);
  ctx.font = '10px monospace';
  const winner = view.state.winner;
  ctx.fillText(winner === 'draw' ? 'Double K.O.' : winner === 0 ? 'P1 wins' : 'Dummy wins', VIEW_W / 2, 118);
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('Enter / Start: fight again', VIEW_W / 2, 134);
}

// ── Debug overlay (F1) ────────────────────────────────────────────────────────────────────────────────────────────

function drawDebug(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { state } = view;
  ctx.save();
  ctx.lineWidth = 1;
  for (const f of state.fighters) {
    // No hurt box while invincible: that's how the back dash's invincible frames show up.
    if (!isInvincible(f)) {
      ctx.strokeStyle = COLORS.hurtbox;
      strokeBox(ctx, bodyBox(f));
    }
    const hitbox = activeHitbox(f);
    if (hitbox) {
      ctx.strokeStyle = COLORS.hitbox;
      strokeBox(ctx, hitbox);
    }
  }
  ctx.restore();

  ctx.font = '8px monospace';
  ctx.fillStyle = COLORS.text;
  state.fighters.forEach(f => {
    ctx.textAlign = f.id === 0 ? 'left' : 'right';
    const x = f.id === 0 ? 16 : VIEW_W - 16;
    ctx.fillText(describeAction(f), x, 34);
    ctx.fillText(`x ${(f.x / SUB).toFixed(1)}  y ${(f.y / SUB).toFixed(1)}  hp ${f.hp}`, x, 44);
  });

  ctx.textAlign = 'center';
  ctx.fillText(`frame ${state.frame}${state.hitstop > 0 ? `  hitstop ${state.hitstop}` : ''}`, VIEW_W / 2, 34);
  if (view.advantage !== null) {
    ctx.fillText(`on hit: ${view.advantage > 0 ? '+' : ''}${view.advantage}`, VIEW_W / 2, 44);
  }

  // Input history (player 1), newest on top.
  ctx.textAlign = 'left';
  view.history.forEach((entry, row) => {
    ctx.fillStyle = row === 0 ? COLORS.text : COLORS.dim;
    ctx.fillText(`${String(entry.frames).padStart(2)} ${describeInput(entry.mask)}`, 16, 60 + row * 10);
  });
}

function describeAction(f: Fighter): string {
  const length = f.actionLength > 0 ? `/${f.actionLength}` : '';
  const attack = currentAttack(f);
  const phase = attack ? ` ${attackPhase(attack, f.actionFrame)}` : '';
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
  const parts = [ARROWS[directions] ?? '·', ...buttons];
  return parts.join(' ');
}
