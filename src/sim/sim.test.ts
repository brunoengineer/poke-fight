// The fight lab (docs/fight-lab.md) must be trustworthy: a duel replays exactly, the statistics are right, and
// every experiment runs (here with tiny samples; `npm run sim` runs them for real).

import { describe, expect, it } from 'vitest';
import { makeProfile } from '../fight/ai/profiles';
import { speciesBySlug } from '../data/pokedex';
import { createPokemon, toFighter } from '../game/pokemon';
import { duel } from './duel';
import { economy } from './economy';
import { forms, ladder, matchup, mechanics, sides, styles } from './experiments';
import { differs, quantile, wilson } from './stats';

const side = (slug: string, difficulty: 'easy' | 'normal' | 'hard' = 'hard') => ({
  fighter: toFighter(createPokemon(speciesBySlug(slug).id, 50)),
  profile: makeProfile(difficulty),
});

describe('a duel', () => {
  it('is deterministic: the same sides and seed play the same fight', () => {
    const a = duel(side('charizard'), side('blastoise'), 7);
    const b = duel(side('charizard'), side('blastoise'), 7);
    expect(a).toEqual(b);
    expect(duel(side('charizard'), side('blastoise'), 8)).not.toEqual(a);
  });

  it('ends with a winner, and its numbers add up', () => {
    const r = duel(side('pikachu'), side('pikachu', 'easy'), 3);
    expect([0, 1, 'draw']).toContain(r.winner);
    for (const s of r.sides) {
      expect(Object.values(s.bySource).reduce((x, y) => x + y, 0)).toBe(s.damage);
      expect(s.hitsBySource.tackle + s.hitsBySource.air + s.hitsBySource.elemental + s.hitsBySource.big).toBe(s.hits);
    }
    expect(r.overcame).toBeGreaterThanOrEqual(0);
  });
});

describe('statistics', () => {
  it('a Wilson interval matches known values', () => {
    const r = wilson(50, 100);
    expect(r.p).toBe(0.5);
    expect(r.lo).toBeCloseTo(0.4038, 3);
    expect(r.hi).toBeCloseTo(0.5962, 3);
    expect(wilson(0, 10).lo).toBe(0);
  });

  it('two rates differ only when their intervals are apart', () => {
    expect(differs(wilson(50, 100), wilson(55, 100))).toBe(false);
    expect(differs(wilson(20, 100), wilson(80, 100))).toBe(true);
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });
});

describe('every experiment runs', () => {
  const tiny = { n: 2, seed: 1, level: 50 };
  it.each([
    ['sides', () => sides(tiny)],
    ['ladder', () => ladder(tiny)],
    ['styles', () => styles(tiny)],
    ['mechanics', () => mechanics(tiny)],
    ['forms', () => forms({ ...tiny, n: 1 })],
    ['matchup', () => matchup(tiny, 'charizard', 'blastoise')],
    ['economy', () => economy()],
  ])('%s', (_, run) => {
    const report = run();
    expect(report.tables.length).toBeGreaterThan(0);
    expect(Object.keys(report.metrics).length).toBeGreaterThan(0);
  });
});
