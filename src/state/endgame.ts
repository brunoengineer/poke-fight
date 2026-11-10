// The endgame save, for playtesting the late game locally (`npm run endgame`, the 'endgame' build mode): every
// region's League won, a strong team in each region, money and a full bag. It lives under its own storage key, so it
// never touches the real save, and the published build never contains it being used (only that mode reads it).

import { ITEMS, type ItemId } from '../data/items';
import { speciesBySlug } from '../data/pokedex';
import { REGIONS, region, type RegionId } from '../data/regions';
import type { Bag } from '../game/economy';
import { createPokemon, type Pokemon } from '../game/pokemon';
import { uniformIvs } from '../game/stats';
import type { Language } from '../i18n';
import { SAVE_VERSION, type RegionJourney, type Save } from './save';

export const ENDGAME_SAVE_KEY = 'poke-fight.endgame.save';

/** Each region's team (Lv. 70) and box (Lv. 40: some can still evolve with the bag's items). */
const TEAMS: Record<RegionId, { party: string[]; box: string[] }> = {
  kanto: {
    party: ['charizard', 'blastoise', 'venusaur', 'alakazam', 'gengar', 'dragonite'],
    // Mewtwo: a legendary in the box, to try its legendary move (↓↓ + attack). Pikachu and Lapras have signature moves.
    box: ['mewtwo', 'pikachu', 'eevee', 'kadabra', 'snorlax', 'lapras', 'scyther'],
  },
  johto: {
    party: ['typhlosion', 'feraligatr', 'meganium', 'tyranitar', 'ampharos', 'heracross'],
    box: ['togepi', 'murkrow', 'sneasel', 'slowpoke', 'onix', 'misdreavus'],
  },
  hoenn: {
    party: ['blaziken', 'swampert', 'sceptile', 'salamence', 'metagross', 'gardevoir'],
    box: ['kirlia', 'roselia', 'snorunt', 'absol', 'aron', 'trapinch'],
  },
  sinnoh: {
    party: ['infernape', 'empoleon', 'torterra', 'garchomp', 'lucario', 'staraptor'],
    box: ['riolu', 'shinx', 'budew', 'gible', 'starly', 'bidoof'],
  },
};

const PARTY_LEVEL = 70;
const BOX_LEVEL = 40;

const team = (slugs: string[], level: number): Pokemon[] => slugs.map(slug => createPokemon(speciesBySlug(slug).id, level, { ivs: uniformIvs(31) }));

/** Plenty of everything: balls, potions, every rod and evolution item, and Master Balls for the sanctuaries. */
function fullBag(): Bag {
  const bag: Bag = {};
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    const item = ITEMS[id];
    if (id === 'safari-ball') continue;
    bag[id] = item.kind === 'rod' ? 1 : id === 'master-ball' ? 10 : item.kind === 'evolution' ? 5 : 99;
  }
  return bag;
}

function journey(id: RegionId): RegionJourney {
  const r = region(id);
  const party = team(TEAMS[id].party, PARTY_LEVEL);
  const box = team(TEAMS[id].box, BOX_LEVEL);
  const owned = [...new Set([...party, ...box].map(p => p.speciesId))].filter(n => n <= r.lastSpecies);
  const starterId = r.starters[1];
  return {
    rival: { name: 'Ren', starterId: r.rivalPick[starterId] },
    starterId,
    prologue: 'done',
    location: r.league.city,
    party,
    box,
    money: 999_999,
    bag: fullBag(),
    dex: { seen: owned, caught: owned },
    badges: r.gyms.map(g => g.badge),
    champion: true,
  };
}

/** Every region's League won; the journey goes on in Kanto, at its League. */
export function endgameSave(createdAt: number, language: Language): Save {
  const ids = REGIONS.map(r => r.id);
  const [first, ...others] = ids;
  const here = journey(first);
  return {
    version: SAVE_VERSION,
    createdAt,
    settings: { language },
    player: { name: 'Kai' },
    ...here,
    region: first,
    champions: ids,
    away: Object.fromEntries(others.map(id => [id, journey(id)])),
    hallOfFame: ids.map((id, i) => ({
      at: createdAt + i,
      team: TEAMS[id].party.map(slug => ({ speciesId: speciesBySlug(slug).id, level: PARTY_LEVEL })),
      region: id,
    })),
  };
}
