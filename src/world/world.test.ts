import {describe, expect, it} from "vitest";

import {FIXED_DT_MS, advance, createWorld, getTick, hashState} from "./world";

describe("createWorld + advance + hashState determinism", () => {
  it("produces the same sequence of state hashes for the same seed and the same advance calls", () => {
    const stepsMs = [FIXED_DT_MS, 2.5 * FIXED_DT_MS, 0, FIXED_DT_MS * 3];

    const runOnce = () => {
      let world = createWorld(1234);
      const hashes: string[] = [];
      for (const elapsedMs of stepsMs) {
        ({world} = advance(world, elapsedMs));
        hashes.push(hashState(world));
      }
      return hashes;
    };

    expect(runOnce()).toEqual(runOnce());
  });

  it("produces a different hash for a different seed at the same tick", () => {
    let worldA = createWorld(1);
    let worldB = createWorld(2);

    ({world: worldA} = advance(worldA, 5 * FIXED_DT_MS));
    ({world: worldB} = advance(worldB, 5 * FIXED_DT_MS));

    expect(hashState(worldA)).not.toBe(hashState(worldB));
  });

  it("changes the hash tick-over-tick even with no organisms present", () => {
    let world = createWorld(42);
    const hashes = new Set<string>();

    hashes.add(hashState(world));
    for (let i = 0; i < 5; i++) {
      ({world} = advance(world, FIXED_DT_MS));
      hashes.add(hashState(world));
    }

    expect(hashes.size).toBe(6);
  });
});

describe("fixed-step accumulator", () => {
  it("converts elapsed time into a whole number of ticks and carries the remainder forward", () => {
    let world = createWorld(1);

    const first = advance(world, 1.5 * FIXED_DT_MS);
    expect(first.ticksRun).toBe(1);
    world = first.world;

    // The other half-tick from the first call should combine with this one
    // to produce exactly one more tick, proving the remainder was carried.
    const second = advance(world, 0.5 * FIXED_DT_MS);
    expect(second.ticksRun).toBe(1);
  });

  it("runs zero ticks when elapsed time is less than one fixed tick", () => {
    const world = createWorld(1);
    const {ticksRun} = advance(world, FIXED_DT_MS * 0.3);

    expect(ticksRun).toBe(0);
  });

  it("caps the number of catch-up ticks run in a single call for a pathologically large elapsed time", () => {
    const world = createWorld(1);
    const oneHourMs = 60 * 60 * 1000;

    const {ticksRun} = advance(world, oneHourMs);
    const maxPlausibleTicksForOneCall = oneHourMs / FIXED_DT_MS / 10;

    expect(ticksRun).toBeGreaterThan(0);
    expect(ticksRun).toBeLessThan(maxPlausibleTicksForOneCall);
  });

  it("does not let capped catch-up time reappear in a later call", () => {
    let world = createWorld(1);
    ({world} = advance(world, 60 * 60 * 1000));

    const {ticksRun} = advance(world, FIXED_DT_MS);

    expect(ticksRun).toBe(1);
  });
});

describe("per-tick pipeline", () => {
  const TICKS = 7;

  // Weak on purpose, for now. Nothing happens inside a tick yet and
  // `hashState` covers only the clock and the global stream, so both paths
  // land on tick 7 with an untouched stream and this would hold for any
  // pipeline that counts ticks. It grows teeth in the next ticket, when
  // organism positions enter the hash: from then on it is the guard that
  // a caught-up frame and a run of single ticks simulate the same run.
  it("reaches the same state whether the ticks are caught up in one call or run one at a time", () => {
    let caughtUp = createWorld(99);
    ({world: caughtUp} = advance(caughtUp, TICKS * FIXED_DT_MS));

    let oneAtATime = createWorld(99);
    for (let i = 0; i < TICKS; i++) {
      ({world: oneAtATime} = advance(oneAtATime, FIXED_DT_MS));
    }

    expect(hashState(caughtUp)).toBe(hashState(oneAtATime));
  });

  it("advances the tick counter once per whole tick of elapsed time", () => {
    let world = createWorld(99);
    ({world} = advance(world, TICKS * FIXED_DT_MS));

    expect(getTick(world)).toBe(TICKS);
  });

  it("leaves the tick counter alone when no whole tick has elapsed", () => {
    let world = createWorld(99);
    ({world} = advance(world, 0.9 * FIXED_DT_MS));

    expect(getTick(world)).toBe(0);
  });

  it("runs exactly as many ticks as the capped catch-up reports", () => {
    const {world, ticksRun} = advance(createWorld(99), 60 * 60 * 1000);

    expect(getTick(world)).toBe(ticksRun);
  });
});
