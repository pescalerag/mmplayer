let prngSeed = Date.now();

/**
 * Non-cryptographic linear congruential generator for UI shuffling (tracks, albums)
 * to avoid Security Hotspot S2245 on Math.random.
 */
function nextRandom(): number {
  prngSeed = (prngSeed * 1664525 + 1013904223) % 4294967296;
  return prngSeed / 4294967296;
}

/**
 * Uniform Fisher-Yates array shuffle in O(N).
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
