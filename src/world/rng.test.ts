import {describe, expect, it} from "vitest";

import {
  createRngStream,
  deriveChildStream,
  drawUnitVector,
  nextRng,
} from "./rng";

describe("createRngStream + nextRng", () => {
  it("produces the same sequence of draws for the same seed", () => {
    const a = createRngStream(42);
    const b = createRngStream(42);

    const drawsA = [];
    const drawsB = [];
    let streamA = a;
    let streamB = b;
    for (let i = 0; i < 5; i++) {
      const drawA = nextRng(streamA);
      const drawB = nextRng(streamB);
      drawsA.push(drawA.value);
      drawsB.push(drawB.value);
      streamA = drawA.stream;
      streamB = drawB.stream;
    }

    expect(drawsA).toEqual(drawsB);
  });

  it("produces a different sequence for a different seed", () => {
    const a = createRngStream(1);
    const b = createRngStream(2);

    expect(nextRng(a).value).not.toBe(nextRng(b).value);
  });

  it("draws values in [0, 1)", () => {
    let stream = createRngStream(123);
    for (let i = 0; i < 50; i++) {
      const draw = nextRng(stream);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(1);
      stream = draw.stream;
    }
  });

  it("advances state on every draw, so consecutive draws differ", () => {
    const stream = createRngStream(7);
    const first = nextRng(stream);
    const second = nextRng(first.stream);

    expect(first.value).not.toBe(second.value);
  });
});

describe("deriveChildStream", () => {
  it("deterministically derives the same child seed from the same parent state", () => {
    const parentA = createRngStream(99);
    const parentB = createRngStream(99);

    const childA = deriveChildStream(parentA);
    const childB = deriveChildStream(parentB);

    expect(childA.childStream).toEqual(childB.childStream);
  });

  it("advances the parent stream as a side effect of deriving a child", () => {
    const parent = createRngStream(99);
    const {parentStream: advancedParent} = deriveChildStream(parent);

    expect(advancedParent).not.toEqual(parent);
    expect(advancedParent).toEqual(nextRng(parent).stream);
  });

  it("derives a different child seed for a different parent state", () => {
    const parentA = createRngStream(1);
    const parentB = createRngStream(2);

    expect(deriveChildStream(parentA).childStream).not.toEqual(
      deriveChildStream(parentB).childStream,
    );
  });
});

// Moved here from `motion.ts` (ADR-0019): a seeded random unit vector is
// this module's business, brownian motion's use of one is incidental. The
// rejection-sampling loop's own correctness — the disc it draws from, the
// bias the square's corners would add — was never under test by name before
// the move; it only had `applyBrownianMotion`'s step-length assertions in
// `motion.test.ts` exercising it indirectly. These are new coverage, not a
// relocation of existing tests.
describe("drawUnitVector", () => {
  it("draws a vector of unit length", () => {
    let stream = createRngStream(11);
    for (let i = 0; i < 200; i++) {
      const draw = drawUnitVector(stream);
      expect(Math.hypot(draw.x, draw.y)).toBeCloseTo(1, 12);
      stream = draw.stream;
    }
  });

  it("produces the same vector for the same stream", () => {
    const a = drawUnitVector(createRngStream(7));
    const b = drawUnitVector(createRngStream(7));

    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.stream).toEqual(b.stream);
  });

  it("covers more than one quadrant across many draws, rather than favouring one direction", () => {
    let stream = createRngStream(3);
    const quadrants = new Set<string>();

    for (let i = 0; i < 200; i++) {
      const draw = drawUnitVector(stream);
      stream = draw.stream;
      quadrants.add(`${draw.x >= 0 ? "+" : "-"}${draw.y >= 0 ? "+" : "-"}`);
    }

    expect(quadrants.size).toBe(4);
  });

  it("advances the stream it was handed rather than reusing its state", () => {
    const stream = createRngStream(7);
    const {stream: advanced} = drawUnitVector(stream);

    expect(advanced).not.toEqual(stream);
  });
});
