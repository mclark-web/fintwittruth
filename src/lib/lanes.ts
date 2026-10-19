/** Same floor Sports uses before it will name a best and a worst. */
export const BEST_WORST_MIN = 10;

export type LaneSplit<T> =
  | { ready: false; count: number; minimum: number }
  | { ready: true; best: T[]; worst: T[] };

/**
 * Top and bottom 30% by score. Below the minimum sample, the lanes stay empty
 * instead of padding the board with the only rows we have.
 */
export function bestWorst<T>(items: T[], score: (item: T) => number, minimum = BEST_WORST_MIN): LaneSplit<T> {
  if (items.length < minimum) return { ready: false, count: items.length, minimum };
  const ranked = [...items].sort((a, b) => score(b) - score(a));
  const cut = Math.max(1, Math.ceil(ranked.length * 0.3));
  const best = ranked.slice(0, cut);
  const used = new Set(best);
  const worst = ranked
    .slice(-cut)
    .filter((item) => !used.has(item))
    .reverse();
  return { ready: true, best, worst };
}
