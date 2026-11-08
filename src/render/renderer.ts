// Draws one picture of the game. It only reads the state and never changes it.
// Milestone 0: a placeholder arena with two placeholder fighters, so we can see the screen and the scaling work.

import { VIEW_H, VIEW_W } from './screen';

export interface RenderView {
  frame: number;
}

const FLOOR_Y = 230;

export function render(ctx: CanvasRenderingContext2D, view: RenderView): void {
  ctx.imageSmoothingEnabled = false;

  // Sky and floor.
  ctx.fillStyle = '#1b2440';
  ctx.fillRect(0, 0, VIEW_W, FLOOR_Y);
  ctx.fillStyle = '#2f4a2a';
  ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);
  ctx.fillStyle = '#4f7a46';
  ctx.fillRect(0, FLOOR_Y, VIEW_W, 2);

  // Placeholder fighters: they gently bob, driven by the simulation frame (not by real time).
  // The bob only goes up (0 to 2 px), so feet never sink into the floor.
  const bob = (phase: number) => Math.round(1 - Math.cos((view.frame / 60 + phase) * Math.PI * 2));
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(120, FLOOR_Y - 48 - bob(0), 32, 48);
  ctx.fillStyle = '#d9534a';
  ctx.fillRect(VIEW_W - 152, FLOOR_Y - 48 - bob(0.5), 32, 48);

  // Title.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('POKÉ FIGHT', VIEW_W / 2, 60);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#9aa4c0';
  ctx.fillText('milestone 0: scaffold', VIEW_W / 2, 92);

  // Frame counter (top left), useful while we build the engine.
  ctx.textAlign = 'left';
  ctx.fillText(`frame ${view.frame}`, 4, 4);
}
