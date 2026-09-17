/**
 * A session (ADR-0018, glossary: Session): every world run back to back in
 * one tab, each seeded from the one before. Not a world — a world is one
 * seed from creation to extinction; a session is the sequence of them.
 * Purely an App-layer concept: `src/world/` never restarts itself, and
 * nothing in it knows a session exists.
 */
export interface Session {
  /** Draws the next world's seed from the session stream, so one master
   * seed reproduces a whole sequence of worlds, extinctions included. */
  nextWorldSeed(): number;
}

/**
 * mulberry32, the same generator `world/rng.ts` runs for organism streams —
 * duplicated rather than imported. `src/world/` exposes exactly one public
 * seam, the barrel in `world/index.ts`, and `rng.ts` is not part of it; a
 * session seed and a world's own PRNG state serve different purposes, and
 * this one drives nothing a `World` ever reads back.
 */
function createDraw(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSession(masterSeed: number): Session {
  const draw = createDraw(masterSeed);

  return {
    nextWorldSeed() {
      return Math.floor(draw() * 4294967296) >>> 0;
    },
  };
}

/**
 * Whether an empty population and the auto-restart toggle together call for
 * a new world right now. Pure, so the restart policy is testable without a
 * `World` or a DOM — the manual "new world" control bypasses this
 * entirely and restarts on any click.
 */
export function isRestartDue(
  populationSize: number,
  autoRestartEnabled: boolean,
): boolean {
  return autoRestartEnabled && populationSize === 0;
}
