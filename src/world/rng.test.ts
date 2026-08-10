import {describe, expect, it} from "vitest";

import {createRngStream, deriveChildStream, nextRng} from "./rng";

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
