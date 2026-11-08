import { describe, expect, it } from 'vitest';
import { ROUND_FRAMES } from './constants';
import { Button } from './input';
import { createFight } from './state';
import { at, fightAt, on, run } from './testing';

/** A fight with only `frames` left on the clock. */
function endingIn(frames: number, hp: [number, number]) {
  const state = createFight({ hp });
  state.timer = frames;
  return state;
}

describe('round timer', () => {
  it('lasts 99 seconds', () => {
    expect(createFight().timer).toBe(99 * 60);
  });

  it('when time runs out, the Pokémon with the lower HP % faints', () => {
    const r = run(30, 0, 0, endingIn(10, [900, 1000]));
    expect(r.events.filter(e => e.frame === 10).map(e => e.type)).toEqual(['timeout', 'ko']);
    expect(r.final).toMatchObject({ winner: 1, timeOver: true });
    expect(r.final.fighters[0]).toMatchObject({ hp: 0, action: 'ko' });
    expect(r.final.fighters[1].hp).toBe(1000);
  });

  it('compares percentages, not raw HP', () => {
    const state = endingIn(5, [600, 700]);
    state.fighters[0].maxHp = 600; // 100% vs 70%
    expect(run(10, 0, 0, state).final.winner).toBe(0);
  });

  it('equal HP % is a draw: both faint', () => {
    expect(run(10, 0, 0, endingIn(5, [500, 500])).final.winner).toBe('draw');
  });

  it('stops during hitstop and after a KO', () => {
    const r = run(30, on(Button.Physical, 1), 0, fightAt(40));
    // Hit on frame 6, hitstop on frames 7–12: the clock ran on frames 1–6 only.
    expect(at(r, 12).timer).toBe(ROUND_FRAMES - 6);
    const ko = run(200, on(Button.Physical, 1), 0, fightAt(40, { hp: [1000, 10] }));
    expect(ko.final.timer).toBe(at(ko, 6).timer);
  });
});
