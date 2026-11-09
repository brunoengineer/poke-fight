// Every region, checked the same way: what a region file must have for the game to work (each new region gets these
// checks for free). Kanto is the reference; the others are added as their files are written.

import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { pt } from '../../i18n/pt';
import { isBossAttack } from '../../fight/boss';
import { hasEncounters, type Method } from '../../game/encounters';
import { isItemId } from '../items';
import { hasSpecies, move, species, speciesBySlug } from '../pokedex';
import { city, gymByBadge, isUnlocked, region, REGIONS, REGION_IDS, regionOpen, type Region } from './index';

const slugOk = (slug: string) => {
  try {
    speciesBySlug(slug);
    return true;
  } catch {
    return false;
  }
};

const teamOk = (team: readonly (readonly [string, number])[]) =>
  team.length > 0 && team.every(([slug, level]) => slugOk(slug) && Number.isInteger(level) && level >= 1 && level <= 100);

const texts = (keys: string[]) => keys.filter(key => !(key in en) || !(key in pt));

const places = (r: Region) => [...r.cities.map(c => c.id), r.sanctuary.id];

describe('every region', () => {
  it('ids are unique across regions (cities, sanctuaries, badges, League members)', () => {
    const all = (pick: (r: Region) => string[]) => REGIONS.flatMap(pick);
    for (const ids of [all(places), all(r => r.gyms.map(g => g.badge)), all(r => [...r.league.eliteFour.map(m => m.id), ...(r.league.champion.kind === 'member' ? [r.league.champion.id] : [])])]) {
      expect(new Set(ids).size, ids.join(',')).toBe(ids.length);
    }
    expect(REGIONS[0].id).toBe('kanto');
  });

  for (const r of REGIONS) {
    describe(r.id, () => {
      it('its Pokédex is every species up to its generation’s last', () => {
        expect(hasSpecies(r.lastSpecies)).toBe(true);
        expect(r.cities.length).toBeGreaterThanOrEqual(8);
      });

      it('cities: the first is open from the start; shops sell real items; every hunting area has Pokémon', () => {
        expect(r.cities[0].badges).toBe(0);
        for (const c of r.cities) {
          for (const item of c.shop ?? []) expect(isItemId(item), `${c.id}: ${item}`).toBe(true);
          for (const [kind, areas] of Object.entries(c.hunts)) {
            const methods: Method[] = kind === 'water' ? ['old-rod', 'good-rod', 'super-rod'] : ['walk'];
            for (const area of areas ?? []) expect(methods.some(m => hasEncounters(area, m)), `${c.id} ${kind}: ${area}`).toBe(true);
          }
          for (const area of c.safari ?? []) expect(hasEncounters(area, 'walk'), `${c.id} safari: ${area}`).toBe(true);
        }
      });

      it('8 gyms in badge order, each in a city that is open by the time it can be challenged', () => {
        expect(r.gyms).toHaveLength(8);
        expect(r.gyms.map(g => g.badges)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        for (const g of r.gyms) {
          expect(isUnlocked(city(g.city), g.badges), g.city).toBe(true);
          expect(teamOk(g.team), g.leader).toBe(true);
          expect(g.team.some(([slug]) => speciesBySlug(slug).types.includes(g.type)), `${g.leader} has a ${g.type} Pokémon`).toBe(true);
          expect(gymByBadge(g.badge)).toBe(g);
          expect(g.sprite, g.leader).toBeTruthy();
        }
        expect(new Set(r.gyms.map(g => g.badgeSprite)).size).toBe(8);
      });

      it('a League: 4 Elite Four and a Champion, in a city that needs 8 badges', () => {
        expect(city(r.league.city).badges).toBe(8);
        expect(r.league.eliteFour).toHaveLength(4);
        for (const m of r.league.eliteFour) expect(teamOk(m.team) && !!m.sprite, m.id).toBe(true);
        const champion = r.league.champion;
        if (champion.kind === 'rival') expect(Object.values(champion.teams).every(teamOk)).toBe(true);
        else expect(teamOk(champion.team) && !!champion.sprite).toBe(true);
      });

      it('starters: three of its own, each with a gift move and a rival pick among them', () => {
        expect(r.starters).toHaveLength(3);
        for (const id of r.starters) {
          expect(hasSpecies(id) && id <= r.lastSpecies).toBe(true);
          expect(() => move(r.starterGifts[id])).not.toThrow();
          expect(r.starters).toContain(r.rivalPick[id]);
        }
        expect(r.training.every(slugOk)).toBe(true);
      });

      it('every place has a look, a town and a spot on the map; roads join real places and reach everywhere', () => {
        for (const c of r.cities) {
          expect(r.art[c.id], c.id).toBeDefined();
          expect(r.towns[c.id], c.id).toBeDefined();
        }
        for (const id of places(r)) expect(r.map.places[id], id).toBeDefined();
        const ids = new Set(places(r));
        for (const [a, b] of r.map.routes) expect(ids.has(a) && ids.has(b), `${a}–${b}`).toBe(true);
        // Everything is reachable from the first city.
        const reached = new Set([r.cities[0].id]);
        for (let changed = true; changed; ) {
          changed = false;
          for (const [a, b] of r.map.routes) {
            if (reached.has(a) !== reached.has(b)) {
              reached.add(a);
              reached.add(b);
              changed = true;
            }
          }
        }
        expect([...ids].filter(id => !reached.has(id))).toEqual([]);
      });

      it('its sanctuary: legendaries (or mythicals) of its own, strong, with their boss attacks; it sells Master Balls', () => {
        expect(r.sanctuary.legendaries.length).toBeGreaterThanOrEqual(3);
        for (const l of r.sanctuary.legendaries) {
          const s = species(speciesBySlug(l.species).id);
          expect(s.legendary || s.mythical, l.species).toBe(true);
          expect(l.level).toBeGreaterThanOrEqual(40);
          expect(l.attacks.length, l.species).toBeGreaterThanOrEqual(2);
          expect(l.attacks.every(isBossAttack), `${l.species}: ${l.attacks.join(',')}`).toBe(true);
        }
        expect(r.sanctuary.shop).toContain('master-ball');
        // Its travel card shows three of them.
        const slugs = r.sanctuary.legendaries.map(l => l.species);
        expect(new Set(r.cover).size).toBe(3);
        for (const slug of r.cover) expect(slugs, slug).toContain(slug);
      });

      it('every text exists in both languages', () => {
        const keys = [
          `region.${r.id}`,
          ...places(r).flatMap(id => [`city.${id}`, `city.${id}.tagline`]),
          ...r.gyms.flatMap(g => [`badge.${g.badge}`, `leader.${g.badge}.intro`, `leader.${g.badge}.beaten`]),
          ...r.league.eliteFour.flatMap(m => [`elite.${m.id}.intro`, `elite.${m.id}.beaten`]),
          ...(r.league.champion.kind === 'member' ? [`elite.${r.league.champion.id}.intro`, `elite.${r.league.champion.id}.beaten`] : []),
        ];
        if (r.id !== 'kanto') keys.push(`region.${r.id}.welcome`, `region.${r.id}.choose`, `region.${r.id}.depart`);
        expect(texts(keys)).toEqual([]);
      });
    });
  }
});

describe('journeys between regions', () => {
  it('the first region is open; each next one opens with the previous League', () => {
    expect(regionOpen('kanto', [])).toBe(true);
    for (const [i, id] of REGION_IDS.entries()) {
      if (i === 0 || !REGIONS.some(r => r.id === id)) continue;
      expect(regionOpen(id, [])).toBe(false);
      expect(regionOpen(id, [REGION_IDS[i - 1]])).toBe(true);
    }
    expect(region('kanto').id).toBe('kanto');
  });
});
