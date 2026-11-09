// The generated data (scripts/build-data.mjs), checked against facts from the games.

import { describe, expect, it } from 'vitest';
import { allSpecies, hasSpecies, move, species, speciesBySlug, speciesUpTo, wildEncounters } from './pokedex';
import { effectiveness, TYPES } from './types';

describe('Gen 1 data', () => {
  it('has the 151 Kanto Pokémon, in order', () => {
    expect(speciesUpTo(151)).toEqual(Array.from({ length: 151 }, (_, i) => i + 1));
    expect([species(1).name, species(25).name, species(150).name, species(151).name]).toEqual(['Bulbasaur', 'Pikachu', 'Mewtwo', 'Mew']);
  });

  it('has modern types and base stats', () => {
    expect(species(1)).toMatchObject({ types: ['grass', 'poison'], stats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 } });
    // Modern typings (plan.md §4.5): Clefairy is Fairy, Magnemite is Electric/Steel.
    expect(speciesBySlug('clefairy').types).toEqual(['fairy']);
    expect(speciesBySlug('magnemite').types).toEqual(['electric', 'steel']);
    for (const s of allSpecies()) for (const t of s.types) expect(TYPES).toContain(t);
  });

  it('has catch rates, growth rates and base experience', () => {
    expect(speciesBySlug('pidgey')).toMatchObject({ captureRate: 255, growthRate: 'medium-slow' });
    expect(speciesBySlug('mewtwo')).toMatchObject({ captureRate: 3, legendary: true });
    for (const s of allSpecies()) expect(s.baseExperience).toBeGreaterThan(0);
  });

  it('has the Red/Blue level-up learnsets', () => {
    const charmander = speciesBySlug('charmander').learnset;
    expect(charmander).toContainEqual({ level: 9, move: 'ember' });
    expect(charmander).toContainEqual({ level: 38, move: 'flamethrower' });
    for (const s of allSpecies()) for (const entry of s.learnset) expect(() => move(entry.move)).not.toThrow();
  });

  it('has evolutions, only into Pokémon the game knows', () => {
    expect(speciesBySlug('charmander').evolutions).toEqual([{ to: 5, kind: 'level', level: 16 }]);
    expect(speciesBySlug('pikachu').evolutions).toEqual([{ to: 26, kind: 'item', item: 'thunder-stone' }]);
    expect(speciesBySlug('kadabra').evolutions).toEqual([{ to: 65, kind: 'trade' }]);
    expect(speciesBySlug('onix').evolutions).toEqual([{ to: 208, kind: 'trade', item: 'metal-coat' }]);
    // Eevee: Kanto's three stones, Johto's two friendship evolutions, Sinnoh's two (by place, so "other"). Sylveon
    // (Gen 6) is left out: the game has no data for it.
    expect(speciesBySlug('eevee').evolutions.map(e => e.to)).toEqual([134, 135, 136, 196, 197, 470, 471]);
    for (const s of allSpecies()) for (const e of s.evolutions) expect(hasSpecies(e.to)).toBe(true);
  });

  it('has Red/Blue wild encounters', () => {
    const pidgey = speciesBySlug('pidgey').encounters;
    expect(pidgey.some(e => e.area === 'kanto-route-1-area' && e.method === 'walk')).toBe(true);
    expect(speciesBySlug('mewtwo').encounters.length).toBeGreaterThan(0);
  });

  it("has the starters' gift moves and Struggle", () => {
    expect(move('ember')).toMatchObject({ type: 'fire', power: 40, category: 'special' });
    expect(move('bubble')).toMatchObject({ type: 'water', category: 'special' });
    expect(move('vine-whip')).toMatchObject({ type: 'grass', category: 'physical' });
    expect(move('struggle')).toMatchObject({ type: 'normal', power: 50, category: 'physical' });
  });
});

describe('Gen 2–4 data', () => {
  it('has the 493 Pokémon up to Sinnoh, in order', () => {
    const all = allSpecies();
    expect(all).toHaveLength(493);
    expect(all.map(s => s.id)).toEqual(Array.from({ length: 493 }, (_, i) => i + 1));
    expect([species(152), species(252), species(387), species(493)].map(s => s.name)).toEqual(['Chikorita', 'Treecko', 'Turtwig', 'Arceus']);
  });

  it("speciesUpTo: a region's Pokédex is every species up to its generation's last", () => {
    expect(speciesUpTo(251)).toHaveLength(251);
    expect(speciesUpTo(386)).toEqual(Array.from({ length: 386 }, (_, i) => i + 1));
    expect(speciesUpTo(493).at(-1)).toBe(493);
    expect(speciesUpTo(9999)).toHaveLength(493);
    expect(speciesUpTo(0)).toEqual([]);
  });

  it('every species has stats, a learnset from its own games and a Pokédex page', () => {
    for (const s of allSpecies()) {
      expect(Object.values(s.stats).every(n => n > 0), s.slug).toBe(true);
      expect(s.learnset.length, s.slug).toBeGreaterThan(0);
      for (const entry of s.learnset) expect(() => move(entry.move), entry.move).not.toThrow();
      expect(s.dex.genus, s.slug).toMatch(/Pokémon$/);
      expect(s.dex.heightM, s.slug).toBeGreaterThan(0);
      expect(s.dex.weightKg, s.slug).toBeGreaterThan(0);
      expect(s.dex.entry.length, s.slug).toBeGreaterThan(20);
      expect(s.dex.entry, s.slug).not.toContain('POKéMON');
    }
  });

  it("has modern data and the region games' learnsets (HeartGold/SoulSilver, Emerald, Platinum)", () => {
    expect(speciesBySlug('togepi').types).toEqual(['fairy']);
    expect(speciesBySlug('cyndaquil').learnset).toContainEqual({ level: 6, move: 'smokescreen' });
    expect(speciesBySlug('mudkip').learnset).toContainEqual({ level: 10, move: 'water-gun' });
    expect(speciesBySlug('turtwig').learnset).toContainEqual({ level: 5, move: 'withdraw' });
    expect(speciesBySlug('lucario').stats).toMatchObject({ atk: 110, spa: 115 });
    expect(speciesBySlug('arceus')).toMatchObject({ mythical: true, captureRate: 3 });
  });

  it('has the new evolutions: friendship, trades holding an item, the new stones', () => {
    expect(speciesBySlug('pichu').evolutions).toEqual([{ to: 25, kind: 'friendship' }]);
    expect(speciesBySlug('sunkern').evolutions).toEqual([{ to: 192, kind: 'item', item: 'sun-stone' }]);
    expect(speciesBySlug('murkrow').evolutions).toEqual([{ to: 430, kind: 'item', item: 'dusk-stone' }]);
    expect(speciesBySlug('clamperl').evolutions.map(e => e.kind)).toEqual(['trade', 'trade']);
    expect(speciesBySlug('pikachu').evolvesFrom).toBe(172);
  });
});

describe('wild encounters by region', () => {
  const redBlue = (version: string) => version === 'red' || version === 'blue';
  const at = (area: string, method = 'walk') =>
    new Set(wildEncounters().filter(e => e.area === area && e.method === method).map(e => species(e.speciesId).slug));

  it('Kanto keeps its Red/Blue tables (its species own encounters)', () => {
    expect(at('kanto-route-1-area')).toEqual(new Set(['pidgey', 'rattata']));
    const kanto = speciesUpTo(151).reduce((n, id) => n + species(id).encounters.length, 0);
    expect(wildEncounters().filter(e => redBlue(e.version))).toHaveLength(kanto);
  });

  it("no Kanto area gained later versions' encounters (HeartGold/SoulSilver's Kanto stays out)", () => {
    const kanto = new Set(wildEncounters().filter(e => redBlue(e.version)).map(e => e.area));
    const later = wildEncounters().filter(e => !redBlue(e.version));
    expect(later.filter(e => kanto.has(e.area) || e.area.startsWith('kanto-'))).toEqual([]);
  });

  it("each region's tables come from its own games, walking and fishing only", () => {
    const versions = [...new Set(wildEncounters().map(e => e.version))].sort();
    expect(versions).toEqual(['blue', 'diamond', 'emerald', 'heartgold', 'pearl', 'platinum', 'red', 'ruby', 'sapphire', 'soulsilver']);
    const later = wildEncounters().filter(e => !redBlue(e.version));
    for (const e of later) {
      expect(['walk', 'old-rod', 'good-rod', 'super-rod']).toContain(e.method);
      expect(e.chance).toBeGreaterThan(0);
      expect(e.minLevel).toBeLessThanOrEqual(e.maxLevel);
    }
    const upTo = (games: string[], last: number) => later.filter(e => games.includes(e.version)).every(e => e.speciesId <= last);
    expect(upTo(['heartgold', 'soulsilver'], 251)).toBe(true);
    expect(upTo(['ruby', 'sapphire', 'emerald'], 386)).toBe(true);
    expect(upTo(['diamond', 'pearl', 'platinum'], 493)).toBe(true);
  });

  it("Johto's Route 29 has Pidgey (a Kanto Pokémon, from HeartGold/SoulSilver) and Sentret walking", () => {
    const route29 = at('johto-route-29-area');
    expect(route29).toContain('pidgey');
    expect(route29).toContain('sentret');
  });

  it("Hoenn's Route 101 has Wurmple, Poochyena and Zigzagoon; Sinnoh's Route 201 has Starly and Bidoof", () => {
    expect(at('hoenn-route-101-area')).toEqual(new Set(['wurmple', 'poochyena', 'zigzagoon']));
    expect(at('sinnoh-route-201-area')).toContain('starly');
    expect(at('sinnoh-route-201-area')).toContain('bidoof');
  });

  it('leaves out swarms, the Poké Radar and the GBA slot (Route 201: no Doduo, Nidoran or Growlithe)', () => {
    const route201 = at('sinnoh-route-201-area');
    for (const slug of ['doduo', 'nidoran-f', 'growlithe']) expect(route201).not.toContain(slug);
  });

  it('has fishing in every region', () => {
    const rods = (version: string) => wildEncounters().filter(e => e.version === version && e.method !== 'walk');
    expect(rods('heartgold').some(e => e.method === 'old-rod' && e.speciesId === speciesBySlug('magikarp').id)).toBe(true);
    expect(rods('emerald').length).toBeGreaterThan(0);
    expect(rods('platinum').length).toBeGreaterThan(0);
  });
});

describe('type chart (modern, 18 types)', () => {
  it('has 18 types', () => {
    expect(TYPES).toHaveLength(18);
  });

  it.each([
    ['fire', ['grass'], 2],
    ['water', ['fire'], 2],
    ['grass', ['water'], 2],
    ['fire', ['water'], 0.5],
    ['electric', ['water'], 2],
    ['psychic', ['poison'], 2],
    ['fighting', ['rock'], 2],
    ['normal', ['normal'], 1],
    ['dragon', ['fairy'], 0],
    ['fairy', ['dragon'], 2],
  ] as const)('%s → %s = ×%s', (attack, defender, multiplier) => {
    expect(effectiveness(attack, defender)).toBe(multiplier);
  });

  it('immunities are ×0', () => {
    expect(effectiveness('normal', ['ghost'])).toBe(0);
    expect(effectiveness('ghost', ['normal'])).toBe(0);
    expect(effectiveness('electric', ['ground'])).toBe(0);
    expect(effectiveness('fighting', ['ghost', 'poison'])).toBe(0);
  });

  it('two types multiply: ×4 and ×¼', () => {
    expect(effectiveness('ice', ['dragon', 'flying'])).toBe(4); // Dragonite
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25); // Kabutops
    expect(effectiveness('rock', ['fire', 'flying'])).toBe(4); // Charizard
  });
});
