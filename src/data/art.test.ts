import { describe, expect, it } from 'vitest';
import { TRAINER_CLASSES, backdropUrl, badgeUrl, itemUrl, trainerClassFor, typeBackdrop } from './art';

describe('art', () => {
  it("items use PokeAPI's sprites; the Link Cable is drawn as the later games' Linking Cord", () => {
    expect(itemUrl('potion')).toMatch(/items\/potion\.png$/);
    expect(itemUrl('link-cable')).toMatch(/items\/linking-cord\.png$/);
  });

  // Each place's look, the leaders' sprites and the map are checked per region (regions/regions.test.ts).
  it("badges are PokeAPI's numbered badge sprites", () => {
    expect(badgeUrl(1)).toMatch(/badges\/1\.png$/);
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
