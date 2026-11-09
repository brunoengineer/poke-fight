// What a battle gives: XP for every opponent knocked out, shared by the player's Pokémon that fought it and are still
// standing at the end (fainted Pokémon get none, as in the games). A legendary is different (decided after milestone
// 11): beating one takes the whole team, so every Pokémon in the party gets the full XP, LEGENDARY_XP times over,
// fainted or not, whether it fought or not.

import { species } from '../data/pokedex';
import type { BattleState } from '../fight/battle';
import { xpForDefeating } from './xp';

/** How many times the normal XP each party Pokémon gets for a legendary. */
export const LEGENDARY_XP = 2;

/** XP per player team index (only Pokémon that earned some). `legendary`: everyone gets the full XP, times LEGENDARY_XP. */
export function battleXp(battle: BattleState, trainer: boolean, legendary = false): Map<number, number> {
  const xp = new Map<number, number>();
  if (legendary) {
    for (const opponent of battle.teams[1]) {
      if (opponent.hp > 0 || opponent.speciesId === null) continue;
      const each = xpForDefeating(species(opponent.speciesId).baseExperience, opponent.level, trainer, 1) * LEGENDARY_XP;
      battle.teams[0].forEach((_, mine) => xp.set(mine, (xp.get(mine) ?? 0) + each));
    }
    return xp;
  }
  battle.teams[1].forEach((opponent, i) => {
    if (opponent.hp > 0 || opponent.speciesId === null) return;
    const earners = battle.fought[i].filter(mine => battle.teams[0][mine].hp > 0);
    if (earners.length === 0) return;
    const each = xpForDefeating(species(opponent.speciesId).baseExperience, opponent.level, trainer, earners.length);
    for (const mine of earners) xp.set(mine, (xp.get(mine) ?? 0) + each);
  });
  return xp;
}
