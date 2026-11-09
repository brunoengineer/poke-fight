// Generations 2–4 in the game: their evolutions (new stones, the Soothe Bell, the Link Cable for every trade), the
// regions' hunting tables, and their moves as specials.

import { describe, expect, it } from 'vitest';
import { EVOLUTION_ITEMS, ITEMS } from '../data/items';
import { allSpecies, move, speciesBySlug } from '../data/pokedex';
import { tableForAreas } from './encounters';
import { defaultSpecials, isDamaging, movesKnownAt, STRUGGLE } from './moves';
import { createPokemon } from './pokemon';
import { evolutionChain, evolveBy } from './pokedex';
import { evolve, itemEvolution } from './progress';

const id = (slug: string) => speciesBySlug(slug).id;
const at = (slug: string, level = 30) => createPokemon(id(slug), level);

describe('new evolution items', () => {
  it('are sold at 5000, like every evolution item (decided after milestone 13: plan.md §5, Economy)', () => {
    for (const stone of ['sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone'] as const) {
      expect(ITEMS[stone]).toEqual({ id: stone, kind: 'evolution', price: 5000 });
    }
    expect(ITEMS['soothe-bell']).toEqual({ id: 'soothe-bell', kind: 'evolution', price: 5000 });
    expect(EVOLUTION_ITEMS).toEqual(expect.arrayContaining(['sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone', 'soothe-bell']));
  });

  it('the new stones evolve their Pokémon', () => {
    expect(itemEvolution(at('sunkern'), 'sun-stone')).toMatchObject({ to: id('sunflora') });
    expect(itemEvolution(at('gloom'), 'sun-stone')).toMatchObject({ to: id('bellossom') });
    expect(itemEvolution(at('murkrow'), 'dusk-stone')).toMatchObject({ to: id('honchkrow') });
    expect(itemEvolution(at('togetic'), 'shiny-stone')).toMatchObject({ to: id('togekiss') });
    expect(itemEvolution(at('kirlia'), 'dawn-stone')).toMatchObject({ to: id('gallade') });
    expect(itemEvolution(at('murkrow'), 'sun-stone')).toBeNull();
  });

  it('the Soothe Bell evolves friendship evolutions', () => {
    expect(itemEvolution(at('pichu', 10), 'soothe-bell')).toMatchObject({ to: id('pikachu') });
    expect(itemEvolution(at('golbat'), 'soothe-bell')).toMatchObject({ to: id('crobat') });
    expect(itemEvolution(at('togepi', 10), 'soothe-bell')).toMatchObject({ to: id('togetic') });
    expect(itemEvolution(at('pikachu'), 'soothe-bell')).toBeNull();
    expect(itemEvolution({ ...at('pichu', 10), hp: 0 }, 'soothe-bell')).toBeNull();
  });

  it('the Link Cable evolves every trade evolution, holding an item or not', () => {
    expect(itemEvolution(at('onix'), 'link-cable')).toMatchObject({ to: id('steelix') });
    expect(itemEvolution(at('scyther'), 'link-cable')).toMatchObject({ to: id('scizor') });
    expect(itemEvolution(at('porygon2'), 'link-cable')).toMatchObject({ to: id('porygon-z') });
    expect(itemEvolution(at('kadabra'), 'link-cable')).toMatchObject({ to: id('alakazam') });
    expect(itemEvolution(at('sunkern'), 'link-cable')).toBeNull();
  });

  it('evolving into a later-generation species works like any evolution', () => {
    const steelix = evolve(at('onix'), id('steelix')).pokemon;
    expect(steelix.speciesId).toBe(id('steelix'));
    expect(steelix.hp).toBeGreaterThan(0);
  });
});

describe('evolutions as this game does them', () => {
  it('maps every kind: level, stone, Link Cable, Soothe Bell; "other" stays unsupported', () => {
    expect(evolveBy({ to: id('pikachu'), kind: 'friendship' })).toEqual({ kind: 'item', item: 'soothe-bell' });
    expect(evolveBy({ to: id('steelix'), kind: 'trade', item: 'metal-coat' })).toEqual({ kind: 'item', item: 'link-cable' });
    expect(evolveBy({ to: id('sunflora'), kind: 'item', item: 'sun-stone' })).toEqual({ kind: 'item', item: 'sun-stone' });
    expect(evolveBy({ to: id('magnezone'), kind: 'other' })).toBeNull();
    // An item the shops don't sell can't start an evolution.
    expect(evolveBy({ to: id('glaceon'), kind: 'item', item: 'ice-stone' })).toBeNull();
  });

  it('chains include the new stages: Pichu → Pikachu → Raichu, Zubat → Golbat → Crobat', () => {
    expect(evolutionChain(id('pikachu'))).toEqual([
      [{ speciesId: id('pichu'), by: null }],
      [{ speciesId: id('pikachu'), by: { kind: 'item', item: 'soothe-bell' } }],
      [{ speciesId: id('raichu'), by: { kind: 'item', item: 'thunder-stone' } }],
    ]);
    expect(evolutionChain(id('zubat')).map(stage => stage.map(s => s.speciesId))).toEqual([[41], [42], [169]]);
  });

  it('every supported evolution of the 493 uses an item the shops sell', () => {
    for (const s of allSpecies()) {
      for (const e of s.evolutions) {
        const by = evolveBy(e);
        if (by?.kind === 'item') expect(EVOLUTION_ITEMS, `${s.slug} → ${e.to}`).toContain(by.item);
      }
    }
  });
});

describe("the new regions' hunting tables", () => {
  const ids = (areas: string[], method: 'walk' | 'old-rod' | 'good-rod' | 'super-rod' = 'walk') =>
    new Set(tableForAreas(areas, method).map(e => e.speciesId));

  it("Johto's Route 29, Hoenn's Route 101 and Sinnoh's Route 201 have their games' Pokémon", () => {
    expect(ids(['johto-route-29-area'])).toEqual(new Set([16, 19, 161, 163])); // Pidgey, Rattata, Sentret, Hoothoot
    expect(ids(['hoenn-route-101-area'])).toEqual(new Set([261, 263, 265])); // Poochyena, Zigzagoon, Wurmple
    expect(ids(['sinnoh-route-201-area'])).toEqual(new Set([396, 399, 401])); // Starly, Bidoof, Kricketot
  });

  it("Kanto's tables are Red/Blue's only (Route 1: Pidgey and Rattata)", () => {
    expect(ids(['kanto-route-1-area'])).toEqual(new Set([16, 19]));
  });
});

describe('new moves as specials', () => {
  it('moves that knock out the user or need sleep are never specials', () => {
    for (const slug of ['memento', 'healing-wish', 'lunar-dance', 'snore', 'self-destruct', 'explosion', 'dream-eater']) {
      expect(isDamaging(slug), slug).toBe(false);
    }
    expect(isDamaging('aura-sphere')).toBe(true);
  });

  it('every species gets specials it knows (or Struggle) at any level', () => {
    for (const s of allSpecies()) {
      for (const level of [5, 50, 100]) {
        const known = movesKnownAt(s, level);
        const { elemental, big } = defaultSpecials(s, known);
        for (const slug of [elemental, big]) {
          expect(slug === STRUGGLE || known.includes(slug), `${s.slug} ${slug}`).toBe(true);
          expect(move(slug).power, `${s.slug} ${slug}`).not.toBeNull();
        }
      }
    }
  });
});
