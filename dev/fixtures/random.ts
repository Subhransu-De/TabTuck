// Seeded randomness, so a scenario and seed always build the same library.
export type Random = ReturnType<typeof random>;

export function random(seed: number) {
  // mulberry32
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ids = 0;
  return {
    next,
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    id: (prefix: string) => `${prefix}-${seed}-${++ids}`,
  };
}
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const capital = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);
