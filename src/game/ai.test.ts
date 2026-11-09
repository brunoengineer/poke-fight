// Each opponent Pokémon's CPU profile: wild ones are clumsy, trainers' ones better, evolved ones better still.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { createRng } from '../engine/rng';
import { makeProfile, skillAt } from '../fight/ai/profiles';
import { cpuProfile, evolutionStage, skillOf, styleOf, TWIST } from './ai';

const id = (slug: string) => speciesBySlug(slug).id;
const mon = (slug: string, level: number) => ({ speciesId: id(slug), level });

describe('the skill scale', () => {
  it('the difficulties are points on it, and 0 is below easy', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const { reaction, planFrames, guard, antiAir, punish } = makeProfile(d);
      const at = skillAt({ easy: 1 / 3, normal: 2 / 3, hard: 1 }[d]);
      expect(at).toMatchObject({ reaction, planFrames });
      expect(at.guard).toBeCloseTo(guard);
      expect(at.antiAir).toBeCloseTo(antiAir);
      expect(at.punish).toBeCloseTo(punish);
    }
    expect(skillAt(0).reaction).toBeGreaterThan(makeProfile('easy').reaction);
    expect(skillAt(0).guard).toBeLessThan(makeProfile('easy').guard);
  });
});

describe('opponent profiles', () => {
  it('counts evolution stages', () => {
    expect([evolutionStage(id('pidgey')), evolutionStage(id('pidgeotto')), evolutionStage(id('pidgeot'))]).toEqual([0, 1, 2]);
  });

  it('a wild Pokémon is clumsy; the same Pokémon is better with a trainer, and better still evolved', () => {
    const wild = skillOf(mon('pidgey', 5), { kind: 'wild' });
    const trainer = skillOf(mon('pidgey', 5), { kind: 'trainer', difficulty: 'normal' });
    const evolved = skillOf(mon('pidgeot', 5), { kind: 'trainer', difficulty: 'normal' });
    expect(wild).toBeLessThan(1 / 3);
    expect(trainer).toBeGreaterThan(wild);
    expect(evolved).toBeGreaterThan(trainer);
    expect(skillOf(mon('pidgey', 50), { kind: 'wild' })).toBeGreaterThan(wild);
  });

  it('the style comes from the stats: special attackers keep away, walls wait, fast hitters rush in', () => {
    expect(styleOf(speciesBySlug('alakazam').stats)).toBe('zoner');
    expect(styleOf(speciesBySlug('onix').stats)).toBe('defensive');
    expect(styleOf(speciesBySlug('primeape').stats)).toBe('aggressive');
  });

  it("a leader's style wins over the Pokémon's own", () => {
    const p = cpuProfile(mon('alakazam', 40), { kind: 'trainer', difficulty: 'hard', style: 'aggressive' }, createRng(1));
    expect(p.name).toContain('aggressive');
  });

  it('two of the same Pokémon get a slightly different personality', () => {
    const rng = createRng(7);
    const a = cpuProfile(mon('pidgey', 5), { kind: 'wild' }, rng);
    const b = cpuProfile(mon('pidgey', 5), { kind: 'wild' }, rng);
    expect(a.aggression).not.toBe(b.aggression);
    expect(a.reaction).toBe(b.reaction);
    const base = makeProfile('easy', 'balanced').aggression;
    expect(Math.abs(a.aggression - base)).toBeLessThanOrEqual(base * TWIST + 1e-9);
  });
});
