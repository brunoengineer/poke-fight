import { describe, expect, it } from 'vitest';
import { Button } from './input';
import { fightAt, on, run, TACKLE_DAMAGE } from './testing';

const J = Button.Physical;

describe('KO', () => {
  it('the hit that empties the HP bar wins the fight', () => {
    const r = run(60, on(J, 1), 0, fightAt(40, { hp: [1000, TACKLE_DAMAGE] }));
    expect(r.events.map(e => e.type)).toEqual(['hit', 'ko']);
    expect(r.final.winner).toBe(0);
    expect(r.final.fighters[1]).toMatchObject({ hp: 0, action: 'ko', y: 0 });
  });

  it('HP never goes below 0', () => {
    const r = run(60, on(J, 1), 0, fightAt(40, { hp: [1000, 10] }));
    expect(r.final.fighters[1].hp).toBe(0);
  });

  it('after a KO, inputs do nothing', () => {
    const r = run(120, f => (f === 1 ? J : Button.Right), 0, fightAt(40, { hp: [1000, TACKLE_DAMAGE] }));
    const afterKo = r.frames.slice(70);
    expect(new Set(afterKo.map(s => s.fighters[0].x)).size).toBe(1);
  });

  it('two hits on the same frame trade, and can end in a double KO', () => {
    const r = run(30, on(J, 1), on(J, 1), fightAt(40, { hp: [TACKLE_DAMAGE, TACKLE_DAMAGE] }));
    expect(r.events.filter(e => e.type === 'hit')).toHaveLength(2);
    expect(r.final.winner).toBe('draw');
  });
});
