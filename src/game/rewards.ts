// What a battle gives: XP for every opponent knocked out, shared by the player's Pokémon that fought it and are still
// standing at the end (fainted Pokémon get none, as in the games).

import { species } from '../data/pokedex';
import type { BattleState } from '../fight/battle';
import { xpForDefeating } from './xp';

/** XP per player team index (only Pokémon that earned some). */
export function battleXp(battle: BattleState, trainer: boolean): Map<number, number> {
  const xp = new Map<number, number>();
  battle.teams[1].forEach((opponent, i) => {
    if (opponent.hp > 0 || opponent.speciesId === null) return;
    const earners = battle.fought[i].filter(mine => battle.teams[0][mine].hp > 0);
    if (earners.length === 0) return;
    const each = xpForDefeating(species(opponent.speciesId).baseExperience, opponent.level, trainer, earners.length);
    for (const mine of earners) xp.set(mine, (xp.get(mine) ?? 0) + each);
  });
  return xp;
}
