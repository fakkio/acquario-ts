/**
 * Seeded PRNG streams, per ADR-0007: one master seed splits into a global
 * stream plus per-organism child streams derived as `child.rngState =
 * parent.rng.next()`, so no lineage's sequence shifts when another part of
 * the simulation changes how many draws it consumes.
 *
 * Algorithm: mulberry32 (public domain). `state` is the Weyl-sequence
 * counter it carries between draws — the only thing that needs to survive
 * a serialise/hash round-trip.
 */

export interface RngStream {
  readonly state: number;
}

export interface RngDraw {
  readonly value: number;
  readonly stream: RngStream;
}

export interface ChildDerivation {
  readonly childStream: RngStream;
  readonly parentStream: RngStream;
}

export function createRngStream(seed: number): RngStream {
  return {state: seed >>> 0};
}

export function nextRng(stream: RngStream): RngDraw {
  const nextState = (stream.state + 0x6d2b79f5) | 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return {value, stream: {state: nextState >>> 0}};
}

export function deriveChildStream(stream: RngStream): ChildDerivation {
  const draw = nextRng(stream);
  const childSeed = Math.floor(draw.value * 4294967296) >>> 0;
  return {
    childStream: createRngStream(childSeed),
    parentStream: draw.stream,
  };
}

export interface UnitVectorDraw {
  readonly x: number;
  readonly y: number;
  readonly stream: RngStream;
}

/**
 * A uniformly distributed unit vector, by rejection sampling the unit disc:
 * draw a point in the square, keep it if it landed inside the circle,
 * normalise. Roughly a fifth of draws are thrown away, and the loop consumes
 * a number of draws that varies from tick to tick.
 *
 * The obvious alternative — draw an angle and take its cosine and sine — is
 * one draw and no loop, and it is rejected on ADR-0007's grounds. That ADR
 * settles for same-engine determinism precisely because `Math.sin` and
 * friends are implementation-defined to the last ulp, and records as the
 * consequence that v0.1's inner loop is left "using arithmetic only", so
 * the remaining gap to bit-portability is "one table to freeze rather than
 * an audit of every formula". Putting a transcendental in one of the
 * hottest loops in the simulation would not break the guarantee as stated,
 * but it would quietly cost that consequence. Every operation below is
 * drawn from the `+ − × ÷ sqrt` set the same ADR names as bit-identical
 * everywhere.
 *
 * The varying draw count costs nothing: per-organism streams are exactly
 * what ADR-0007 introduces so that changing how many numbers a caller
 * consumes cannot shift any other organism's sequence.
 *
 * Lives here rather than in `motion.ts`, which was its first and, until
 * M4, only caller (ADR-0019): a seeded random unit vector is `rng.ts`'s
 * business, and brownian motion using one is incidental to what the
 * function does. Mitosis's tangent-angle draw is the second caller.
 */
export function drawUnitVector(stream: RngStream): UnitVectorDraw {
  let current = stream;

  for (;;) {
    const drawX = nextRng(current);
    const drawY = nextRng(drawX.stream);
    current = drawY.stream;

    const x = drawX.value * 2 - 1;
    const y = drawY.value * 2 - 1;
    const lengthSquared = x * x + y * y;

    // Outside the disc would bias the direction toward the square's
    // corners; dead centre has no direction to point in at all.
    if (lengthSquared > 0 && lengthSquared <= 1) {
      const length = Math.sqrt(lengthSquared);
      return {x: x / length, y: y / length, stream: current};
    }
  }
}
