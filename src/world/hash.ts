/**
 * FNV-1a plumbing, split out so the parts of the world that hold hashable
 * state can each fold their own fields into one running hash, rather than
 * `hashState` reaching into all of them to build a single string of the
 * whole world. `foldPopulation` in `organism.ts` is the first such part.
 *
 * Not a cryptographic hash and not meant to be: `hashState` compares two runs
 * of the same build for equality, so cheap and stable beats collision-proof.
 */

const FNV_PRIME = 0x01000193;

/** What a hash of nothing at all is: FNV-1a's offset basis. */
export const EMPTY_HASH = 0x811c9dc5;

export function foldString(hash: number, input: string): number {
  let folded = hash;
  for (let i = 0; i < input.length; i++) {
    folded ^= input.charCodeAt(i);
    folded = Math.imul(folded, FNV_PRIME);
  }

  return folded;
}

export function toHashString(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, "0");
}
