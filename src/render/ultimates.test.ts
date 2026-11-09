// The big specials' drawings (plan.md §4.9): every form, in every type that has it, runs on every frame of a real
// fight (charge, attack, recovery) and draws something.

import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../fight/constants';
import type { BigShape } from '../fight/frame-data';
import { Button } from '../fight/input';
import { fightAt, on, run } from '../fight/testing';
import { BIG_SHAPES } from '../game/moves';
import { drawBigAttack, drawBigProjectile, drawBigTelegraph } from './ultimates';

function stubContext() {
  const drawn = { count: 0 };
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => gradient;
        if (key === 'fill' || key === 'stroke' || key === 'fillRect' || key === 'strokeRect') return () => drawn.count++;
        return () => {};
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  return { ctx, drawn };
}

// Path2D isn't in Node: a stand-in that accepts the same calls.
globalThis.Path2D ??= class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
} as unknown as typeof Path2D;

/** The forms drawn here (a plain projectile, a beam and a rush are the renderer's, as before), with every type. */
const OWN: readonly BigShape[] = ['quake', 'surf', 'tornado', 'barrage', 'solar', 'blizzard', 'burst', 'strike'];
const FORMS = Object.entries(BIG_SHAPES).flatMap(([type, shape]) => (OWN.includes(shape) ? [[shape, type] as const] : []));

describe('big special drawings', () => {
  it('every form draws on every frame of its move, for every type that has it', () => {
    expect(new Set(FORMS.map(([shape]) => shape))).toEqual(new Set(OWN));
    for (const [shape, type] of FORMS) {
      const state = fightAt(160, { pp: [PP_MAX, 50] });
      state.fighters[0].loadout.big = { name: 'Test', type, power: 100, category: 'special', shape };
      const r = run(110, on(Button.Big, 1), 0, state);
      let total = 0;
      for (const frame of r.frames) {
        const { ctx, drawn } = stubContext();
        for (const f of frame.fighters) {
          drawBigTelegraph(ctx, f, frame, 'floor');
          drawBigAttack(ctx, f);
          drawBigTelegraph(ctx, f, frame, 'front');
        }
        for (const p of frame.projectiles) drawBigProjectile(ctx, p, frame.frame);
        total += drawn.count;
      }
      expect(total, `${shape} (${type})`).toBeGreaterThan(0);
    }
  });

  it('only the big forms are drawn here: an elemental projectile is left to the plain drawing', () => {
    const state = fightAt(300);
    const r = run(20, on(Button.Special, 1), 0, state);
    const shot = r.frames.find(s => s.projectiles.length > 0)!.projectiles[0];
    expect(drawBigProjectile(stubContext().ctx, shot, 0)).toBe(false);
  });
});
