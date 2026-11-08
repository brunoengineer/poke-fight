import { describe, expect, it } from 'vitest';
import { DUMMY_ATTACK_EVERY } from '../fight/dummy';
import { Button } from '../fight/input';
import { createSandbox } from './sandbox';

describe('sandbox', () => {
  it('starts with a standing dummy and no debug overlay', () => {
    const view = createSandbox().view();
    expect(view).toMatchObject({ debug: false, dummy: 'stand' });
    expect(view.state.frame).toBe(0);
  });

  it('F2 cycles the dummy: stand → jump → attack → stand', () => {
    const sandbox = createSandbox();
    const modes = [0, 1, 2, 3].map(() => {
      const mode = sandbox.view().dummy;
      sandbox.cycleDummy();
      return mode;
    });
    expect(modes).toEqual(['stand', 'jump', 'attack', 'stand']);
  });

  it('a jumping dummy leaves the floor', () => {
    const sandbox = createSandbox();
    sandbox.cycleDummy();
    for (let i = 0; i < 10; i++) sandbox.tick(0);
    expect(sandbox.view().state.fighters[1].y).toBeGreaterThan(0);
  });

  it('an attacking dummy attacks on a fixed rhythm', () => {
    const sandbox = createSandbox();
    sandbox.cycleDummy();
    sandbox.cycleDummy();
    for (let i = 0; i < DUMMY_ATTACK_EVERY; i++) sandbox.tick(0);
    expect(sandbox.view().state.fighters[1]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('records player 1 input history and resets the fight', () => {
    const sandbox = createSandbox();
    for (let i = 0; i < 5; i++) sandbox.tick(Button.Right);
    expect(sandbox.view().history[0]).toEqual({ mask: Button.Right, frames: 5 });
    sandbox.reset();
    expect(sandbox.view().state.frame).toBe(0);
    expect(sandbox.view().state.fighters[0].x).toBe(createSandbox().view().state.fighters[0].x);
  });
});
