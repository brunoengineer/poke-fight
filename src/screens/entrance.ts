// The trainers' entrance (the plan's original idea): trainers stand at the edges of the arena and throw their Poké Balls;
// each ball bursts open and the Pokémon appears. Wild Pokémon leap in by themselves. The fight waits for it.
// Pure data and timing, shared by the fight screen (sandbox.ts) and the drawings (render/).

/** Frame marks of an entrance (60 per second). */
export const ENTRANCE = {
  /** The trainer winds up, then throws. */
  throwStart: 6,
  /** The ball lands and bursts open (the Pokémon's cry). */
  burst: 30,
  /** The Pokémon has fully grown out of the light. */
  grown: 46,
  /** "FIGHT!" from here to the end. */
  fightText: 48,
  total: 72,
} as const;

export interface Entrance {
  frame: number;
  /** Which sides are coming in (after a KO, only the replacement). */
  sides: [boolean, boolean];
  /** The battle's very first entrance (it ends with "FIGHT!"). */
  first: boolean;
}

/** How a trainer looks (colors of a small pixel figure). */
export interface TrainerLook {
  hair: string;
  top: string;
  bottom: string;
  skin?: string;
  cap?: string;
  cape?: string;
}

export const LOOKS = {
  player: { hair: '#3b2414', top: '#3a6df0', bottom: '#2b2f45', cap: '#e5404a' },
  rival: { hair: '#c58a3e', top: '#8a52e0', bottom: '#33304a' },
  trainer: { hair: '#1e1e2a', top: '#2fb39a', bottom: '#2a3044', cap: '#f2f2f2' },
  champion: { hair: '#c58a3e', top: '#8a52e0', bottom: '#33304a', cape: '#f2cf6a' },
} satisfies Record<string, TrainerLook>;

/** A gym leader or an Elite Four member: dressed in their type's color (with a cape for the Elite Four). */
export const leaderLook = (color: string, elite = false): TrainerLook => ({
  hair: '#2a2030',
  top: color,
  bottom: '#262a3e',
  cape: elite ? '#2a1a40' : undefined,
});
