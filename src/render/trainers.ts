// Trainers at the edges of the arena and their Poké Balls, as small pixel figures painted by code.

import type { TrainerLook } from '../screens/entrance';
import { FLOOR_Y } from './stage';

/** Where each side's trainer stands. */
export const TRAINER_X: readonly [number, number] = [20, 460];

/** The hand that throws (where the ball starts). */
export const handOf = (side: 0 | 1) => ({ x: TRAINER_X[side] + (side === 0 ? 7 : -7), y: FLOOR_Y - 30 });

/**
 * A trainer, facing the arena. `throwing` (0–1) raises the throwing arm: 0 = down, 1 = arm up and forward.
 */
export function drawTrainer(ctx: CanvasRenderingContext2D, side: 0 | 1, look: TrainerLook, throwing: number) {
  const x = TRAINER_X[side];
  const facing = side === 0 ? 1 : -1;
  const skin = look.skin ?? '#f1c8a0';
  const r = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    // Mirror horizontally for the right side.
    ctx.fillRect(facing === 1 ? x + dx : x - dx - w, FLOOR_Y + dy, w, h);
  };
  ctx.save();
  ctx.globalAlpha = 0.95;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, FLOOR_Y + 1, 9, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.cape) r(-8, -26, 6, 22, look.cape);
  // Legs and shoes.
  r(-5, -12, 4, 11, look.bottom);
  r(1, -12, 4, 11, look.bottom);
  r(-6, -2, 5, 2, '#141420');
  r(1, -2, 5, 2, '#141420');
  // Body and back arm.
  r(-7, -25, 14, 14, look.top);
  r(-9, -24, 3, 10, look.top);
  r(-9, -14, 3, 2, skin);
  // Throwing arm: from down by the side to up and forward.
  if (throwing < 0.5) {
    r(6, -24, 3, 10, look.top);
    r(6, -14, 3, 2, skin);
  } else {
    r(6, -30, 3, 8, look.top);
    r(7, -33, 3, 3, skin);
  }
  // Head, hair, cap.
  r(-5, -34, 10, 9, skin);
  r(1, -31, 2, 2, '#1a1a22');
  r(-5, -35, 10, 3, look.hair);
  r(-6, -33, 2, 5, look.hair);
  if (look.cap) {
    r(-6, -38, 12, 4, look.cap);
    r(5, -35, 4, 2, look.cap);
  } else {
    // Spiky hair.
    r(-4, -38, 3, 3, look.hair);
    r(0, -39, 3, 4, look.hair);
    r(3, -37, 3, 2, look.hair);
  }
  ctx.restore();
}

/** A Poké Ball, turning as it flies. */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, radius = 4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#e8404a';
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(-radius, -0.5, radius * 2, 1);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
