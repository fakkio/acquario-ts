import {createRngStream, deriveChildStream, type RngStream} from "../world";

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

export function createSession(masterSeed: number): Session {
  let stream: RngStream = createRngStream(masterSeed);

  return {
    nextWorldSeed() {
      // Chaining world seeds is the same operation ADR-0007 already uses to
      // chain an organism's seed from its parent's stream — `deriveChildStream`
      // is reused rather than reimplemented, one PRNG for both.
      const {childStream, parentStream} = deriveChildStream(stream);
      stream = parentStream;
      return childStream.state;
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
