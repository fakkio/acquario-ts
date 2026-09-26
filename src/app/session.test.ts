import {describe, expect, it} from "vitest";

import {createSession, isRestartDue} from "./session";

describe("createSession", () => {
  it("reproduces the same sequence of world seeds from the same master seed", () => {
    const a = createSession(12345);
    const b = createSession(12345);

    const seedsA = [a.nextWorldSeed(), a.nextWorldSeed(), a.nextWorldSeed()];
    const seedsB = [b.nextWorldSeed(), b.nextWorldSeed(), b.nextWorldSeed()];

    expect(seedsB).toEqual(seedsA);
  });

  it("draws a different sequence for a different master seed", () => {
    const a = createSession(1);
    const b = createSession(2);

    expect(a.nextWorldSeed()).not.toBe(b.nextWorldSeed());
  });

  it("draws a different seed on every call", () => {
    const session = createSession(42);

    expect(session.nextWorldSeed()).not.toBe(session.nextWorldSeed());
  });
});

describe("isRestartDue", () => {
  it("is due once the population is empty and auto-restart is on", () => {
    expect(isRestartDue(0, true)).toBe(true);
  });

  it("is never due with auto-restart off, however empty the population", () => {
    expect(isRestartDue(0, false)).toBe(false);
  });

  it("is not due while the population survives, whatever auto-restart is set to", () => {
    expect(isRestartDue(1, true)).toBe(false);
    expect(isRestartDue(1, false)).toBe(false);
  });
});
