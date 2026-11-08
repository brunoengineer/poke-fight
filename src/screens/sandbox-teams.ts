// Placeholder teams for the sandbox, one of each special shape, until real Pokémon arrive (milestone 4).
// Names are generic on purpose: these are rectangles with a type color, not Pokémon yet.

import type { TeamMember } from '../fight/battle';
import { MAX_HP } from '../fight/constants';

const member = (name: string, type: string, loadout: TeamMember['loadout']): TeamMember => ({
  name,
  type,
  maxHp: MAX_HP,
  hp: MAX_HP,
  loadout,
});

export const PLAYER_TEAM: TeamMember[] = [
  member('Flame', 'fire', {
    elemental: { name: 'Ember', type: 'fire', shape: 'projectile' },
    big: { name: 'Fire Blast', type: 'fire', shape: 'projectile' },
  }),
  member('Wave', 'water', {
    elemental: { name: 'Bubble Beam', type: 'water', shape: 'beam' },
    big: { name: 'Hydro Pump', type: 'water', shape: 'beam' },
  }),
  member('Brawler', 'normal', {
    elemental: { name: 'Swift', type: 'normal', shape: 'projectile' },
    big: { name: 'Take Down', type: 'normal', shape: 'rush' },
  }),
];

export const DUMMY_TEAM: TeamMember[] = [
  member('Sprout', 'grass', {
    elemental: { name: 'Razor Leaf', type: 'grass', shape: 'projectile' },
    big: { name: 'Solar Beam', type: 'grass', shape: 'beam' },
  }),
  member('Spark', 'electric', {
    elemental: { name: 'Thunder Shock', type: 'electric', shape: 'beam' },
    big: { name: 'Thunder', type: 'electric', shape: 'projectile' },
  }),
  member('Boulder', 'rock', {
    elemental: { name: 'Rock Throw', type: 'rock', shape: 'projectile' },
    big: { name: 'Double-Edge', type: 'normal', shape: 'rush' },
  }),
];
