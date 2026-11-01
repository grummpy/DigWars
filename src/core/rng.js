/** Mulberry32-style seeded RNG. Same seed always yields the same stream. */

export function makeRng(seed) {
  let t = seed >>> 0;
  if (t === 0) t = 0x6d2b79f5;
  return {
    next() {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      if (max <= 0) return 0;
      return Math.floor(this.next() * max);
    },
    state() {
      return t >>> 0;
    },
  };
}
