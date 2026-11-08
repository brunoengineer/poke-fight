// CPU profiles = difficulty × style.
//   - Difficulty is about skill: how late it sees you, how often it guards, anti-airs and punishes.
//   - Style is about personality: approach or keep away, specials, jumps, big specials.
// Later, each opponent in the journey gets one (wild Pokémon: easy; gym leaders: a style per type; League: hard).

export interface AiProfile {
  name: string;
  /** Frames between something happening and the CPU seeing it. */
  reaction: number;
  /** How long a neutral plan lasts before it thinks again (frames, min–max). */
  planFrames: readonly [number, number];
  /** Chance to guard a threat it sees coming (a projectile, a charging special, a close attack). */
  guard: number;
  /** Chance to answer a jump-in with a tackle. */
  antiAir: number;
  /** Chance to punish an opponent stuck in recovery nearby. */
  punish: number;
  /** 0–1: walks in and attacks vs waits. */
  aggression: number;
  /** 0–1: likes range specials and keeping its distance. */
  zoning: number;
  /** Chance to jump in when approaching / to jump over a projectile. */
  jump: number;
  /** Chance to use the big special when it is ready and fits. */
  big: number;
  /** 0–1: guards up close before anything happens (people can't react to a 5-frame tackle either). */
  caution: number;
}

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const STYLES = ['balanced', 'aggressive', 'defensive', 'zoner'] as const;
export type Style = (typeof STYLES)[number];

type Skill = Pick<AiProfile, 'reaction' | 'planFrames' | 'guard' | 'antiAir' | 'punish'>;
type Personality = Pick<AiProfile, 'aggression' | 'zoning' | 'jump' | 'big' | 'caution'>;

const SKILL: Record<Difficulty, Skill> = {
  easy: { reaction: 30, planFrames: [20, 50], guard: 0.15, antiAir: 0.1, punish: 0.1 },
  normal: { reaction: 18, planFrames: [12, 35], guard: 0.5, antiAir: 0.4, punish: 0.5 },
  hard: { reaction: 10, planFrames: [6, 20], guard: 0.85, antiAir: 0.75, punish: 0.85 },
};

const PERSONALITY: Record<Style, Personality> = {
  balanced: { aggression: 0.5, zoning: 0.4, jump: 0.25, big: 0.5, caution: 0.3 },
  aggressive: { aggression: 0.85, zoning: 0.15, jump: 0.35, big: 0.7, caution: 0.1 },
  defensive: { aggression: 0.3, zoning: 0.3, jump: 0.1, big: 0.4, caution: 0.7 },
  zoner: { aggression: 0.3, zoning: 0.9, jump: 0.1, big: 0.6, caution: 0.3 },
};

export function makeProfile(difficulty: Difficulty, style: Style = 'balanced'): AiProfile {
  return { name: `${difficulty} ${style}`, ...SKILL[difficulty], ...PERSONALITY[style] };
}
