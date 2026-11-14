// Builds the game's Pokémon data from PokeAPI: `npm run data` (every generation) or `node scripts/build-data.mjs --gen 2`.
//
// Writes, and these files are committed (the game never calls PokeAPI; sprites are loaded by URL):
//   src/data/generated/gen<N>.json  species (stats, types, catch rate, growth, evolutions, level-up learnset,
//                                   wild encounters, and the Pokédex: genus, height, weight, entry), every move
//                                   those learnsets use, and (Gen 2 on) the region's wild encounter tables
//   src/data/generated/types.json   the type chart (modern, 18 types: decided in plan.md §4.5)
//
// Encounters and Pokédex entries come from the region's own games (Gen 1: Red/Blue; Gen 2: HeartGold/SoulSilver;
// Gen 3: Emerald, with Ruby/Sapphire encounters; Gen 4: Platinum, with Diamond/Pearl encounters). Learnsets come from
// HeartGold/SoulSilver for every species (decided 2026-11-14: the last official games with all 493 and full level-up
// lists; Red/Blue's were so thin that a Lv. 30 Psyduck knew only Scratch), then Platinum, then the region's own games.
// Types, stats and move data are the modern ones (what PokeAPI returns by default).
//
// `node scripts/build-data.mjs --learnsets` refreshes only the learnsets (and the moves they add) in the files already
// there, leaving everything else as it is.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Per generation: which games the learnsets (versionGroup), encounters (versions) and Pokédex entries (dexVersions, in
 * order of preference) come from.
 */
const SOURCES = {
  1: { versionGroup: 'red-blue', versions: ['red', 'blue'], dexVersions: ['red'] },
  2: { versionGroup: 'heartgold-soulsilver', versions: ['heartgold', 'soulsilver'], dexVersions: ['heartgold', 'soulsilver'] },
  3: { versionGroup: 'emerald', versions: ['ruby', 'sapphire', 'emerald'], dexVersions: ['emerald', 'ruby', 'sapphire'] },
  4: { versionGroup: 'platinum', versions: ['diamond', 'pearl', 'platinum'], dexVersions: ['platinum', 'diamond', 'pearl'] },
};

const genArg = process.argv.indexOf('--gen');
const gens = genArg >= 0 ? [Number(process.argv[genArg + 1])] : Object.keys(SOURCES).map(Number);

const cache = new Map();
async function get(url) {
  if (!url.startsWith('http')) url = `${API}/${url}`;
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
        return await response.json();
      } catch (error) {
        if (attempt >= 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 600 * attempt));
      }
    }
  })();
  cache.set(url, promise);
  return promise;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const idFromUrl = url => Number(url.match(/\/(\d+)\/?$/)[1]);
const english = list => list.find(x => x.language.name === 'en');
/** Moves arrive in download order: sorted, the file is the same on every run. */
const sortedKeys = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const STAT_KEYS = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };

/** The evolution requirement, preferring the source games' details. */
function evolutionMethod(details, versionGroup) {
  const d = details.find(x => x.version_group?.name === versionGroup) ?? details[0];
  if (!d) return { kind: 'other' };
  const trigger = d.trigger?.name;
  if (trigger === 'level-up' && d.min_level) return { kind: 'level', level: d.min_level };
  if (trigger === 'use-item' && d.item) return { kind: 'item', item: d.item.name };
  if (trigger === 'trade') return d.held_item ? { kind: 'trade', item: d.held_item.name } : { kind: 'trade' };
  if (trigger === 'level-up' && (d.min_happiness || d.min_affection)) return { kind: 'friendship' };
  return { kind: 'other' };
}

function walkChain(node, from, out, versionGroup) {
  const id = idFromUrl(node.species.url);
  out.set(id, {
    from,
    evolutions: node.evolves_to.map(next => ({ to: idFromUrl(next.species.url), ...evolutionMethod(next.evolution_details, versionGroup) })),
  });
  for (const next of node.evolves_to) walkChain(next, id, out, versionGroup);
}

async function buildTypes() {
  const list = (await get('type?limit=100')).results.map(t => t.name).filter(name => !['unknown', 'shadow', 'stellar'].includes(name));
  const chart = {};
  for (const name of list) {
    const relations = (await get(`type/${name}`)).damage_relations;
    const row = {};
    for (const t of relations.double_damage_to) row[t.name] = 2;
    for (const t of relations.half_damage_to) row[t.name] = 0.5;
    for (const t of relations.no_damage_to) row[t.name] = 0;
    chart[name] = row;
  }
  return { types: list, chart };
}

// --- Region encounter tables (Gen 2 on) ---

/** The ways of hunting the game has: walking (grass, caves) and the three rods. */
const HUNT_METHODS = ['walk', 'old-rod', 'good-rod', 'super-rod'];
const TIMES = ['time-morning', 'time-day', 'time-night'];
/** Story-time tables: before the National Dex, before the Trophy Garden's owner mentions a Pokémon. */
const USUAL = ['story-progress-before-national-dex', 'backlot-not-mentioned'];
/**
 * An ordinary day's encounters: any time of day, but no swarm, Poké Radar, GBA game in slot 2, Hoenn/Sinnoh radio
 * show, Bug-Catching Contest, weekday special, Safari Zone blocks… (PokeAPI marks the slots those replace with
 * "swarm-no", "radar-off", "slot2-none", "radio-off"…).
 */
const usualCondition = name => TIMES.includes(name) || USUAL.includes(name) || /-(no|off|none|inactive)$/.test(name);

/** location-area → its location's region and English name (cached). */
async function areaInfo(areaName) {
  const area = await get(`location-area/${areaName}`);
  const location = await get(area.location.url);
  return { region: location.region?.name ?? null, location: english(location.names)?.name ?? location.name };
}

/**
 * Every walk and rod encounter of species 1..lastId in the region's versions, inside the region (HeartGold/SoulSilver
 * also visit Kanto: those areas stay out). Entries with the same area, version, method, species and levels are merged
 * (chances summed). Where an area's table changes with the time of day (Gen 2 and 4), each entry's chance is summed
 * over morning, day and night, so an entry for all day weighs three times one for the morning only.
 */
async function regionEncounters(lastId, source, region, dropped) {
  const ids = Array.from({ length: lastId }, (_, i) => i + 1);
  const raw = (
    await mapLimit(ids, 12, async speciesId =>
      (await get(`pokemon/${speciesId}/encounters`)).flatMap(area =>
        area.version_details
          .filter(v => source.versions.includes(v.version.name))
          .flatMap(v =>
            v.encounter_details
              .filter(e => HUNT_METHODS.includes(e.method.name))
              .filter(e => {
                const odd = e.condition_values.map(c => c.name).filter(c => !usualCondition(c));
                for (const c of odd) dropped.set(c, (dropped.get(c) ?? 0) + 1);
                return odd.length === 0;
              })
              .map(e => ({
                area: area.location_area.name,
                version: v.version.name,
                method: e.method.name,
                speciesId,
                minLevel: e.min_level,
                maxLevel: e.max_level,
                chance: e.chance,
                times: e.condition_values.filter(c => TIMES.includes(c.name)).length,
              })),
          ),
      ),
    )
  ).flat();

  const areas = [...new Set(raw.map(e => e.area))];
  const info = new Map(await mapLimit(areas, 12, async name => [name, await areaInfo(name)]));
  const inRegion = raw.filter(e => info.get(e.area).region === region);

  const table = e => `${e.area}|${e.version}|${e.method}`;
  const timed = new Set(inRegion.filter(e => e.times > 0).map(table));
  const merged = new Map();
  for (const e of inRegion) {
    const chance = e.chance * (timed.has(table(e)) ? e.times || TIMES.length : 1);
    const key = `${table(e)}|${e.speciesId}|${e.minLevel}|${e.maxLevel}`;
    const found = merged.get(key);
    if (found) found.chance += chance;
    else merged.set(key, { area: e.area, version: e.version, method: e.method, speciesId: e.speciesId, minLevel: e.minLevel, maxLevel: e.maxLevel, chance });
  }
  const order = (a, b) =>
    a.area.localeCompare(b.area) ||
    a.version.localeCompare(b.version) ||
    HUNT_METHODS.indexOf(a.method) - HUNT_METHODS.indexOf(b.method) ||
    a.speciesId - b.speciesId ||
    a.minLevel - b.minLevel ||
    a.maxLevel - b.maxLevel;
  return [...merged.values()].sort(order);
}

/** The games learnsets come from, in order of preference (see the top of this file). */
const LEARNSET_GROUPS = ['heartgold-soulsilver', 'platinum'];

/** A Pokémon's level-up moves, in learning order, from the first games in LEARNSET_GROUPS that have it. */
function learnsetOf(pokemon, source, generation) {
  const levelUp = versionGroup =>
    pokemon.moves
      .flatMap(m =>
        m.version_group_details
          .filter(d => d.version_group.name === versionGroup && d.move_learn_method.name === 'level-up')
          .map(d => ({ level: d.level_learned_at, move: m.move.name })),
      )
      .sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  // (Deoxys has no Emerald learnset, Emerald's Deoxys being another form: the generation's other games fill in.)
  const groups = [...LEARNSET_GROUPS, source.versionGroup, ...generation.version_groups.map(v => v.name)];
  return groups.map(levelUp).find(l => l.length > 0) ?? [];
}

async function moveData(name) {
  const move = await get(`move/${name}`);
  return { name: english(move.names)?.name ?? name, type: move.type.name, power: move.power, category: move.damage_class.name };
}

/** --learnsets: the generation's file as it is, with every species' learnset fetched again (and its new moves). */
async function refreshLearnsets(gen) {
  const file = join(root, 'src', 'data', 'generated', `gen${gen}.json`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const generation = await get(`generation/${gen}`);
  const source = SOURCES[gen];
  await mapLimit(data.species, 12, async s => {
    s.learnset = learnsetOf(await get(`pokemon/${s.id}`), source, generation);
    process.stdout.write('.');
  });
  const needed = new Set([...data.species.flatMap(s => s.learnset.map(e => e.move)), 'ember', 'bubble', 'vine-whip', 'struggle']);
  const moves = {};
  await mapLimit([...needed].sort(), 12, async name => {
    moves[name] = data.moves[name] ?? (await moveData(name));
  });
  data.moves = sortedKeys(moves);
  let json = JSON.stringify(data, null, 1);
  if (data.encounters) json = json.replace(/\{\n\s*"area":[^{}]*\}/g, entry => JSON.stringify(JSON.parse(entry)));
  await writeFile(file, json + '\n');
  console.log(`\nGeneration ${gen}: learnsets refreshed, ${Object.keys(moves).length} moves (${file})`);
}

// --- One generation ---

async function build(gen) {
  const source = SOURCES[gen];
  if (!source) throw new Error(`No sources configured for generation ${gen}`);
  const generation = await get(`generation/${gen}`);
  const region = generation.main_region?.name ?? '';
  const ids = generation.pokemon_species.map(s => idFromUrl(s.url)).sort((a, b) => a - b);
  console.log(`Generation ${gen} (${region}): ${ids.length} species`);

  // Gen 2 on: the region's tables, for every species up to this generation (Johto's routes have Pidgey too).
  const dropped = new Map();
  const wild = gen === 1 ? null : await regionEncounters(ids[ids.length - 1], source, region, dropped);
  if (wild) {
    console.log(`Region encounters: ${wild.length} (left out: ${[...dropped].map(([c, n]) => `${c} ×${n}`).join(', ') || 'none'})`);
  }

  const chains = new Map();
  const moveNames = new Set();
  const species = await mapLimit(ids, 12, async id => {
    const [pokemon, info, encounters] = await Promise.all([get(`pokemon/${id}`), get(`pokemon-species/${id}`), get(`pokemon/${id}/encounters`)]);
    const chainId = idFromUrl(info.evolution_chain.url);
    if (!chains.has(chainId)) {
      const map = new Map();
      walkChain((await get(info.evolution_chain.url)).chain, null, map, source.versionGroup);
      chains.set(chainId, map);
    }
    const evolution = chains.get(chainId).get(id);

    const stats = {};
    for (const s of pokemon.stats) stats[STAT_KEYS[s.stat.name]] = s.base_stat;

    // Level-up moves in the source games, in learning order.
    const levelUp = versionGroup =>
      pokemon.moves
        .flatMap(m =>
          m.version_group_details
            .filter(d => d.version_group.name === versionGroup && d.move_learn_method.name === 'level-up')
            .map(d => ({ level: d.level_learned_at, move: m.move.name })),
        )
        .sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
    const learnset = learnsetOf(pokemon, source, generation);
    for (const entry of learnset) moveNames.add(entry.move);

    // Wild encounters in the source games. Gen 1: where, how (walking, surfing, fishing…), levels, chance. Gen 2 on:
    // this species' entries of the region's tables (the game reads the tables themselves).
    const ownWild = wild
      ? wild.filter(e => e.speciesId === id).map(({ speciesId, ...e }) => e)
      : encounters.flatMap(area =>
          area.version_details
            .filter(v => source.versions.includes(v.version.name))
            .flatMap(v =>
              v.encounter_details.map(e => ({
                area: area.location_area.name,
                version: v.version.name,
                method: e.method.name,
                minLevel: e.min_level,
                maxLevel: e.max_level,
                chance: e.chance,
              })),
            ),
        );

    // The Pokédex entry from the region's own games, as one line of plain text ("POKéMON" → "Pokémon").
    const flavor = version => info.flavor_text_entries.find(f => f.language.name === 'en' && f.version.name === version);
    const entry = source.dexVersions.map(flavor).find(Boolean) ?? info.flavor_text_entries.find(f => f.language.name === 'en');

    process.stdout.write('.');
    return {
      id,
      slug: info.name,
      name: english(info.names)?.name ?? info.name,
      types: pokemon.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
      stats,
      baseExperience: pokemon.base_experience,
      growthRate: info.growth_rate.name,
      captureRate: info.capture_rate,
      legendary: info.is_legendary,
      mythical: info.is_mythical,
      evolvesFrom: evolution.from,
      evolutions: evolution.evolutions,
      learnset,
      encounters: ownWild,
      dex: {
        genus: english(info.genera)?.genus ?? '',
        // PokeAPI: decimetres and hectograms.
        heightM: pokemon.height / 10,
        weightKg: pokemon.weight / 10,
        entry: (entry?.flavor_text ?? '').replace(/[\n\f­]+/g, ' ').replace(/\s+/g, ' ').replace(/POKéMON/g, 'Pokémon').trim(),
      },
    };
  });

  // Gift moves the game adds on top of the learnsets (the Professor teaches the starters their first type move).
  for (const gift of ['ember', 'bubble', 'vine-whip', 'struggle']) moveNames.add(gift);

  console.log(`\nMoves: ${moveNames.size}`);
  const moves = {};
  await mapLimit([...moveNames].sort(), 12, async name => {
    const move = await get(`move/${name}`);
    moves[name] = {
      name: english(move.names)?.name ?? name,
      type: move.type.name,
      power: move.power,
      category: move.damage_class.name,
    };
  });

  const dir = join(root, 'src', 'data', 'generated');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `gen${gen}.json`);
  const data = { generation: gen, region, versionGroup: source.versionGroup, species, moves: sortedKeys(moves) };
  if (wild) data.encounters = wild;
  let json = JSON.stringify(data, null, 1);
  // Gen 2 on: one encounter per line (there are thousands); Gen 1's file keeps its layout.
  if (wild) json = json.replace(/\{\n\s*"area":[^{}]*\}/g, entry => JSON.stringify(JSON.parse(entry)));
  await writeFile(file, json + '\n');
  console.log(`Wrote ${file}`);
}

async function main() {
  if (process.argv.includes('--learnsets')) {
    for (const gen of gens) await refreshLearnsets(gen);
    return;
  }
  for (const gen of gens) await build(gen);
  const types = await buildTypes();
  await writeFile(join(root, 'src', 'data', 'generated', 'types.json'), JSON.stringify(types, null, 1) + '\n');
  console.log('Wrote types.json');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
