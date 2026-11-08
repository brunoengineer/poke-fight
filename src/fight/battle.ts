// A battle: two teams of up to 6, one Pokémon each at a time, like the real games. Pure, like the fight itself.
//
//   fight  → a round between the two active Pokémon (fight/step.ts)
//   ko     → a round ended: the bodies fall for a moment
//   choose → player 1 picks its next Pokémon (the opponent always sends the next one in its team order)
//   over   → one team has no Pokémon left
//
// The Pokémon that stays keeps the HP and PP it has left; a Pokémon coming in starts with half a PP bar. HP carries
// over to the team (and, later, out of the battle). Both start a new round from their starting positions.

import { PP_START, ROUND_FRAMES } from './constants';
import { Button, cleanDirections, has, type InputMask } from './input';
import { createFight, type FightEvent, type FightState, type FighterId, type FighterSetup } from './state';
import { step } from './step';

/** A Pokémon in a battle team: everything the fight needs except PP (each one enters with half a bar). */
export type TeamMember = Omit<FighterSetup, 'pp'>;

export type BattlePhase = 'fight' | 'ko' | 'choose' | 'over';

export interface BattleState {
  teams: [TeamMember[], TeamMember[]];
  /** Index in each team of the Pokémon fighting now. */
  active: [number, number];
  round: FightState;
  rounds: number;
  phase: BattlePhase;
  phaseFrame: number;
  /** Player 1's choice on the 'choose' screen. */
  cursor: number;
  /** Player 1's input on the last frame (menu presses). */
  held: InputMask;
  winner: FighterId | 'draw' | null;
  /** Frames on each round's timer. */
  roundFrames: number;
  /** For each opponent (by team index), player 1's Pokémon that fought it: they share its XP (game/rewards.ts). */
  fought: number[][];
}

export type BattleEvent = FightEvent | { type: 'roundStart'; round: number } | { type: 'battleOver' };

/** How long the bodies fall after a KO before the next Pokémon comes in. */
export const KO_DELAY = 90;

export const MAX_TEAM = 6;

const alive = (team: readonly TeamMember[]) => team.flatMap((m, i) => (m.hp > 0 ? [i] : []));

export interface BattleOptions {
  /** Each round's timer (default: 99 seconds; the Safari Zone is shorter). */
  roundFrames?: number;
}

export function createBattle(teams: readonly [readonly TeamMember[], readonly TeamMember[]], options: BattleOptions = {}): BattleState {
  if (teams.some(team => team.length === 0 || team.length > MAX_TEAM)) throw new Error('teams need 1 to 6 Pokémon');
  const copy = structuredClone(teams) as [TeamMember[], TeamMember[]];
  const active: [number, number] = [alive(copy[0])[0], alive(copy[1])[0]];
  if (active.some(i => i === undefined)) throw new Error('each team needs a Pokémon that can fight');
  const roundFrames = options.roundFrames ?? ROUND_FRAMES;
  const battle: BattleState = {
    teams: copy,
    active,
    round: newRound(copy, active, [PP_START, PP_START], roundFrames),
    rounds: 1,
    phase: 'fight',
    phaseFrame: 0,
    cursor: 0,
    held: 0,
    winner: null,
    roundFrames,
    fought: copy[1].map(() => []),
  };
  noteWhoFights(battle);
  return battle;
}

function newRound(teams: BattleState['teams'], active: [number, number], pp: [number, number], timer: number): FightState {
  return createFight({ pp, timer, fighters: [teams[0][active[0]], teams[1][active[1]]] });
}

export interface BattleStepResult {
  battle: BattleState;
  events: BattleEvent[];
}

export function battleStep(previous: BattleState, inputs: readonly [InputMask, InputMask]): BattleStepResult {
  const battle = structuredClone(previous);
  const events: BattleEvent[] = [];
  const p1 = cleanDirections(inputs[0]);
  const pressed = p1 & ~battle.held;
  battle.held = p1;

  switch (battle.phase) {
    case 'fight': {
      const result = step(battle.round, inputs);
      battle.round = result.state;
      events.push(...result.events);
      if (battle.round.winner !== null) {
        saveHp(battle);
        battle.phase = 'ko';
        battle.phaseFrame = 0;
      }
      break;
    }
    case 'ko': {
      // The round keeps running without inputs, so the bodies fall and land.
      battle.round = step(battle.round, [0, 0]).state;
      battle.phaseFrame++;
      if (battle.phaseFrame >= KO_DELAY) afterKo(battle, events);
      break;
    }
    case 'choose': {
      const choices = alive(battle.teams[0]);
      const at = Math.max(0, choices.indexOf(battle.cursor));
      if (has(pressed, Button.Down)) battle.cursor = choices[(at + 1) % choices.length];
      if (has(pressed, Button.Up)) battle.cursor = choices[(at - 1 + choices.length) % choices.length];
      if (has(pressed, Button.Physical)) {
        battle.active[0] = battle.cursor;
        startRound(battle, events);
      }
      break;
    }
    case 'over':
      break;
  }
  return { battle, events };
}

function saveHp(battle: BattleState) {
  for (const side of [0, 1] as const) {
    battle.teams[side][battle.active[side]].hp = battle.round.fighters[side].hp;
  }
}

function afterKo(battle: BattleState, events: BattleEvent[]) {
  const left = [alive(battle.teams[0]), alive(battle.teams[1])];
  if (left[0].length === 0 || left[1].length === 0) {
    battle.phase = 'over';
    battle.winner = left[0].length === 0 && left[1].length === 0 ? 'draw' : left[0].length === 0 ? 1 : 0;
    events.push({ type: 'battleOver' });
    return;
  }
  // The opponent sends its next Pokémon in team order.
  if (battle.teams[1][battle.active[1]].hp === 0) battle.active[1] = left[1][0];
  if (battle.teams[0][battle.active[0]].hp === 0) {
    battle.phase = 'choose';
    battle.phaseFrame = 0;
    battle.cursor = left[0][0];
    return;
  }
  startRound(battle, events);
}

function startRound(battle: BattleState, events: BattleEvent[]) {
  const previous = battle.round;
  // The Pokémon that stayed keeps its PP; one coming in starts with half a bar. (Only fainted Pokémon are replaced,
  // so a fighter with HP left is the same Pokémon.)
  const pp = ([0, 1] as const).map(side =>
    previous.fighters[side].hp > 0 ? previous.fighters[side].pp : PP_START,
  ) as [number, number];
  battle.round = newRound(battle.teams, battle.active, pp, battle.roundFrames);
  battle.rounds++;
  noteWhoFights(battle);
  battle.phase = 'fight';
  battle.phaseFrame = 0;
  events.push({ type: 'roundStart', round: battle.rounds });
}

function noteWhoFights(battle: BattleState) {
  const [mine, theirs] = battle.active;
  if (!battle.fought[theirs].includes(mine)) battle.fought[theirs].push(mine);
}

/** How many Pokémon a team still has. */
export const remaining = (team: readonly TeamMember[]) => alive(team).length;
