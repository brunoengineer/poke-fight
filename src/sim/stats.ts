// Small statistics for the fight lab (docs/fight-lab.md): a win rate is only worth reading with its margin of error.

/** A proportion with its 95% confidence interval (Wilson score interval: honest with small samples and near 0 or 1). */
export interface Rate {
  /** Successes out of trials, and the observed rate. */
  k: number;
  n: number;
  p: number;
  lo: number;
  hi: number;
}

export function wilson(k: number, n: number, z = 1.96): Rate {
  if (n === 0) return { k, n, p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return { k, n, p, lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) };
}

/** Two rates differ for real (95%) when their intervals don't overlap: a cautious test, but simple to read. */
export const differs = (a: Rate, b: Rate) => a.hi < b.lo || b.hi < a.lo;

export const mean = (values: readonly number[]) => (values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length);

/** The value below which a fraction q (0–1) of the values fall. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

export const percent = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;
export const rateText = (r: Rate) => `${percent(r.p)} (${percent(r.lo)}–${percent(r.hi)})`;
