// Entry point: sets up the screen, the inputs, the fixed-step clock and (in test mode) the test hooks.

import { readFirstPad } from './engine/input/gamepad';
import { attachKeyboard } from './engine/input/keyboard';
import { createKeyLatch } from './engine/input/keys';
import { createFixedStep } from './engine/loop';
import { render } from './render/renderer';
import { fitCanvas } from './render/screen';
import { createSandbox } from './screens/sandbox';
import { installTestHooks, readTestOptions } from './test/hooks';

const options = readTestOptions(location.search);

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('missing #screen canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

const fit = () => fitCanvas(canvas, window.innerWidth, window.innerHeight);
fit();
window.addEventListener('resize', fit);

const sandbox = createSandbox();
const keys = createKeyLatch();
const restartAfterBattle = () => {
  if (sandbox.view().battle.phase === 'over') sandbox.reset();
};
attachKeyboard(window, keys, {
  F1: () => sandbox.toggleDebug(),
  F2: () => sandbox.cycleDummy(),
  F3: () => sandbox.toggleInfinitePp(),
  KeyR: () => sandbox.reset(),
  Enter: restartAfterBattle,
});

// Inputs are read right before each simulated frame, so a press is used on the very next frame.
let startWasHeld = false;
const simulate = () => {
  const pad = readFirstPad();
  if (pad.start && !startWasHeld) restartAfterBattle();
  startWasHeld = pad.start;
  sandbox.tick(keys.sample() | pad.mask);
};
const clock = createFixedStep(simulate);
const draw = () => render(ctx, sandbox.view());

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
    frame: () => sandbox.view().battle.round.frame,
    step(frames) {
      if (!options.manualClock) throw new Error('step() needs the manual clock (remove &clock=real)');
      for (let i = 0; i < frames; i++) simulate();
      draw();
      return sandbox.view().battle.round.frame;
    },
    snapshot: () => structuredClone(sandbox.view().battle.round),
    battle: () => structuredClone(sandbox.view().battle),
    debug: () => {
      const view = sandbox.view();
      return { overlay: view.debug, dummy: view.dummy, infinitePp: view.infinitePp, advantage: view.advantage };
    },
    manualClock: options.manualClock,
    seed: options.seed,
  });
}
