import { describe, expect, it } from 'vitest';
import { BADGE_ORDER, CITY_ART, ELITE_SPRITES, KANTO_MAP, KANTO_ROUTES, LEADER_SPRITES, TRAINER_CLASSES, backdropUrl, badgeArt, itemUrl, trainerClassFor, typeBackdrop } from './art';
import { ELITE_FOUR, GYMS, KANTO } from './regions/kanto';

describe('art', () => {
  it("items use PokeAPI's sprites; the Link Cable is drawn as the later games' Linking Cord", () => {
    expect(itemUrl('potion')).toMatch(/items\/potion\.png$/);
    expect(itemUrl('link-cable')).toMatch(/items\/linking-cord\.png$/);
  });

  it('every city has a picture, a color and a place on the map; routes join real cities', () => {
    for (const c of KANTO) {
      expect(CITY_ART[c.id], c.id).toBeDefined();
      expect(KANTO_MAP[c.id], c.id).toBeDefined();
    }
    const ids = new Set(KANTO.map(c => c.id));
    for (const [a, b] of KANTO_ROUTES) expect(ids.has(a) && ids.has(b), `${a}–${b}`).toBe(true);
  });

  it('every gym leader and Elite Four member has a sprite; badges are numbered in gym order', () => {
    for (const g of GYMS) expect(LEADER_SPRITES[g.badge], g.badge).toBeTruthy();
    for (const e of ELITE_FOUR) expect(ELITE_SPRITES[e.id], e.id).toBeTruthy();
    expect(BADGE_ORDER).toEqual(GYMS.map(g => g.badge));
    expect(badgeArt('boulder')).toMatch(/badges\/1\.png$/);
    expect(badgeArt('earth')).toMatch(/badges\/8\.png$/);
  });

  it('a type picks a matching place (unknown types: the city; none: the arena)', () => {
    expect(typeBackdrop('fire')).toBe('volcanocave');
    expect(typeBackdrop('fairy')).toBe('city');
    expect(typeBackdrop(null)).toBe('spl');
    expect(backdropUrl('space')).toMatch(/bg-space\.jpg$/);
    expect(backdropUrl('route')).toMatch(/bg-route\.png$/);
  });

  it('a battle-field trainer class depends only on the team (the same team, the same trainer)', () => {
    expect(trainerClassFor([16, 19])).toBe(trainerClassFor([16, 19]));
    expect(TRAINER_CLASSES).toContain(trainerClassFor([25]));
  });
});
