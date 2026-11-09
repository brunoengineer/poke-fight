// Trainers at the edges of the arena and their Poké Balls. A trainer is their sprite (Showdown, data/art.ts) once it
// has loaded; until then (or offline, or in the browser tests) a small pixel figure painted by code.

import { trainerUrl } from '../data/art';
import type { TrainerLook } from '../screens/entrance';
import { getImage } from './images';
import { FLOOR_Y } from './stage';

/** Where each side's trainer stands. */
export const TRAINER_X: readonly [number, number] = [30, 450];

/** The hand that throws (where the ball starts). */
export const handOf = (side: 0 | 1) => ({ x: TRAINER_X[side] + (side === 0 ? 12 : -12), y: FLOOR_Y - 46 });

/** Trainer sprites are 80×80, feet a few pixels above the bottom. */
const SPRITE_SIZE = 80;
const FEET = 3;

/**
 * A trainer, facing the arena. `throwing` (0–1): 0 = standing, 1 = leaning into the throw.
 */
export function drawTrainer(ctx: CanvasRenderingContext2D, side: 0 | 1, look: TrainerLook, throwing: number) {
  const image = look.sprite ? getImage(trainerUrl(look.sprite)) : null;
  if (image) return drawTrainerSprite(ctx, side, image, throwing);
  drawPixelTrainer(ctx, side, look, throwing);
}

function drawTrainerSprite(ctx: CanvasRenderingContext2D, side: 0 | 1, image: HTMLImageElement, throwing: number) {
  const x = TRAINER_X[side];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, FLOOR_Y + 1, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, FLOOR_Y + FEET);
  // The sprites face the viewer, turned a little to their left: the right side's trainer is mirrored to face in.
  if (side === 1) ctx.scale(-1, 1);
  // Leaning into the throw, around the feet.
  ctx.rotate(throwing * 0.14);
  ctx.translate(throwing * 4, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -SPRITE_SIZE / 2, -SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE);
  ctx.restore();
}

function drawPixelTrainer(ctx: CanvasRenderingContext2D, side: 0 | 1, look: TrainerLook, throwing: number) {
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
