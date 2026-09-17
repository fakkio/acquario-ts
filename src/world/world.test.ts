import {describe, expect, it} from "vitest";

import {ExchangeSettlement} from "./environment";
import {buildUniformGrid} from "./grid";
import {
  initializeMetabolism,
  totalCarbon,
  totalOxygen,
  type Pools,
} from "./ledger";
import {
  applyMaintenance,
  applyPassiveExchange,
  applyPhotosynthesis,
  applyRespiration,
} from "./metabolism";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {
  STARTING_POPULATION,
  bodyArea,
  capFor,
  createPopulation,
  type Organism,
} from "./organism";
import {createRngStream} from "./rng";
import {separateOverlaps} from "./separation";
import {
  organismAt,
  randomPopulation,
  runMetabolism,
  shuffle,
  worstExcursion,
} from "./testing";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCarbonDrift,
  getMeasuredAlpha,
  getOxygenDrift,
  getPoolLevels,
  getPopulation,
  getTick,
  getWorstPenetration,
  getZeroEnergyCount,
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
    // first tick runs, and steps 2 through 5 (exchange, photosynthesis,
    // respiration, maintenance) run every tick from here on — the equality
    // below needs the full pipeline replicated, not just the
    // motion/separation/wall steps it names.
    let pools = initializeMetabolism(byHand);

    for (let tick = 0; tick < PIPELINE_TICKS; tick++) {
      pools = runMetabolism(byHand, pools);

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

  // Tick 0's totals are, by construction, the totals for as long as the
  // world runs. This is the trivial-conservation state the ticket asks
  // for: the instrument reads true before anything exists that could
  // break what it measures.
  it("reads zero drift for both carbon and oxygen at tick 0", () => {
    const world = createWorld(3);

    expect(getCarbonDrift(world)).toBe(0);
    expect(getOxygenDrift(world)).toBe(0);
  });

  // Exchange runs every tick from here on, and photosynthesis (ticket #18)
  // runs alongside it against the population `createWorld` actually places.
  // Both move carbon and oxygen only between an organism's own stores and
  // the pools, never out of the closed system, so the totals hold — but no
  // longer to the last bit, the way they did back when nothing in the tick
  // touched a store away from equilibrium: floating-point addition is not
  // associative, so `a − x` and `b + x` computed separately can disagree
  // with `a + b` in the last few bits even though nothing leaked. Asserted
  // as relative drift within a tight tolerance rather than exact equality,
  // for that reason (ADR-0001, and this ticket's testing decisions).
  it("holds carbon and oxygen drift within a tight tolerance over a long run", () => {
    let world = createWorld(3);

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      expect(Math.abs(getCarbonDrift(world))).toBeLessThan(1e-9);
      expect(Math.abs(getOxygenDrift(world))).toBeLessThan(1e-9);
    }
  });
});

describe("passive exchange (M2)", () => {
  // `World` always starts generation 0 at equilibrium, so a meaningful
  // exercise of exchange — a store actually away from ambient, a draw and
  // a vent both genuinely happening — has to build a population by hand
  // rather than go through `createWorld`. The pipeline below is `runTick`'s
  // step 2 plus steps 6 and 10, the same shape the `collisions` describe
  // block above already replicates by hand for the same reason.
  function runExchange(population: readonly Organism[], pools: Pools): Pools {
    const settlement = new ExchangeSettlement(pools);
    const request = settlement.requestPass();
    for (const organism of population) {
      applyPassiveExchange(organism, request);
    }
    settlement.settle();
    const grant = settlement.grantPass();
    for (const organism of population) {
      applyPassiveExchange(organism, grant);
    }
    return settlement.commit();
  }

  function runExchangeAndMotion(
    population: readonly Organism[],
    pools: Pools,
  ): Pools {
    const settled = runExchange(population, pools);
    for (const organism of population) {
      applyBrownianMotion(organism);
    }
    separateOverlaps(population, buildUniformGrid(population));
    for (const organism of population) {
      constrainToAquarium(organism);
    }
    return settled;
  }

  it("converges a displaced organism back toward ambient while conservation holds, over a long run", () => {
    const population = createPopulation(createRngStream(21)).population;
    let pools = initializeMetabolism(population);

    // Drain one organism's food to zero (a draw will run) and fill its
    // oxygen to twice its cap (a vent will run), so both directions of
    // the one signed law are genuinely exercised rather than everyone
    // sitting at an equilibrium nothing ever perturbs.
    const displaced = population[0];
    const area = bodyArea(displaced);
    const ambientFoodConcentration = displaced.food / area;
    displaced.food = 0;
    displaced.oxygen = 2 * capFor(displaced, "oxygen");

    const initialCarbon = totalCarbon(population, pools);
    const initialOxygen = totalOxygen(population, pools);

    const TICKS = 3000;
    for (let tick = 0; tick < TICKS; tick++) {
      pools = runExchangeAndMotion(population, pools);
    }

    const carbonDrift =
      Math.abs(totalCarbon(population, pools) - initialCarbon) / initialCarbon;
    const oxygenDrift =
      Math.abs(totalOxygen(population, pools) - initialOxygen) / initialOxygen;

    expect(carbonDrift).toBeLessThan(1e-9);
    expect(oxygenDrift).toBeLessThan(1e-9);
    expect(displaced.food / bodyArea(displaced)).toBeCloseTo(
      ambientFoodConcentration,
      2,
    );
  });

  // `ExchangeSettlement` sums every draw in ascending order rather than in
  // call order (`sumAscending` in `environment.ts`), specifically so this
  // holds exactly rather than merely approximately: the set of amounts a
  // population requests does not change when the population is only
  // reordered, and summing that set the same way every time makes the
  // scaling factor — and so every organism's grant and the committed pool
  // — a function of the set, not of the order it arrived in.
  it("leaves every organism's stores and the pools bit-identical, whatever order the population is held in", () => {
    const seedPopulation = () => {
      const population = randomPopulation(11, 30);
      const pools = initializeMetabolism(population);
      // Push total demand for food past the pool, so the proportional-
      // scaling path this test is really about actually runs.
      population[0].food = 0;
      population[1].food = 0;
      return {population, pools};
    };

    const {population: inOrder, pools: poolsA} = seedPopulation();
    const {population: reference, pools: poolsB} = seedPopulation();
    const shuffled = shuffle([...reference], createRngStream(4242));

    const resultA = runExchange(inOrder, poolsA);
    const resultB = runExchange(shuffled, poolsB);

    expect(shuffled).not.toEqual(reference);
    for (let i = 0; i < inOrder.length; i++) {
      expect(reference[i].food).toBe(inOrder[i].food);
      expect(reference[i].oxygen).toBe(inOrder[i].oxygen);
      expect(reference[i].carbonDioxide).toBe(inOrder[i].carbonDioxide);
    }
    expect(resultB).toEqual(resultA);
  });
});

describe("photosynthesis (M2)", () => {
  // Stoichiometry, darkness, cap and headroom throttling, and the "no
  // energy" promise are all covered at the unit boundary in
  // `metabolism.test.ts`, per ADR-0006's testable-in-isolation promise.
  // What is left for the world level, once respiration exists to close the
  // cycle, moves to `respiration and maintenance (M2)` below — this block
  // keeps only the one fact that is specifically photosynthesis's own and
  // does not depend on what runs after it.

  // M0's determinism invariant, now that the hash covers photosynthesis too.
  it("reaches the same hash at tick N in two runs from the same seed", () => {
    const TICKS = 500;
    const runTo = (seed: number) =>
      hashState(advance(createWorld(seed), TICKS * FIXED_DT_MS).world);

    expect(runTo(3)).toBe(runTo(3));
    expect(runTo(3)).not.toBe(runTo(4));
  });
});

describe("respiration and maintenance (M2)", () => {
  // `runMetabolism`'s order-independence, now exercised end to end:
  // exchange, photosynthesis, respiration and maintenance together. Every
  // step in that chain writes only to the organism it runs for or to the
  // settlement's buffer, so the whole chain inherits order-independence
  // from its parts — this is where that inheritance is actually checked.
  it("leaves every organism's stores and the pools bit-identical, whatever order the population is held in", () => {
    const seedPopulation = () => {
      const population = randomPopulation(11, 30);
      const pools = initializeMetabolism(population);
      return {population, pools};
    };

    const {population: inOrder, pools: poolsA} = seedPopulation();
    const {population: reference, pools: poolsB} = seedPopulation();
    const shuffled = shuffle([...reference], createRngStream(4242));

    const resultA = runMetabolism(inOrder, poolsA);
    const resultB = runMetabolism(shuffled, poolsB);

    expect(shuffled).not.toEqual(reference);
    for (let i = 0; i < inOrder.length; i++) {
      expect(reference[i].food).toBe(inOrder[i].food);
      expect(reference[i].oxygen).toBe(inOrder[i].oxygen);
      expect(reference[i].carbonDioxide).toBe(inOrder[i].carbonDioxide);
      expect(reference[i].energy).toBe(inOrder[i].energy);
    }
    expect(resultB).toEqual(resultA);
  });

  // The whole world, exercised through the door the App layer actually
  // uses. Respiration returns CO₂ to the pool the way photosynthesis draws
  // it down (ADR-0006's chaining nets `light → energy` within a tick), so
  // once both reactions run together the pool this ticket's cycle actually
  // moves is CO₂, not food — replacing the pre-respiration slice's "food
  // pool rises" claim, which held only while nothing yet spent what
  // photosynthesis made.
  it("shifts carbon into the CO2 pool as the closed cycle turns", () => {
    let world = createWorld(3);
    const initialCo2 = getPoolLevels(world).carbonDioxide;

    ({world} = advance(world, 200 * FIXED_DT_MS));

    expect(getPoolLevels(world).carbonDioxide).toBeGreaterThan(initialCo2);
  });

  // The differential the milestone's HUD readouts exist to make visible:
  // over a real run some organisms out-earn their own maintenance and some
  // do not, rather than every organism moving in lockstep.
  it("leaves some organisms richer and some poorer in energy than they started, over a run", () => {
    let world = createWorld(3);
    const initialEnergy = getPopulation(world).map((o) => o.energy);

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    const finalEnergy = getPopulation(world).map((o) => o.energy);
    expect(finalEnergy.some((e, i) => e > initialEnergy[i])).toBe(true);
    expect(finalEnergy.some((e, i) => e < initialEnergy[i])).toBe(true);
  });

  // Passive exchange (step 2) runs before respiration and maintenance ever
  // look at an organism's energy, so an organism sitting at zero still
  // trades with the environment exactly as a richer one does — and, given
  // enough food arriving, still produces enough energy to climb back off
  // the floor. Built by hand rather than through `createWorld`, for the
  // same reason `passive exchange (M2)` is: a meaningful exercise needs a
  // store genuinely away from where equilibrium would otherwise hold it.
  it("keeps exchanging at zero energy, and recovers once enough food arrives", () => {
    const population = createPopulation(createRngStream(9)).population;
    const pools = initializeMetabolism(population);
    const starved = population[0];
    // Placed in full light so there is somewhere for recovery to come
    // from, and fully drained so the organism starts genuinely at zero.
    starved.y = 0;
    starved.energy = 0;
    starved.food = 0;
    starved.oxygen = 0;
    starved.carbonDioxide = 0;

    let currentPools = pools;
    let firstTickFood = 0;
    for (let tick = 0; tick < 3000; tick++) {
      currentPools = runMetabolism(population, currentPools);
      if (tick === 0) {
        firstTickFood = starved.food;
      }
    }

    // Still exchanging at zero energy: the very first tick already drew
    // food in from the ambient pool, before there was any energy to speak
    // of yet.
    expect(firstTickFood).toBeGreaterThan(0);
    // And recovers: enough ticks of full-light photosynthesis feeding
    // respiration outruns maintenance, climbing back off the floor.
    expect(starved.energy).toBeGreaterThan(0);
  });

  // ADR-0015: energy income is supposed to come out linear in `r` because
  // respiration's own capacity (area) is designed to vastly outgrow its
  // supply (perimeter/diameter-scaled), leaving the reaction supply-limited
  // rather than pegged at its own ceiling. Checked here on a run rather
  // than trusted from the formula, per the ticket's instruction — organisms
  // held at the *same* depth so only radius varies, since income also
  // depends on light and conflating the two would test depth, not radius.
  it("produces energy income approximately linear in body radius, at a shared depth", () => {
    const radii = [0.6, 0.85, 1.0, 1.2, 1.4];
    const population = radii.map((r, i) => organismAt(i * 3, 5, r, 900 + i));
    let pools = initializeMetabolism(population);

    // Warm up past the startup transient, short of the point any of them
    // would saturate its energy cap and be excluded as throttled.
    const WARMUP_TICKS = 30;
    let outcomes: readonly {
      energyProduced: number;
      throttledByFullEnergyStore: boolean;
    }[] = [];
    for (let tick = 0; tick < WARMUP_TICKS; tick++) {
      const settlement = new ExchangeSettlement(pools);
      const request = settlement.requestPass();
      for (const organism of population) {
        applyPassiveExchange(organism, request);
      }
      settlement.settle();
      const grant = settlement.grantPass();
      for (const organism of population) {
        applyPassiveExchange(organism, grant);
      }
      for (const organism of population) {
        applyPhotosynthesis(organism, grant);
      }
      outcomes = population.map((organism) => applyRespiration(organism));
      for (const organism of population) {
        applyMaintenance(organism);
      }
      pools = settlement.commit();
    }

    const alphas = outcomes
      .filter((outcome) => !outcome.throttledByFullEnergyStore)
      .map((outcome, i) => outcome.energyProduced / radii[i]);
    const mean = alphas.reduce((a, b) => a + b, 0) / alphas.length;
    const variance =
      alphas.reduce((a, b) => a + (b - mean) ** 2, 0) / alphas.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    expect(alphas).toHaveLength(radii.length);
    expect(coefficientOfVariation).toBeLessThan(0.1);
  });

  // The long-run conservation check with the full metabolic cycle running
  // lives in `carbon ledger (M2)` above, alongside tick 0's trivial case —
  // one place for the invariant rather than two near-duplicate runs.

  it("reads zero for the measured-alpha and zero-energy readouts at tick 0", () => {
    const world = createWorld(3);

    expect(getMeasuredAlpha(world)).toBe(0);
    expect(getZeroEnergyCount(world)).toBe(0);
  });

  it("reports a positive measured alpha once respiration has real substrate to run on", () => {
    let world = createWorld(3);

    ({world} = advance(world, 50 * FIXED_DT_MS));

    expect(getMeasuredAlpha(world)).toBeGreaterThan(0);
  });

  // M0's determinism invariant, now that the hash covers respiration and
  // maintenance too.
  it("reaches the same hash at tick N in two runs from the same seed", () => {
    const TICKS = 500;
    const runTo = (seed: number) =>
      hashState(advance(createWorld(seed), TICKS * FIXED_DT_MS).world);

    expect(runTo(3)).toBe(runTo(3));
    expect(runTo(3)).not.toBe(runTo(4));
  });
});

describe("mortality mode (M3)", () => {
  // ADR-0017: the floor is a property of the immortal world, not of
  // maintenance itself, so this M2 invariant now has to ask for that world
  // explicitly rather than get it as `createWorld`'s default.
  it("never lets an organism's energy go negative, over a long run, in the immortal world", () => {
    let world = createWorld(3, {mortality: "off"});

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      for (const organism of getPopulation(world)) {
        expect(organism.energy).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // The mortal world is the default from M3 on, and this is the behaviour
  // that default exists to enable: an organism whose energy is driven to
  // zero or below is condemned the same tick (`death.ts`), so none is ever
  // observable holding negative energy — a long run instead shows the
  // population having shrunk.
  it("never lets a surviving organism's energy go negative, and shrinks the population, over a long run, in the mortal (default) world", () => {
    let world = createWorld(3);
    const initialCount = getPopulation(world).length;

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      for (const organism of getPopulation(world)) {
        expect(organism.energy).toBeGreaterThan(0);
      }
    }

    expect(getPopulation(world).length).toBeLessThan(initialCount);
  });

  // M2's population is fixed and immortal on purpose (see the ticket):
  // energy floors at zero rather than the organism being removed. Moved to
  // the immortal world explicitly per ADR-0017 — nothing removes an
  // organism yet either way, but the invariant this test is naming is
  // specifically the immortal world's.
  it("keeps the population count identical at tick 0 and after a long run, in the immortal world", () => {
    let world = createWorld(3, {mortality: "off"});
    const initialCount = getPopulation(world).length;

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    expect(getPopulation(world).length).toBe(initialCount);
  });

  // `getZeroEnergyCount` only means something in the immortal world (see
  // the ticket and ADR-0017): in the mortal default, energy passes straight
  // through zero to negative, so nothing rests there to be counted.
  it("counts organisms sitting at exactly zero energy, in the immortal world", () => {
    let world = createWorld(3, {mortality: "off"});

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    const liveCount = getPopulation(world).filter((o) => o.energy > 0).length;
    expect(getZeroEnergyCount(world)).toBe(
      getPopulation(world).length - liveCount,
    );
    expect(getZeroEnergyCount(world)).toBeGreaterThan(0);
  });
});
