// Draws one picture of the sandbox. It only reads the state and never changes it.
// Fighters are placeholder rectangles in their type's color until the Pokémon sprites arrive (milestone 4).

import { activeHitbox, bodyBox, currentMove, isGuarding, isInvincible, movePhase, projectileBox, type WorldBox } from '../fight/boxes';
import { ELEMENTAL_COST, PP_MAX, SUB } from '../fight/constants';
import { Button, has, type InputMask } from '../fight/input';
import type { Fighter, FightState } from '../fight/state';
import type { SandboxView } from '../screens/sandbox';
import { VIEW_H, VIEW_W } from './screen';

export const FLOOR_Y = 230;

export const TYPE_COLORS: Record<string, string> = {
  normal: '#b8b08d',
  fire: '#ee7f30',
  water: '#6890f0',
  grass: '#78c850',
  electric: '#f8d030',
  rock: '#b8a038',
};
const typeColor = (type: string) => TYPE_COLORS[type] ?? '#a0a0a0';

const COLORS = {
  sky: '#1b2440',
  floor: '#2f4a2a',
  floorEdge: '#4f7a46',
  hurt: '#ffffff',
  ko: '#6b6f7a',
  text: '#ffffff',
  dim: '#9aa4c0',
  hpBack: '#3a1c1c',
  hp: '#4cd964',
  hpLow: '#f2c94c',
  hpDanger: '#ff3b30',
  ppBack: '#1c2440',
  pp: '#5ac8fa',
  ppFull: '#bf5af2',
  guard: '#7fe0ff',
  hurtbox: '#4cd964',
  hitbox: '#ff3b30',
  panel: 'rgba(10, 12, 20, 0.85)',
};

const sx = (x: number) => Math.round(x / SUB);
const sy = (y: number) => FLOOR_Y - Math.round(y / SUB);

export function render(ctx: CanvasRenderingContext2D, view: SandboxView): void {
  const { round } = view.battle;
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
  drawArena(ctx);
  for (const f of round.fighters) drawFighter(ctx, f);
  drawProjectiles(ctx, round);
  drawHud(ctx, view);
  if (view.debug) drawDebug(ctx, view);
  if (view.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.5 * view.flash) / 8})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawPhase(ctx, view);
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

// ── Fighters ──────────────────────────────────────────────────────────────────────────────────────────────────────

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  ctx.save();
  if (f.action === 'ko' && f.y === 0) {
    ctx.fillStyle = COLORS.ko;
    ctx.fillRect(Math.min(VIEW_W - 48, Math.max(0, sx(f.x) - 24)), FLOOR_Y - 14, 48, 14);
    ctx.restore();
    return;
  }
  const move = currentMove(f);
  const phase = move ? movePhase(move, f.actionFrame) : null;
  const charging = (f.action === 'elemental' || f.action === 'big') && phase === 'startup';

  // Rush: a short trail behind the body while it charges across.
  if (f.action === 'big' && move?.rush && phase === 'active') {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = typeColor(f.loadout.big.type);
    for (const back of [24, 12]) fillBox(ctx, { ...bodyBox(f), x1: bodyBox(f).x1 - f.facing * back * SUB, x2: bodyBox(f).x2 - f.facing * back * SUB });
    ctx.globalAlpha = 1;
  }

  if (isInvincible(f)) ctx.globalAlpha = 0.5;
  const justHit = (f.action === 'hitstun' || f.action === 'airHitstun') && f.actionFrame <= 3;
  ctx.fillStyle = f.action === 'ko' ? COLORS.ko : justHit ? COLORS.hurt : typeColor(f.type);
  fillBox(ctx, bodyBox(f));

  // Eye, on the side the fighter faces.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx(f.x) + f.facing * 8 - 2, sy(f.y) - 40, 4, 4);

  // Charging a special: a glow in front that grows with the charge (bigger for the big special).
  if (charging && move) {
    const slot = f.action === 'big' ? 'big' : 'elemental';
    const progress = f.actionFrame / move.startup;
    const radius = Math.round((slot === 'big' ? 14 : 7) * progress) + 1;
    ctx.fillStyle = typeColor(f.loadout[slot].type);
    ctx.globalAlpha = f.actionFrame % 4 < 2 ? 0.9 : 0.6;
    ctx.beginPath();
    ctx.arc(sx(f.x) + f.facing * 22, sy(f.y) - 26, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Active hit box: the tackle's "limb", a beam, a rush's front.
  const hitbox = activeHitbox(f);
  if (hitbox) {
    const slot = f.action === 'big' ? 'big' : f.action === 'elemental' ? 'elemental' : null;
    ctx.fillStyle = slot ? typeColor(f.loadout[slot].type) : '#ffffff';
    ctx.globalAlpha = slot ? 0.8 : 0.6;
    fillBox(ctx, hitbox);
    ctx.globalAlpha = 1;
  }

  // Guard: a shield line in front.
  if (isGuarding(f)) {
    ctx.fillStyle = COLORS.guard;
    ctx.fillRect(sx(f.x) + f.facing * 20 - 1, sy(f.y) - 46, 3, 44);
  }
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, round: FightState) {
  for (const p of round.projectiles) {
    const b = projectileBox(p);
    const cx = (sx(b.x1) + sx(b.x2)) / 2;
    const cy = (sy(b.y1) + sy(b.y2)) / 2;
    const radius = Math.max(4, (sy(b.y1) - sy(b.y2)) / 2);
    ctx.fillStyle = typeColor(p.type);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function drawHud(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { battle } = view;
  const barWidth = 180;
  battle.round.fighters.forEach(f => {
    const left = f.id === 0 ? 16 : VIEW_W - 16 - barWidth;
    // Bars are anchored at the screen edge and empty from the center side, like most fighting games.
    const fromEdge = (barLeft: number, width: number, filled: number) => (f.id === 0 ? barLeft : barLeft + width - filled);

    const hpFilled = Math.round((barWidth * f.hp) / f.maxHp);
    const ratio = f.hp / f.maxHp;
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(left, 10, barWidth, 8);
    ctx.fillStyle = ratio > 0.5 ? COLORS.hp : ratio > 0.2 ? COLORS.hpLow : COLORS.hpDanger;
    ctx.fillRect(fromEdge(left, barWidth, hpFilled), 10, hpFilled, 8);

    // PP: under the HP bar, on the edge side. Marks every ¼ (one elemental special); purple when full (big ready).
    const ppWidth = 120;
    const ppLeft = f.id === 0 ? left : left + barWidth - ppWidth;
    const ppFilled = Math.round((ppWidth * f.pp) / PP_MAX);
    ctx.fillStyle = COLORS.ppBack;
    ctx.fillRect(ppLeft, 20, ppWidth, 4);
    ctx.fillStyle = f.pp >= PP_MAX ? COLORS.ppFull : COLORS.pp;
    ctx.fillRect(fromEdge(ppLeft, ppWidth, ppFilled), 20, ppFilled, 4);
    ctx.fillStyle = COLORS.panel;
    for (let mark = ELEMENTAL_COST; mark < PP_MAX; mark += ELEMENTAL_COST) {
      ctx.fillRect(ppLeft + Math.round((ppWidth * mark) / PP_MAX), 20, 1, 4);
    }

    // Name and the team: one square per Pokémon (dark = fainted, outlined = fighting now).
    ctx.font = '8px monospace';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = f.id === 0 ? 'left' : 'right';
    const label = `${f.name}  PP ${f.pp}`;
    ctx.fillText(label, f.id === 0 ? left : left + barWidth, 27);
    const team = battle.teams[f.id];
    team.forEach((member, i) => {
      const x = f.id === 0 ? left + i * 9 : left + barWidth - 6 - i * 9;
      ctx.fillStyle = member.hp > 0 ? typeColor(member.type) : COLORS.ko;
      ctx.fillRect(x, 37, 6, 6);
      if (i === battle.active[f.id]) {
        ctx.strokeStyle = COLORS.text;
        ctx.strokeRect(x - 0.5, 36.5, 7, 7);
      }
    });
  });

  // Timer.
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(String(Math.ceil(battle.round.timer / 60)).padStart(2, '0'), VIEW_W / 2, 6);
  ctx.font = '8px monospace';
  ctx.fillStyle = COLORS.dim;
  const p2 = view.opponent.startsWith('cpu-') ? `CPU ${view.opponent.slice(4)} · ${view.style}` : `dummy: ${view.opponent}`;
  ctx.fillText(`${p2}${view.infinitePp ? ' · ∞ PP' : ''}`, VIEW_W / 2, 24);

  ctx.fillText('WASD move · J tackle · K special · I big · L guard · Space dash', VIEW_W / 2, VIEW_H - 22);
  ctx.fillText('F1 debug · F2 opponent · F3 infinite PP · F4 CPU style · R reset', VIEW_W / 2, VIEW_H - 12);
}

// ── Phases: KO, choosing the next Pokémon, battle over ───────────────────────────────────────────────────────────

function drawPhase(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { battle } = view;
  ctx.textAlign = 'center';
  if (battle.phase === 'ko') {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 32px monospace';
    ctx.fillText(battle.round.timeOver ? 'TIME' : 'K.O.', VIEW_W / 2, 80);
    return;
  }
  if (battle.phase === 'choose') {
    const team = battle.teams[0];
    const top = 70;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(VIEW_W / 2 - 110, top - 8, 220, 24 + team.length * 16);
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Choose your next Pokémon (↑ ↓, J)', VIEW_W / 2, top);
    team.forEach((member, i) => {
      const y = top + 16 + i * 16;
      const selected = i === battle.cursor;
      ctx.fillStyle = member.hp === 0 ? COLORS.ko : selected ? COLORS.text : COLORS.dim;
      ctx.textAlign = 'left';
      ctx.fillText(`${selected ? '▶' : ' '} ${member.name}`, VIEW_W / 2 - 96, y);
      ctx.textAlign = 'right';
      ctx.fillText(member.hp === 0 ? 'fainted' : `${member.hp}/${member.maxHp}`, VIEW_W / 2 + 96, y);
    });
    return;
  }
  if (battle.phase === 'over') {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 20px monospace';
    const winner = battle.winner;
    ctx.fillText(winner === 'draw' ? 'Draw' : winner === 0 ? 'You win the battle!' : 'You lost the battle', VIEW_W / 2, 80);
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('Enter / Start: battle again', VIEW_W / 2, 108);
  }
}

// ── Debug overlay (F1) ────────────────────────────────────────────────────────────────────────────────────────────

function drawDebug(ctx: CanvasRenderingContext2D, view: SandboxView) {
  const { round } = view.battle;
  ctx.save();
  ctx.lineWidth = 1;
  for (const f of round.fighters) {
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
  ctx.strokeStyle = COLORS.hitbox;
  for (const p of round.projectiles) strokeBox(ctx, projectileBox(p));
  ctx.restore();

  ctx.font = '8px monospace';
  ctx.fillStyle = COLORS.text;
  round.fighters.forEach(f => {
    ctx.textAlign = f.id === 0 ? 'left' : 'right';
    const x = f.id === 0 ? 16 : VIEW_W - 16;
    ctx.fillText(describeAction(f), x, 48);
    ctx.fillText(`x ${(f.x / SUB).toFixed(1)} y ${(f.y / SUB).toFixed(1)} hp ${f.hp} combo ${f.combo}`, x, 58);
  });

  ctx.textAlign = 'center';
  ctx.fillText(`frame ${round.frame}${round.hitstop > 0 ? `  hitstop ${round.hitstop}` : ''}`, VIEW_W / 2, 36);
  if (view.advantage) {
    const { kind, value } = view.advantage;
    ctx.fillText(`on ${kind}: ${value > 0 ? '+' : ''}${value}`, VIEW_W / 2, 46);
  }
  if (view.cpu) ctx.fillText(`CPU ${view.cpu}`, VIEW_W / 2, 56);

  // Input history (player 1), newest on top.
  ctx.textAlign = 'left';
  view.history.forEach((entry, row) => {
    ctx.fillStyle = row === 0 ? COLORS.text : COLORS.dim;
    ctx.fillText(`${String(entry.frames).padStart(2)} ${describeInput(entry.mask)}`, 16, 72 + row * 10);
  });
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
