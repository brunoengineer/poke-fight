// The PC box: Pokémon not in the party. Swapping is free in any city (decided after milestone 6), never during a fight.
// The party always keeps 1 to 6 Pokémon. Pokémon can be released from the box screen.

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

/**
 * Reorders the party: the Pokémon at `from` moves to `to`, swapping with the one there. The first one leads in
 * battle (decided in milestone 11: the party screen can reorder).
 */
export function swapInParty(party: readonly Pokemon[], from: number, to: number): Pokemon[] {
  if (from < 0 || to < 0 || from >= party.length || to >= party.length) throw new Error('No Pokémon there');
  const next = [...party];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export type Place = 'party' | 'box';

/** A place in the party or the box. An index at the end of the list (its length) is the empty place after it. */
export interface Spot {
  where: Place;
  index: number;
}

/**
 * Moving a held Pokémon (decided after milestone 12: the box picks a Pokémon up and puts it down). Onto another
 * Pokémon, the two swap places (in the party, the box, or between them: the party's size doesn't change). Onto the
 * empty place after a list, it moves there, if the party keeps 1 to 6.
 */
export function canPlace(team: Team, from: Spot, to: Spot): boolean {
  const target = team[to.where];
  if (!team[from.where][from.index] || to.index < 0 || to.index > target.length) return false;
  if (to.index < target.length || from.where === to.where) return true;
  return to.where === 'box' ? canSendToBox(team) : canTakeFromBox(team);
}

export function place(team: Team, from: Spot, to: Spot): Team {
  if (!canPlace(team, from, to)) throw new Error('It can’t go there');
  const lists = { party: [...team.party], box: [...team.box] };
  const moving = lists[from.where][from.index];
  if (to.index < lists[to.where].length) {
    lists[from.where][from.index] = lists[to.where][to.index];
    lists[to.where][to.index] = moving;
  } else {
    lists[from.where].splice(from.index, 1);
    lists[to.where].push(moving);
  }
  return lists;
}

/** Releasing (decided after milestone 11): any Pokémon in the box, or in the party as long as one stays there. */
export const canRelease = (team: Team, where: Place) => where === 'box' || team.party.length > 1;

/** The Pokémon goes back to the wild for good (the Pokédex still counts it as caught). */
export function release(team: Team, where: Place, index: number): Team {
  if (!canRelease(team, where)) throw new Error('The party needs at least one Pokémon');
  if (!team[where][index]) throw new Error('No Pokémon there');
  return where === 'party'
    ? { party: team.party.filter((_, i) => i !== index), box: team.box }
    : { party: team.party, box: team.box.filter((_, i) => i !== index) };
}
