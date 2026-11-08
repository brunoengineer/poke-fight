// Entry point: sets up the screen, the fixed-step clock and (in test mode) the test hooks.

import { createFixedStep } from './engine/loop';
import { createRng } from './engine/rng';
import { render } from './render/renderer';
import { fitCanvas } from './render/screen';
import { installTestHooks, readTestOptions } from './test/hooks';

const options = readTestOptions(location.search);

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('missing #screen canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

const fit = () => fitCanvas(canvas, window.innerWidth, window.innerHeight);
fit();
window.addEventListener('resize', fit);

// The game state. For now it's only the frame counter; the fight state arrives in milestone 1.
const state = { frame: 0 };
// Not used yet: it's here so the seed plumbing (URL → game) is in place and tested from the start.
const rng = createRng(options.enabled ? options.seed : (Date.now() >>> 0));
void rng;

const simulate = () => {
  state.frame++;
};
const clock = createFixedStep(simulate);
const draw = () => render(ctx, state);

let last: number | undefined;
function onAnimationFrame(now: number) {
  if (!options.manualClock && last !== undefined) clock.advance(now - last);
  last = now;
  draw();
  requestAnimationFrame(onAnimationFrame);
}
requestAnimationFrame(onAnimationFrame);

if (options.enabled) {
  installTestHooks({
    frame: () => state.frame,
    step(frames) {
      if (!options.manualClock) throw new Error('step() needs the manual clock (remove &clock=real)');
      for (let i = 0; i < frames; i++) simulate();
      draw();
      return state.frame;
    },
    manualClock: options.manualClock,
    seed: options.seed,
  });
}
