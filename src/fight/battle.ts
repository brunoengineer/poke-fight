// A battle: two teams of up to 6, one Pokémon each at a time, like the real games. Pure, like the fight itself.
//
//   fight  → a round between the two active Pokémon (fight/step.ts)
//   ko     → a round ended: the bodies fall for a moment
//   choose → player 1 picks a Pokémon (the opponent always sends the next one in its team order):
//              - 'fainted': its Pokémon fainted, it must pick another;
//              - 'next':    the opponent's fainted, it picks who fights the next round (the same one is fine);
//              - 'switch':  it asked to switch mid-round (requestSwitch); Guard / B / Esc or the same Pokémon cancels.
//   over   → one team has no Pokémon left
//
// Switching (decided after milestone 11): player 1 can switch once mid-round; after that, only once a Pokémon has
// fainted (on either side) can it switch again. A switch doesn't start a new round: the clock keeps running, the
// opponent stays where it is (doing what it was doing), and the new Pokémon comes in where the old one stood.
//
// The Pokémon that stays keeps the HP and PP it has left; a Pokémon coming in starts with half a PP bar. HP carries
// over to the team (and, later, out of the battle). After a faint, both start a new round from their starting
// positions.

import { PP_START, ROUND_FRAMES } from './constants';
import { Button, cleanDirections, has, type InputMask } from './input';
import { createFight, type FightEvent, type FightState, type FighterId, type FighterSetup } from './state';
import { step } from './step';

/** A Pokémon in a battle team: everything the fight needs except PP (each one enters with half a bar). */
export type TeamMember = Omit<FighterSetup, 'pp'>;

export type BattlePhase = 'fight' | 'ko' | 'choose' | 'over';

export type ChooseReason = 'fainted' | 'next' | 'switch';

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
  /** Why player 1 is choosing (only meaningful in the 'choose' phase). */
  chooseReason: ChooseReason;
  /** Player 1 can still switch mid-round (until it does; a faint gives it back). */
  switchReady: boolean;
  /** Who was fighting when the current round started (a Pokémon still there keeps its PP). */
  roundActive: [number, number];
  /** Player 1's input on the last frame (menu presses). */
  held: InputMask;
  winner: FighterId | 'draw' | null;
  /** Frames on each round's timer. */
  roundFrames: number;
  /** For each opponent (by team index), player 1's Pokémon that fought it: they share its XP (game/rewards.ts). */
  fought: number[][];
}

export type BattleEvent =
  | FightEvent
  | { type: 'roundStart'; round: number }
  /** Player 1 switched mid-round: a new Pokémon on its side, the round goes on. */
  | { type: 'switchIn'; side: FighterId }
  | { type: 'battleOver' };

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
    chooseReason: 'fainted',
    switchReady: true,
    roundActive: [active[0], active[1]],
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
      const switching = battle.chooseReason === 'switch';
      // Confirm: the tackle key, Enter, or a controller's A. (A also means "up" for the fight, so a press with
      // Confirm never moves the cursor.)
      const confirm = has(pressed, Button.Physical) || has(pressed, Button.Confirm);
      const cancel = has(pressed, Button.Guard) || has(pressed, Button.Cancel);
      if (switching && cancel) {
        battle.phase = 'fight';
      } else if (confirm) {
        if (switching && battle.cursor === battle.active[0]) {
          // The same Pokémon: nothing changes, the switch isn't used.
          battle.phase = 'fight';
        } else if (switching) {
          saveHp(battle);
          battle.switchReady = false;
          battle.active[0] = battle.cursor;
          switchIn(battle, events);
        } else {
          battle.active[0] = battle.cursor;
          // After a faint, the next round has a full clock.
          startRound(battle, events, battle.roundFrames);
        }
      } else {
        if (has(pressed, Button.Down)) battle.cursor = choices[(at + 1) % choices.length];
        if (has(pressed, Button.Up)) battle.cursor = choices[(at - 1 + choices.length) % choices.length];
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
  // A faint (on either side) gives player 1 its switch back.
  battle.switchReady = true;
  // The opponent sends its next Pokémon in team order.
  if (battle.teams[1][battle.active[1]].hp === 0) battle.active[1] = left[1][0];
  const fainted = battle.teams[0][battle.active[0]].hp === 0;
  // Player 1 picks who fights next: a replacement, or (with more than one able to fight) maybe a fresh Pokémon.
  if (fainted || left[0].length > 1) {
    battle.phase = 'choose';
    battle.phaseFrame = 0;
    battle.chooseReason = fainted ? 'fainted' : 'next';
    battle.cursor = fainted ? left[0][0] : battle.active[0];
    return;
  }
  startRound(battle, events, battle.roundFrames);
}

/**
 * Player 1 asks to switch mid-round: the fight pauses on the choose screen. Refused (and nothing changes) when the
 * switch was already used since the last faint, when nobody else can fight, or outside a running round.
 */
export function requestSwitch(previous: BattleState): { battle: BattleState; result: 'ok' | 'used' | 'alone' | 'busy' } {
  if (previous.phase !== 'fight' || previous.round.winner !== null) return { battle: previous, result: 'busy' };
  if (alive(previous.teams[0]).length < 2) return { battle: previous, result: 'alone' };
  if (!previous.switchReady) return { battle: previous, result: 'used' };
  const battle = structuredClone(previous);
  battle.phase = 'choose';
  battle.phaseFrame = 0;
  battle.chooseReason = 'switch';
  // The fighter's current HP shows on the menu (and must count if it is switched out).
  battle.teams[0][battle.active[0]].hp = battle.round.fighters[0].hp;
  battle.cursor = battle.active[0];
  return { battle, result: 'ok' };
}

/** Player 1 cancels a mid-round switch (Esc): back to the fight, the switch is still there. */
export function cancelSwitch(battle: BattleState): BattleState {
  if (battle.phase !== 'choose' || battle.chooseReason !== 'switch') return battle;
  return { ...battle, phase: 'fight' };
}

/**
 * The switch itself: the same round goes on. The new Pokémon stands where the old one stood (on the ground, ready),
 * with half a PP bar; the old one's projectiles vanish with it; the opponent is untouched.
 */
function switchIn(battle: BattleState, events: BattleEvent[]) {
  const round = battle.round;
  const old = round.fighters[0];
  const fresh = createFight({
    x: [old.x, round.fighters[1].x],
    fighters: [battle.teams[0][battle.active[0]], battle.teams[1][battle.active[1]]],
    pp: [PP_START, PP_START],
  }).fighters[0];
  fresh.facing = old.facing;
  round.fighters[0] = fresh;
  round.projectiles = round.projectiles.filter(p => p.owner !== 0);
  // It is the one fighting this round now (it keeps its PP if the round ends with it still standing).
  battle.roundActive[0] = battle.active[0];
  noteWhoFights(battle);
  battle.phase = 'fight';
  battle.phaseFrame = 0;
  events.push({ type: 'switchIn', side: 0 });
}

function startRound(battle: BattleState, events: BattleEvent[], timer: number) {
  const previous = battle.round;
  // A Pokémon still there from the last round keeps its PP; one coming in starts with half a bar.
  const pp = ([0, 1] as const).map(side =>
    battle.active[side] === battle.roundActive[side] && previous.fighters[side].hp > 0 ? previous.fighters[side].pp : PP_START,
  ) as [number, number];
  battle.round = newRound(battle.teams, battle.active, pp, timer);
  battle.roundActive = [battle.active[0], battle.active[1]];
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
