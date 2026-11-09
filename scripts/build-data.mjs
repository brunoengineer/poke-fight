// Builds the game's Pokémon data from PokeAPI: `npm run data` (or `node scripts/build-data.mjs --gen 1`).
//
// Writes, and these files are committed (the game never calls PokeAPI; sprites are loaded by URL):
//   src/data/generated/gen<N>.json  species (stats, types, catch rate, growth, evolutions, level-up learnset,
//                                   wild encounters, and the Pokédex: genus, height, weight, entry) and every move
//                                   those learnsets use
//   src/data/generated/types.json   the type chart (modern, 18 types: decided in plan.md §4.5)
//
// Learnsets and encounters come from the region's own games (Gen 1: Red/Blue); types, stats and move data are the
// modern ones (what PokeAPI returns by default).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = Number(process.argv[process.argv.indexOf('--gen') + 1] || 1);

/** Per generation: which games the learnsets and encounters come from. */
const SOURCES = {
  1: { versionGroup: 'red-blue', versions: ['red', 'blue'] },
};

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

async function build() {
  const source = SOURCES[gen];
  if (!source) throw new Error(`No sources configured for generation ${gen}`);
  const generation = await get(`generation/${gen}`);
  const ids = generation.pokemon_species.map(s => idFromUrl(s.url)).sort((a, b) => a - b);
  console.log(`Generation ${gen} (${generation.main_region?.name}): ${ids.length} species`);

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
    const learnset = pokemon.moves
      .flatMap(m =>
        m.version_group_details
          .filter(d => d.version_group.name === source.versionGroup && d.move_learn_method.name === 'level-up')
          .map(d => ({ level: d.level_learned_at, move: m.move.name })),
      )
      .sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
    for (const entry of learnset) moveNames.add(entry.move);

    // Wild encounters in the source games: where, how (walking, surfing, fishing…), levels, chance.
    const wild = encounters.flatMap(area =>
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

    // The Pokédex entry from the region's own games (Red's), as one line of plain text.
    const entry = info.flavor_text_entries.find(f => f.language.name === 'en' && f.version.name === source.versions[0])
      ?? info.flavor_text_entries.find(f => f.language.name === 'en');

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
      encounters: wild,
      dex: {
        genus: english(info.genera)?.genus ?? '',
        // PokeAPI: decimetres and hectograms.
        heightM: pokemon.height / 10,
        weightKg: pokemon.weight / 10,
        entry: (entry?.flavor_text ?? '').replace(/[\n\f\u00ad]+/g, ' ').replace(/\s+/g, ' ').trim(),
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

  const types = await buildTypes();

  const dir = join(root, 'src', 'data', 'generated');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `gen${gen}.json`);
  await writeFile(
    file,
    JSON.stringify({ generation: gen, region: generation.main_region?.name ?? '', versionGroup: source.versionGroup, species, moves: sortedKeys(moves) }, null, 1) + '\n',
  );
  await writeFile(join(dir, 'types.json'), JSON.stringify(types, null, 1) + '\n');
  console.log(`Wrote ${file} and types.json`);
}

build().catch(error => {
  console.error(error);
  process.exit(1);
});
