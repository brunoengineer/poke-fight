// Frame advantage: after a hit or a block, how many frames earlier the attacker can act than the defender.
// +3 means the attacker is free 3 frames before the defender; -1 means the defender is free first (and can punish).
// Shown in the debug overlay, checked by tests.

import type { FightEvent, FightState, FighterId } from './state';

export type ContactKind = 'hit' | 'block';

export interface AdvantageTracker {
  pending: {
    kind: ContactKind;
    attacker: FighterId;
    defender: FighterId;
    attackerFree: number | null;
    defenderFree: number | null;
  } | null;
  /** The last measured advantage, from the attacker's point of view. */
  last: { kind: ContactKind; value: number } | null;
}

export const createAdvantageTracker = (): AdvantageTracker => ({ pending: null, last: null });

/** Call after every step with the new state and that step's events. */
export function trackAdvantage(tracker: AdvantageTracker, state: FightState, events: readonly FightEvent[]): AdvantageTracker {
  if (events.some(e => e.type === 'ko')) return { pending: null, last: tracker.last };
  const contact = events.findLast(e => e.type === 'hit' || e.type === 'block');
  if (contact && (contact.type === 'hit' || contact.type === 'block')) {
    return {
      pending: { kind: contact.type, attacker: contact.attacker, defender: contact.defender, attackerFree: null, defenderFree: null },
      last: tracker.last,
    };
  }
  const pending = tracker.pending;
  if (!pending || state.hitstop > 0) return tracker;

  const next = { ...pending };
  if (next.attackerFree === null && state.fighters[next.attacker].actionable) next.attackerFree = state.frame;
  if (next.defenderFree === null && state.fighters[next.defender].actionable) next.defenderFree = state.frame;
  if (next.attackerFree !== null && next.defenderFree !== null) {
    return { pending: null, last: { kind: next.kind, value: next.defenderFree - next.attackerFree } };
  }
  return { pending: next, last: tracker.last };
}
