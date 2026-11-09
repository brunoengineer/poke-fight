// The Pokédex's texts in the player's language: the kind of Pokémon ("Seed Pokémon") and its entry. English comes
// from PokeAPI (Red's Pokédex, through scripts/build-data.mjs); PokeAPI has no Portuguese for them, so dex-pt.json is
// this game's own translation, dex-pt.json for Kanto and dex-pt-gen<N>.json for the others (Pokémon names stay in
// English, like everywhere else).

import pt from './dex-pt.json';
import ptGen2 from './dex-pt-gen2.json';
import ptGen3 from './dex-pt-gen3.json';
import ptGen4 from './dex-pt-gen4.json';
import { species } from './pokedex';

export interface DexText {
  genus: string;
  entry: string;
}

// Portuguese, one file per generation (each one written for this game).
const TRANSLATIONS: Partial<Record<string, Record<string, DexText>>> = { pt: { ...pt, ...ptGen2, ...ptGen3, ...ptGen4 } as Record<string, DexText> };

export function dexText(id: number, language: string): DexText {
  const page = species(id).dex;
  return TRANSLATIONS[language]?.[String(id)] ?? { genus: page.genus, entry: page.entry };
}

/** Every species has a translation in every language there is one for (the tests check it). */
export const dexLanguages = (): string[] => Object.keys(TRANSLATIONS);
