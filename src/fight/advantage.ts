// Frame advantage: after a hit, how many frames earlier the attacker can act than the defender.
// +3 means the attacker is free 3 frames before the defender. Shown in the debug overlay, checked by tests.

import type { FightEvent, FightState, FighterId } from './state';

export interface AdvantageTracker {
  pending: { attacker: FighterId; defender: FighterId; attackerFree: number | null; defenderFree: number | null } | null;
  /** The last measured advantage, from the attacker's point of view. */
  last: number | null;
}

export const createAdvantageTracker = (): AdvantageTracker => ({ pending: null, last: null });

/** Call after every step with the new state and that step's events. */
export function trackAdvantage(tracker: AdvantageTracker, state: FightState, events: readonly FightEvent[]): AdvantageTracker {
  if (events.some(e => e.type === 'ko')) return { pending: null, last: tracker.last };
  const hit = events.findLast(e => e.type === 'hit');
  if (hit) {
    return { pending: { attacker: hit.attacker, defender: hit.defender, attackerFree: null, defenderFree: null }, last: tracker.last };
  }
  const pending = tracker.pending;
  if (!pending || state.hitstop > 0) return tracker;

  const next = { ...pending };
  if (next.attackerFree === null && state.fighters[next.attacker].actionable) next.attackerFree = state.frame;
  if (next.defenderFree === null && state.fighters[next.defender].actionable) next.defenderFree = state.frame;
  if (next.attackerFree !== null && next.defenderFree !== null) {
    return { pending: null, last: next.defenderFree - next.attackerFree };
  }
  return { pending: next, last: tracker.last };
}
