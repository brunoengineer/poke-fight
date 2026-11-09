// The endgame save (npm run endgame) must always load: if the save format changes, this fails until it is updated.

import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { endgameSave, ENDGAME_SAVE_KEY } from './endgame';
import { parseSave, serializeSave, switchRegion } from './save';
import { SAVE_KEY } from './store';

describe('the endgame save', () => {
  const save = endgameSave(1_800_000_000_000, 'en');

  it('loads like any save: every League won, a team of six in every region', () => {
    const loaded = parseSave(serializeSave(save));
    expect(loaded.status).toBe('ok');
    expect(save.champions).toEqual(REGIONS.map(r => r.id));
    for (const r of REGIONS) {
      const journey = r.id === save.region ? save : save.away[r.id]!;
      expect(journey.party, r.id).toHaveLength(6);
      expect(journey.badges, r.id).toHaveLength(8);
      expect(journey.champion).toBe(true);
      expect(journey.bag['master-ball']).toBeGreaterThan(0);
    }
  });

  it('every region can be travelled to', () => {
    for (const r of REGIONS) expect(switchRegion(save, r.id).region).toBe(r.id);
  });

  it('lives under its own key: the real save is never touched', () => {
    expect(ENDGAME_SAVE_KEY).not.toBe(SAVE_KEY);
  });
});
