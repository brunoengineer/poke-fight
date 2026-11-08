// Seeded random numbers. The simulation never uses Math.random: the same seed and the same inputs must always give
// the same fight (replays, tests, debugging). The whole generator is one 32-bit number, so it can live in the state.

export interface Rng {
  /** A number in [0, 1). */
  next(): number;
  /** A whole number in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** The current state: createRng(rng.state) continues the same sequence. */
  readonly state: number;
}

/** mulberry32: tiny, fast and good enough for a game. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: maxExclusive => Math.floor(next() * maxExclusive),
    get state() {
      return state;
    },
  };
}
