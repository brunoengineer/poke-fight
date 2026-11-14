// The save: round trip, versions, validation, broken saves kept aside, storage that throws, and every fixture.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { createPokemon } from '../game/pokemon';
import { journeyOf, newSave, parseSave, SAVE_VERSION, serializeSave, switchRegion, type Save } from './save';
import { BROKEN_SAVE_KEY, createSaveStore, SAVE_KEY } from './store';

const party = () => [createPokemon(speciesBySlug('charmeleon').id, 30), createPokemon(speciesBySlug('kadabra').id, 30)];
const save = () =>
  newSave({ playerName: 'Ana', rivalName: 'Bia', starterId: 5, rivalStarterId: 7, party: party() }, 1_700_000_000_000, 'en');
const broken = (s: Save, change: (s: Save) => void) => {
  const copy = structuredClone(s);
  change(copy);
  return parseSave(JSON.stringify(copy));
};

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('save format', () => {
  it('survives a round trip', () => {
    const s = save();
    expect(parseSave(serializeSave(s))).toEqual({ status: 'ok', save: s });
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('no save yet is not an error', () => {
    expect(parseSave(null)).toEqual({ status: 'none' });
  });

  it('refuses garbage, saves from a newer version, and invalid content', () => {
    expect(parseSave('{not json')).toMatchObject({ status: 'broken', reason: 'unreadable' });
    expect(parseSave(JSON.stringify({ ...save(), version: SAVE_VERSION + 1 }))).toMatchObject({ status: 'broken', reason: 'newer' });
    expect(parseSave(JSON.stringify({ party: [] }))).toMatchObject({ status: 'broken', reason: 'invalid' });
    expect(broken(save(), s => (s.party = []))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.party[0].speciesId = 999))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.party[0].level = 101))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.party[0].hp = 99_999))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => s.party[0].moves.push('not-a-move'))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.party[0].specials.big = 'growl'))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.settings.language = 'fr' as never))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.player.name = ''))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.rival.name = 'A name that is far too long'))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.prologue = 'somewhere' as never))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.starterId = 999))).toMatchObject({ reason: 'invalid' });
  });

  it('a new journey starts in Pallet Town, with the rival tutorial still to play', () => {
    expect(save()).toMatchObject({ player: { name: 'Ana' }, rival: { name: 'Bia', starterId: 7 }, prologue: 'tutorial', location: 'pallet' });
  });

  it('version 1 saves (before the prologue existed) become a journey at Viridian City', () => {
    const v1 = readFileSync(new URL('./fixtures/save-v1-new-game.json', import.meta.url), 'utf8');
    const result = parseSave(v1);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.save).toMatchObject({ version: SAVE_VERSION, prologue: 'done', location: 'viridian', player: { name: 'Kai' } });
    // The same party; only the moves grow (version 7 teaches what the official learnsets add, after what it knew).
    const old = JSON.parse(v1).party as Save['party'];
    expect(result.save.party).toHaveLength(old.length);
    result.save.party.forEach((p, i) => {
      expect({ ...p, moves: old[i].moves }).toEqual(old[i]);
      expect(p.moves.slice(0, old[i].moves.length)).toEqual(old[i].moves);
    });
  });
});

describe('save version 3', () => {
  it('a new journey has the starting money, five Poké Balls and a Pokédex with both starters', () => {
    expect(save()).toMatchObject({ money: 3000, bag: { 'poke-ball': 5 }, dex: { seen: [5, 7], caught: [5] } });
  });

  it('version 2 saves get the starting money and balls, and a Pokédex of what they own', () => {
    const v2 = JSON.parse(readFileSync(new URL('./fixtures/save-v2-viridian.json', import.meta.url), 'utf8'));
    const result = parseSave(JSON.stringify(v2));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const owned = v2.party.map((p: { speciesId: number }) => p.speciesId);
    expect(result.save).toMatchObject({ version: SAVE_VERSION, money: 3000, bag: { 'poke-ball': 5 } });
    expect(result.save.dex.caught.sort()).toEqual([...new Set(owned)].sort());
    expect(result.save.dex.seen).toContain(v2.rival.starterId);
  });

  it('refuses bad money, unknown items and bad Pokédex entries', () => {
    expect(broken(save(), s => (s.money = -1))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => ((s.bag as Record<string, number>)['golden-banana'] = 1))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.bag = { 'poke-ball': 0 }))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => s.dex.caught.push(999))).toMatchObject({ reason: 'invalid' });
  });
});

describe('save version 4', () => {
  it('version 3 saves (before the gyms) have no badges', () => {
    const v3 = readFileSync(new URL('./fixtures/save-v3-pallet-starter.json', import.meta.url), 'utf8');
    const result = parseSave(v3);
    expect(result).toMatchObject({ status: 'ok', save: { version: SAVE_VERSION, badges: [] } });
  });

  it('only real badges, each once', () => {
    expect(broken(save(), s => (s.badges = ['boulder', 'cascade']))).toMatchObject({ status: 'ok' });
    expect(broken(save(), s => (s.badges = ['shiny']))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.badges = ['boulder', 'boulder']))).toMatchObject({ reason: 'invalid' });
  });
});

describe('save version 5', () => {
  it('a new journey is in Kanto, not Champion yet, with an empty Hall of Fame', () => {
    expect(save()).toMatchObject({ region: 'kanto', champion: false, hallOfFame: [] });
  });

  it('every older fixture reaches the current version', () => {
    const v4 = readFileSync(new URL('./fixtures/save-v4-team.json', import.meta.url), 'utf8');
    expect(parseSave(v4)).toMatchObject({ status: 'ok', save: { version: SAVE_VERSION, region: 'kanto', champion: false, hallOfFame: [] } });
  });

  it('refuses an unknown region or a broken Hall of Fame', () => {
    expect(broken(save(), s => (s.region = 'johto' as never))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.hallOfFame = [{ at: 1, team: [] }]))).toMatchObject({ reason: 'invalid' });
    expect(broken(save(), s => (s.hallOfFame = [{ at: 1, team: [{ speciesId: 6, level: 70 }] }]))).toMatchObject({ status: 'ok' });
  });
});

describe('save store', () => {
  it('writes and loads the save', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage);
    const s = save();
    store.write(s);
    expect(store.load()).toEqual({ status: 'ok', save: s });
  });

  it('keeps a broken save aside instead of losing it', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{oops');
    expect(createSaveStore(storage).load()).toMatchObject({ status: 'broken' });
    expect(storage.map.get(BROKEN_SAVE_KEY)).toBe('{oops');
    expect(storage.map.has(SAVE_KEY)).toBe(false);
  });

  it('still runs when storage is blocked (it just remembers nothing)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createSaveStore(throwing);
    expect(store.load()).toEqual({ status: 'none' });
    expect(() => store.write(save())).not.toThrow();
    expect(createSaveStore(null).load()).toEqual({ status: 'none' });
  });
});

describe('journeys in several regions (version 6)', () => {
  it('a Kanto Champion from version 5 has opened the next region; the Hall of Fame says where', () => {
    const v5 = readFileSync(new URL('./fixtures/save-v5-victory-road.json', import.meta.url), 'utf8');
    const result = parseSave(v5);
    if (result.status !== 'ok') throw new Error(JSON.stringify(result));
    const champion = JSON.parse(v5).champion === true;
    expect(result.save).toMatchObject({ version: SAVE_VERSION, region: 'kanto', champions: champion ? ['kanto'] : [], away: {} });
  });

  it('switching swaps whole journeys, and the player keeps their name, settings and champions', () => {
    const kanto: Save = { ...save(), prologue: 'done', location: 'pewter', badges: ['boulder'], money: 4321, champions: ['kanto'] };
    // A journey "in Johto" built by hand (no Johto data needed for the swap itself).
    const johtoJourney = { ...journeyOf(kanto), money: 99, badges: [], location: 'pallet' };
    const withAway: Save = { ...kanto, away: { johto: johtoJourney } };
    const there = switchRegion(withAway, 'johto');
    expect(there).toMatchObject({ region: 'johto', money: 99, badges: [], player: kanto.player, champions: ['kanto'] });
    expect(there.away.kanto).toMatchObject({ money: 4321, badges: ['boulder'], location: 'pewter' });
    expect(there.away.johto).toBeUndefined();
    const back = switchRegion(there, 'kanto');
    expect(back).toMatchObject({ region: 'kanto', money: 4321, badges: ['boulder'] });
    expect(back.away.johto).toMatchObject({ money: 99 });
    expect(() => switchRegion(kanto, 'hoenn')).toThrow();
  });

  it("refuses a journey whose badges or place belong to another region", () => {
    expect(broken(save(), s => (s.badges = ['zephyr']))).toMatchObject({ status: 'broken' });
    expect(broken(save(), s => (s.location = 'nowhere'))).toMatchObject({ status: 'broken' });
    expect(broken(save(), s => ((s as unknown as { champions: unknown }).champions = ['atlantis']))).toMatchObject({ status: 'broken' });
  });
});

describe('the official learnsets (version 7)', () => {
  const v6 = () => JSON.parse(readFileSync(new URL('./fixtures/save-v6-thin-moves.json', import.meta.url), 'utf8'));

  it("a Pokémon from version 6 learns the moves it missed, keeping what it knew and its specials", () => {
    const old = v6();
    const result = parseSave(JSON.stringify(old));
    if (result.status !== 'ok') throw new Error(JSON.stringify(result));
    // The box's Lv. 30 Psyduck knew only Scratch and Tail Whip (Red/Blue's list); now Water Gun, Confusion and the rest.
    const before = old.box[0];
    const after = result.save.box[0];
    expect(after.moves.slice(0, before.moves.length)).toEqual(before.moves);
    expect(after.moves).toEqual(expect.arrayContaining(['water-gun', 'confusion', 'disable']));
    expect(after.specials).toEqual(before.specials);
    expect(new Set(after.moves).size).toBe(after.moves.length);
    // Every Pokémon knows at least what a new one of its level would.
    for (const p of [...result.save.party, ...result.save.box]) {
      expect(p.moves).toEqual(expect.arrayContaining(createPokemon(p.speciesId, p.level).moves));
    }
  });

  it("the other regions' journeys learn too", () => {
    const old = v6();
    old.away = { johto: { ...journeyOf(old as Save), location: 'new-bark', badges: [], champion: false } };
    const result = parseSave(JSON.stringify(old));
    if (result.status !== 'ok') throw new Error(JSON.stringify(result));
    expect(result.save.away.johto!.box[0].moves).toEqual(result.save.box[0].moves);
  });
});

describe('fixtures (real saves kept for compatibility)', () => {
  const dir = new URL('./fixtures/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  it('there is at least one', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s still loads', file => {
    expect(parseSave(readFileSync(new URL(file, dir), 'utf8')).status).toBe('ok');
  });
});
