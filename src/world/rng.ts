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
