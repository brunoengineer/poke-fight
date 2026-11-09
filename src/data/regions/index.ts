// The regions, in journey order. Each one is a file (kanto.ts, johto.ts…) exporting its Region (types.ts); a region
// whose file isn't written yet is null and simply not offered. Every id (city, badge, League member) is unique across
// regions, so a city, a gym or a picture can be found from its id alone.
//
// Journeys (decided after milestone 11): each region is its own journey (its own party, box, bag, money, badges and
// Pokédex, saved apart); the first region is open, and each next one opens when the previous region's League is won.

import { HOENN } from './hoenn';
import { JOHTO } from './johto';
import { KANTO } from './kanto';
import { SINNOH } from './sinnoh';
import type { City, Gym, Region, RegionId, TownPlan, CityArt } from './types';

export type { City, CityArt, Gym, HuntKind, League, LeagueMember, Legendary, Region, RegionId, RegionMap, Sanctuary, TownFeature, TownPlan } from './types';

/** Every region id, in journey order (written or not). */
export const REGION_IDS: readonly RegionId[] = ['kanto', 'johto', 'hoenn', 'sinnoh'];

const ALL: Record<RegionId, Region | null> = { kanto: KANTO, johto: JOHTO, hoenn: HOENN, sinnoh: SINNOH };

/** The regions that exist, in journey order. */
export const REGIONS: readonly Region[] = REGION_IDS.flatMap(id => (ALL[id] ? [ALL[id]] : []));

export const isRegion = (id: unknown): id is RegionId => typeof id === 'string' && (REGION_IDS as readonly string[]).includes(id);

export const hasRegion = (id: RegionId) => ALL[id] !== null;

export function region(id: RegionId): Region {
  const found = ALL[id];
  if (!found) throw new Error(`Region ${id} doesn't exist yet`);
  return found;
}

/** The region after this one (null at the end, or while it doesn't exist yet). */
export function nextRegion(id: RegionId): RegionId | null {
  const next = REGION_IDS[REGION_IDS.indexOf(id) + 1];
  return next && hasRegion(next) ? next : null;
}

/** A region is open from the start (the first), or once the one before it has been won (its League). */
export function regionOpen(id: RegionId, champions: readonly RegionId[]): boolean {
  const index = REGION_IDS.indexOf(id);
  return hasRegion(id) && (index === 0 || champions.includes(REGION_IDS[index - 1]));
}

/** The region a place belongs to (a city or a sanctuary). */
export function regionOf(placeId: string): Region {
  const found = REGIONS.find(r => r.sanctuary.id === placeId || r.cities.some(c => c.id === placeId));
  if (!found) throw new Error(`Unknown place ${placeId}`);
  return found;
}

export const isSanctuary = (placeId: string) => REGIONS.some(r => r.sanctuary.id === placeId);

/** A city, in any region. A sanctuary counts as one (its shop, no hunting grounds), so places work the same. */
export function city(id: string): City {
  for (const r of REGIONS) {
    const found = r.cities.find(c => c.id === id);
    if (found) return found;
    if (r.sanctuary.id === id) return { id, badges: 8, shop: r.sanctuary.shop, hunts: {} };
  }
  throw new Error(`Unknown city ${id}`);
}

export const hasCity = (id: string) => REGIONS.some(r => r.cities.some(c => c.id === id));

/** The gym in a city (any region), or null. */
export const gymIn = (cityId: string): Gym | null => REGIONS.flatMap(r => r.gyms).find(g => g.city === cityId) ?? null;

/** A gym by its badge (any region), or null. */
export const gymByBadge = (badge: string): Gym | null => REGIONS.flatMap(r => r.gyms).find(g => g.badge === badge) ?? null;

export const isUnlocked = (c: City, badges: number) => badges >= c.badges;

/** A place's look (a city or a sanctuary, any region). */
export function placeArt(id: string): CityArt {
  for (const r of REGIONS) {
    if (r.art[id]) return r.art[id];
    if (r.sanctuary.id === id) return r.sanctuary.art;
  }
  return { backdrop: 'route', color: '#6c8cff' };
}

/** A place's pixel-art town plan (a city or a sanctuary, any region). */
export function townPlan(id: string): TownPlan | null {
  for (const r of REGIONS) {
    if (r.towns[id]) return r.towns[id];
    if (r.sanctuary.id === id) return r.sanctuary.town;
  }
  return null;
}
