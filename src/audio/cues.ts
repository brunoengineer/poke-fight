// Which sounds a fight frame makes. Pure: compares the frame with the one before (actions, the entrance) and reads
// the frame's events, so the rules are tested without Web Audio.

import type { BattleEvent } from '../fight/battle';
import type { BossAttackId } from '../fight/boss';
import type { ActionKind, Fighter } from '../fight/state';
import { ENTRANCE, type Entrance } from '../screens/entrance';

export type SoundId =
  | 'hit'
  | 'bigHit'
  | 'block'
  | 'parry'
  | 'charge'
  | 'ko'
  | 'jump'
  | 'dash'
  | 'select'
  | 'confirm'
  | 'ballThrow'
  | 'ballOpen'
  | 'shake'
  | 'caught'
  | 'levelUp'
  | 'bossWarn'
  | 'bossSweep'
  | 'bossBlast';

/** What the cues remember from the last frame. */
export interface CueMemory {
  actions: [ActionKind | null, ActionKind | null];
}

export const freshCues = (): CueMemory => ({ actions: [null, null] });

export interface FrameView {
  fighters: readonly [Fighter, Fighter];
  entrance: Entrance | null;
  /** Which sides have a trainer (who throws a ball); the other side's Pokémon is wild. */
  trainers: readonly [unknown, unknown];
}

export interface Cues {
  sounds: SoundId[];
  /** Species whose cry plays now (a Pokémon coming out). */
  cries: number[];
  memory: CueMemory;
}

const STARTS: Partial<Record<ActionKind, SoundId>> = {
  prejump: 'jump',
  dash: 'dash',
  backdash: 'dash',
  elemental: 'charge',
  big: 'charge',
};

/**
 * A boss attack's active part: the sweeping ones whoosh, the nova blasts. Meteors and shockwaves sound on each impact
 * instead (bossImpact).
 */
const BOSS_RELEASE: Partial<Record<BossAttackId, SoundId>> = { slash: 'bossSweep', nova: 'bossBlast', rampage: 'bossSweep', vortex: 'bossSweep' };

export function fightCues(memory: CueMemory, view: FrameView, events: readonly BattleEvent[]): Cues {
  const sounds: SoundId[] = [];
  const cries: number[] = [];

  const entrance = view.entrance;
  if (entrance) {
    const sides = [0, 1].filter(side => entrance.sides[side]);
    if (entrance.frame === ENTRANCE.throwStart && sides.some(side => view.trainers[side])) sounds.push('ballThrow');
    if (entrance.frame === ENTRANCE.burst) {
      if (sides.some(side => view.trainers[side])) sounds.push('ballOpen');
      for (const side of sides) {
        const id = view.fighters[side].speciesId;
        if (id !== null) cries.push(id);
      }
    }
  }

  for (const e of events) {
    if (e.type === 'hit') sounds.push(e.big || e.bonus ? 'bigHit' : 'hit');
    else if (e.type === 'block') sounds.push('block');
    else if (e.type === 'parry') sounds.push('parry');
    else if (e.type === 'ko') sounds.push('ko');
    else if (e.type === 'bossEnraged') sounds.push('bossWarn');
    else if (e.type === 'bossImpact') sounds.push('bossBlast');
    else if (e.type === 'bossAttack' && e.phase === 'telegraph') sounds.push('bossWarn');
    else if (e.type === 'bossAttack' && e.phase === 'active' && BOSS_RELEASE[e.attack]) sounds.push(BOSS_RELEASE[e.attack]!);
  }

  const actions: CueMemory['actions'] = [null, null];
  for (const f of view.fighters) {
    actions[f.id] = f.action;
    const sound = STARTS[f.action];
    if (sound && memory.actions[f.id] !== f.action) sounds.push(sound);
  }
  return { sounds: [...new Set(sounds)], cries, memory: { actions } };
}
