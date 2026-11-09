// The specials' looks by type (plan.md §4.9): every type has one, and every drawing runs for every type.

import { describe, expect, it } from 'vitest';
import { TYPE_COLORS } from './colors';
import { drawBeamLook, drawChargeLook, drawProjectileLook, ELEMENT_LOOKS, elementLook } from './elements';

/** A canvas context that accepts every call (and counts the shapes filled or stroked). */
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

describe('specials by type', () => {
  it('every type has its own look; a typeless move looks Normal', () => {
    for (const type of Object.keys(TYPE_COLORS)) expect(ELEMENT_LOOKS[type], type).toBeDefined();
    expect(elementLook(null)).toBe(ELEMENT_LOOKS.normal);
    expect(elementLook('nonsense')).toBe(ELEMENT_LOOKS.normal);
  });

  it('as asked: Fire throws a fireball, Water a bubble, Psychic purple energy', () => {
    expect(elementLook('fire').projectile).toBe('fireball');
    expect(elementLook('water').projectile).toBe('bubble');
    expect(elementLook('psychic').projectile).toBe('psyche');
    // Purple: more blue than green, and red and blue both strong (the type's badge color is pink, #f85888).
    const [r, g, b] = [1, 3, 5].map(i => parseInt(elementLook('psychic').colors[1].slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(200);
    expect(r).toBeGreaterThan(g);
  });

  it('dark energy (Ghost, Dark) is painted over the scene, with a light color for its glow', () => {
    for (const type of ['ghost', 'dark']) {
      const l = elementLook(type);
      expect(l.dark).toBe(true);
      const sum = [1, 3, 5].reduce((total, i) => total + parseInt(l.energy.slice(i, i + 2), 16), 0);
      expect(sum).toBeGreaterThan(400);
    }
  });

  it('every drawing runs for every type, both ways, on every frame of an animation (and draws something)', () => {
    for (const type of [...Object.keys(ELEMENT_LOOKS), null]) {
      for (const dir of [1, -1]) {
        for (let frame = 0; frame < 40; frame += 3) {
          const { ctx, drawn } = stubContext();
          drawProjectileLook(ctx, type, 100, 100, 8, dir, frame, 3);
          drawBeamLook(ctx, type, 100, 100 + dir * 216, 120, 132, frame);
          drawChargeLook(ctx, type, 100, 100, frame / 40, frame % 2 === 0, dir, frame, true);
          expect(drawn.count, `${type} ${dir} ${frame}`).toBeGreaterThan(3);
        }
      }
    }
  });
});
