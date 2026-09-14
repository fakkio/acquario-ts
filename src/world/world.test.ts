import {describe, expect, it} from "vitest";

import {buildUniformGrid} from "./grid";
import {initializeMetabolism} from "./ledger";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {STARTING_POPULATION, createPopulation} from "./organism";
import {createRngStream} from "./rng";
import {separateOverlaps} from "./separation";
import {worstExcursion} from "./testing";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCarbonDrift,
  getOxygenDrift,
  getPoolLevels,
  getPopulation,
  getTick,
  getWorstPenetration,
  hashState,
  type World,
} from "./world";

// The population `createPopulation` places, brought to the same diffusive
// equilibrium `createWorld` puts generation 0 through, so a hand-built
// reference population matches what the world actually holds.
const referencePopulationFor = (seed: number) => {
  const {population} = createPopulation(createRngStream(seed));
  initializeMetabolism(population);
  return population;
};

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

  it("changes the hash tick-over-tick", () => {
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

describe("population", () => {
  it("is reachable from a created world through the read-only accessor", () => {
    expect(getPopulation(createWorld(3))).toHaveLength(STARTING_POPULATION);
  });

  // Stated as an equality rather than by re-asserting placement's properties
  // here: it says the one thing `createWorld` is responsible for — that the
  // population is placed from *this seed's* global stream and then brought
  // to diffusive equilibrium — and inherits containment, radius spread and
  // stream derivation from the tests that already cover `createPopulation`.
  it("places its population from the seed's own global stream", () => {
    expect(getPopulation(createWorld(3))).toEqual(referencePopulationFor(3));
  });

  it("is identical between two worlds created from the same seed", () => {
    expect(getPopulation(createWorld(3))).toEqual(
      getPopulation(createWorld(3)),
    );
  });

  it("differs between two worlds created from different seeds", () => {
    expect(getPopulation(createWorld(3))).not.toEqual(
      getPopulation(createWorld(4)),
    );
  });

  it("makes two worlds from the same seed hash identically at tick 0", () => {
    expect(hashState(createWorld(3))).toBe(hashState(createWorld(3)));
  });

  // The population is carried across `advance` by reference, so the bodies a
  // caller reads are always the live ones — the consequence of ADR-0013's
  // mutable organisms that the `World` doc comment warns about.
  it("survives an advance, still reachable from the returned world", () => {
    const {world} = advance(createWorld(3), 5 * FIXED_DT_MS);

    expect(getPopulation(world)).toHaveLength(STARTING_POPULATION);
  });
});

describe("motion", () => {
  const TICKS = 120;

  const positionsOf = (world: World) =>
    getPopulation(world).map((organism) => ({x: organism.x, y: organism.y}));

  it("moves every organism as ticks run", () => {
    const world = createWorld(5);
    const before = positionsOf(world);

    const {world: moved} = advance(world, TICKS * FIXED_DT_MS);

    positionsOf(moved).forEach((position, i) => {
      expect(position).not.toEqual(before[i]);
    });
  });

  // The invariant, checked where it has to hold rather than only in the
  // motion unit test: every tick of a real run, for a whole population that
  // started scattered against the walls.
  //
  // Carried as a worst case and asserted once rather than assertion by
  // assertion, which it was until the separation ticket made a tick do real
  // work. Three hundred thousand assertions cost several seconds on their
  // own, and a test that spends its time inside the assertion library rather
  // than inside the simulation is a test that goes flaky the moment the
  // machine is busy.
  it("never lets a body cross the aquarium boundary, tick after tick", () => {
    let world = createWorld(5);
    let worstSoFar = Number.NEGATIVE_INFINITY;

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      worstSoFar = Math.max(worstSoFar, worstExcursion(getPopulation(world)));
    }

    expect(worstSoFar).toBeLessThanOrEqual(0);
  });

  // M0's determinism invariant, now that the hash covers something that
  // actually changes inside a tick.
  it("reaches the same hash at tick N in two runs from the same seed", () => {
    const runTo = (seed: number) =>
      hashState(advance(createWorld(seed), TICKS * FIXED_DT_MS).world);

    expect(runTo(5)).toBe(runTo(5));
    expect(runTo(5)).not.toBe(runTo(6));
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

  // The guard that a caught-up frame and a run of single ticks simulate the
  // same run. It has teeth now that bodies move: seven ticks of brownian
  // motion are in the hash, so a pipeline that ran the tick body once per
  // `advance` call rather than once per tick fails here.
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

describe("collisions", () => {
  const TICKS = 600;

  /**
   * The ceiling M1's invariant is stated against, in baseline body radii, and
   * the same one `separation.test.ts` pins for a crowd four times this dense.
   * Read here on the population the app actually runs, through the accessor
   * the HUD actually reads.
   */
  const PENETRATION_CEILING = 0.5;

  // Placement scatters generation 0 without looking at who is already there,
  // so a fresh world starts with bodies inside one another. This is the one
  // assertion that says the pass runs inside the tick at all.
  it("clears the overlaps generation 0 was placed with", () => {
    const world = createWorld(8);
    const placed = getWorstPenetration(world);
    expect(placed).toBeGreaterThan(0);

    const {world: separated} = advance(world, TICKS * FIXED_DT_MS);

    expect(getWorstPenetration(separated)).toBeLessThan(placed);
  });

  it("holds the worst overlap under the ceiling, tick after tick of a real run", () => {
    let world = createWorld(8);
    let worst = 0;

    for (let tick = 0; tick < TICKS; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      worst = Math.max(worst, getWorstPenetration(world));
    }

    expect(worst).toBeLessThan(PENETRATION_CEILING);
  });

  // Separation writes to positions, so it writes to the hash — which is the
  // point of hashing bodies at all. A pass that ran on one world and not on
  // its twin would show up here.
  it("keeps two runs from the same seed hashing identically while bodies collide", () => {
    const runTo = (seed: number) =>
      hashState(advance(createWorld(seed), TICKS * FIXED_DT_MS).world);

    expect(runTo(8)).toBe(runTo(8));
  });

  /**
   * "Exactly one separation pass per tick", asserted where the count actually
   * lives. The unit test next door proves that one call to `separateOverlaps`
   * does one pass; only this can say the tick makes one call — a second one
   * added to `runTick` is invisible from inside the pass.
   *
   * Written as an equality against the pipeline spelled out by hand, so it
   * pins the whole of step 6 and step 10 and not just the pass count: motion
   * once per organism, then one separation over the grid as it stands after
   * motion, then the wall constraint. Any tick that ran them twice, in the
   * other order, or against a grid built before motion, lands somewhere else.
   */
  it("runs motion, one separation pass and the wall constraint, once each per tick", () => {
    const SEED = 8;
    // Short enough to stay under the catch-up cap, so one `advance` call
    // really does run this many ticks.
    const PIPELINE_TICKS = 60;
    const byHand = createPopulation(createRngStream(SEED)).population;
    // `createWorld` brings generation 0 to diffusive equilibrium before the
    // first tick runs; nothing in this pipeline touches those stores, but
    // the equality below needs the same starting values `createWorld` used.
    initializeMetabolism(byHand);

    for (let tick = 0; tick < PIPELINE_TICKS; tick++) {
      for (const organism of byHand) {
        applyBrownianMotion(organism);
      }
      separateOverlaps(byHand, buildUniformGrid(byHand));
      for (const organism of byHand) {
        constrainToAquarium(organism);
      }
    }

    const {world, ticksRun} = advance(
      createWorld(SEED),
      PIPELINE_TICKS * FIXED_DT_MS,
    );

    expect(ticksRun).toBe(PIPELINE_TICKS);
    expect(getPopulation(world)).toEqual(byHand);
  });
});

describe("carbon ledger (M2)", () => {
  it("exposes the same pool levels initializeMetabolism computed for generation 0", () => {
    const population = referencePopulationFor(3);
    const pools = initializeMetabolism(population);

    expect(getPoolLevels(createWorld(3))).toEqual(pools);
  });

  // Nothing in this slice moves a unit of carbon — no exchange, no
  // reactions — so tick 0's totals are, by construction, the totals for
  // as long as the world runs. This is the trivial-conservation state the
  // ticket asks for: the instrument reads true before anything exists
  // that could break what it measures.
  it("reads zero drift for both carbon and oxygen at tick 0", () => {
    const world = createWorld(3);

    expect(getCarbonDrift(world)).toBe(0);
    expect(getOxygenDrift(world)).toBe(0);
  });

  it("never lets either drift move over a long run, since nothing yet touches a store", () => {
    let world = createWorld(3);

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      expect(getCarbonDrift(world)).toBe(0);
      expect(getOxygenDrift(world)).toBe(0);
    }
  });
});
