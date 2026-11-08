import { describe, expect, it } from 'vitest';
import { createFixedStep, MAX_STEPS_PER_ADVANCE, STEP_MS } from './loop';

function counter() {
  let steps = 0;
  const loop = createFixedStep(() => steps++);
  return { loop, steps: () => steps };
}

/** Feeds one second of real time in browser frames of this refresh rate. */
function runOneSecond(loop: ReturnType<typeof createFixedStep>, hz: number) {
  for (let i = 0; i < hz; i++) loop.advance(1000 / hz);
}

describe('fixed step', () => {
  it.each([30, 60, 75, 120, 144, 240])('runs 60 steps per second on a %i Hz monitor', hz => {
    const { loop, steps } = counter();
    runOneSecond(loop, hz);
    expect(steps()).toBe(60);
  });

  it('runs nothing until a whole step has passed', () => {
    const { loop, steps } = counter();
    expect(loop.advance(STEP_MS / 2)).toBe(0);
    expect(loop.advance(STEP_MS / 2)).toBe(1);
    expect(steps()).toBe(1);
  });

  it('after a long pause, runs a few steps and drops the rest instead of fast-forwarding', () => {
    const { loop, steps } = counter();
    expect(loop.advance(5000)).toBe(MAX_STEPS_PER_ADVANCE);
    // The backlog is gone: the next normal frame runs a single step.
    expect(loop.advance(STEP_MS)).toBe(1);
    expect(steps()).toBe(MAX_STEPS_PER_ADVANCE + 1);
  });

  it('ignores time going backwards', () => {
    const { loop, steps } = counter();
    loop.advance(-100);
    expect(loop.advance(STEP_MS)).toBe(1);
    expect(steps()).toBe(1);
  });
});
