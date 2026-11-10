// Gym trainers (decided 2026-11-10): two before every leader, of the gym's type, a little weaker than the leader.

import { describe, expect, it } from 'vitest';
import { species, speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { GYM_TRAINER_LEVELS, GYM_TRAINER_TEAM, gymTrainers } from './gym';

describe('gym trainers', () => {
  for (const region of REGIONS) {
    it(`${region.id}: every gym has two, of its type, below its leader, never below an evolution's level`, () => {
      for (const gym of region.gyms) {
        const trainers = gymTrainers(gym, region);
        const leaderMin = Math.min(...gym.team.map(([, level]) => level));
        expect(trainers, gym.leader).toHaveLength(2);
        trainers.forEach((trainer, t) => {
          expect(trainer.team, gym.leader).toHaveLength(GYM_TRAINER_TEAM);
          for (const p of trainer.team) {
            const s = species(p.speciesId);
            expect(s.types, `${gym.leader}: ${s.slug}`).toContain(gym.type);
            expect(p.level).toBe(Math.max(2, leaderMin - GYM_TRAINER_LEVELS[t]));
            expect(p.speciesId).toBeLessThanOrEqual(region.lastSpecies);
            if (s.evolvesFrom !== null) {
              const e = species(s.evolvesFrom).evolutions.find(x => x.to === s.id);
              if (e?.kind === 'level') expect(p.level, `${gym.leader}: ${s.slug}`).toBeGreaterThanOrEqual(e.level);
            }
          }
        });
      }
    });
  }

  it('are the same every time (and the second trainer is a little stronger)', () => {
    const kanto = REGIONS[0];
    const brock = kanto.gyms[0];
    expect(gymTrainers(brock, kanto)).toEqual(gymTrainers(brock, kanto));
    const [a, b] = gymTrainers(brock, kanto);
    expect(b.team[0].level).toBeGreaterThan(a.team[0].level);
    expect(a.cls).toBe('hiker');
    expect(speciesBySlug('geodude').types).toContain('rock');
  });
});
