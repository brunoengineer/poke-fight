// The regions, in journey order. A region is its cities, gyms and League (kanto.ts); a new one is added here.
// When a region's League is beaten, the journey can go on to the next one: the party, box, money and Pokédex come
// along, badges and the League start over (decided default, plan.md).

export const REGIONS = ['kanto'] as const;
export type RegionId = (typeof REGIONS)[number];

export const isRegion = (id: string): id is RegionId => (REGIONS as readonly string[]).includes(id);

/** The region after this one, or null while it doesn't exist yet. */
export function nextRegion(id: RegionId): RegionId | null {
  return REGIONS[REGIONS.indexOf(id) + 1] ?? null;
}
