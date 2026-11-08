// The PC box: Pokémon not in the party. Swapping is free in any city (decided after milestone 6), never during a fight.
// The party always keeps 1 to 6 Pokémon.

import type { Pokemon } from './pokemon';

export const MAX_PARTY = 6;

export interface Team {
  party: Pokemon[];
  box: Pokemon[];
}

export const canSendToBox = (team: Team) => team.party.length > 1;
export const canTakeFromBox = (team: Team) => team.party.length < MAX_PARTY;

export function sendToBox(team: Team, partyIndex: number): Team {
  if (!canSendToBox(team)) throw new Error('The party needs at least one Pokémon');
  const moved = team.party[partyIndex];
  return { party: team.party.filter((_, i) => i !== partyIndex), box: [...team.box, moved] };
}

export function takeFromBox(team: Team, boxIndex: number): Team {
  if (!canTakeFromBox(team)) throw new Error('The party is full');
  const moved = team.box[boxIndex];
  return { party: [...team.party, moved], box: team.box.filter((_, i) => i !== boxIndex) };
}

/** A caught Pokémon joins the party, or goes to the box when the party is full. */
export function addCaught(team: Team, caught: Pokemon): Team & { where: 'party' | 'box' } {
  return team.party.length < MAX_PARTY
    ? { party: [...team.party, caught], box: team.box, where: 'party' }
    : { party: team.party, box: [...team.box, caught], where: 'box' };
}
