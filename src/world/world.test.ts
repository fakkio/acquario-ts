import {describe, expect, it} from "vitest";

import {AQUARIUM_AREA, AQUARIUM_HEIGHT} from "./aquarium";
import {ExchangeSettlement} from "./environment";
import {BASELINE_GENOME} from "./genome";
import {buildUniformGrid} from "./grid";
import {DEFAULT_ROSTER} from "./organelles";
import {
  initializeMetabolism,
  totalCarbon,
  totalOxygen,
  type Pools,
} from "./ledger";
import {BRIGHT_BAND_DEPTH} from "./light";
import {
  applyMaintenance,
  applyPassiveExchange,
  applyPhotosynthesis,
  applyRespiration,
} from "./metabolism";
import {appendBirths, evaluateMitosis, type PendingBirth} from "./mitosis";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {
  DIFFUSIBLES,
  STARTING_POPULATION,
  bodyArea,
  capFor,
  createPopulation,
  placeFounders,
  type Founder,
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
  getCumulativeBirths,
  getCumulativeDeaths,
  getNextInnovationId,
  getMeasuredAlpha,
  getOxygenDrift,
  getBrightAlpha,
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
  const {population} = createPopulation(
    createRngStream(seed),
    undefined,
    DEFAULT_ROSTER,
  );
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
   * The ceiling M1's invariant is stated against, in baseline body radii,
   * read here on the population the app actually runs, through the
   * accessor the HUD actually reads.
   *
   * Raised from M1's `0.5` at #35, to `1.5`: that value was pinned before
   * this world could reproduce, and every M1–M4 run of this test span 600
   * ticks with generation 0 alone. #35 is what makes tangent births land
   * inside this window for the first time, and each one can arrive already
   * overlapping a third body the parent itself did not, which the collision
   * pass then has a tick per newborn to resolve rather than the whole run to
   * settle into (ADR-0008's own "climbs for a tick here and there on the way
   * down").
   *
   * Raised again at #36, to `2.0`: `AMBIENT_CO2_SHARE`'s own move to 0.6
   * (see its comment in `constants.ts`) makes reproduction easier even
   * without ADR-0025's declined fallback, so seed 8 now breeds enough
   * inside these 600 ticks to reach `1.60` rather than `0.98` — more
   * newborns arriving mid-run, not a pass that stopped converging. `2.0`
   * keeps the same kind of headroom above the newly observed peak that
   * `1.5` kept above the old one.
   */
  const PENETRATION_CEILING = 2.0;

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
   *
   * Run infertile and immortal: the hand-rolled pipeline below replicates
   * steps 2 through 6 and step 10 only, never step 7, step 8 or step 12, so
   * a world left at either default could legitimately diverge from it —
   * fertility the moment one organism crosses its mitosis threshold, a real
   * birth and not a bug; mortality the moment one organism's energy passes
   * zero, a real death and not a bug — and this equality has no way to
   * replicate either. Both were left at their defaults before #35 solved a
   * `c₀` an organism can actually afford to starve against in 60 ticks from
   * a standing start; turning mortality off here changes nothing about the
   * steps under test, which never touch death either.
   */
  it("runs motion, one separation pass and the wall constraint, once each per tick", () => {
    const SEED = 8;
    // Short enough to stay under the catch-up cap, so one `advance` call
    // really does run this many ticks.
    const PIPELINE_TICKS = 60;
    const byHand = createPopulation(
      createRngStream(SEED),
      undefined,
      DEFAULT_ROSTER,
    ).population;
    // `createWorld` brings generation 0 to diffusive equilibrium before the
    // first tick runs, and steps 2 through 5 (exchange, photosynthesis,
    // respiration, maintenance) run every tick from here on — the equality
    // below needs the full pipeline replicated, not just the
    // motion/separation/wall steps it names.
    let pools = initializeMetabolism(byHand);

    for (let tick = 0; tick < PIPELINE_TICKS; tick++) {
      pools = runMetabolism(byHand, pools);
      // The immortal floor (ADR-0017): a world constructed with
      // `mortality: "off"` clamps energy at zero inside `runTick`, outside
      // `runMetabolism`'s own steps, so it has to be replicated here too —
      // #35's `c₀` makes several founders reach zero well inside 60 ticks,
      // where the milestones before it never did.
      for (const organism of byHand) {
        organism.energy = Math.max(0, organism.energy);
      }

      for (const organism of byHand) {
        applyBrownianMotion(organism);
      }
      separateOverlaps(byHand, buildUniformGrid(byHand));
      for (const organism of byHand) {
        constrainToAquarium(organism);
      }
    }

    const {world, ticksRun} = advance(
      createWorld(SEED, {fertility: "off", mortality: "off"}),
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

    // #35 raised the carbon budget enough that every founder's internal CO₂
    // starts above `K_CAP.carbonDioxide`, throttling respiration until
    // photosynthesis draws it back down — around 100 ticks at this depth,
    // where a 30-tick warmup used to be enough. Once each body clears that,
    // its own income still swings tick to tick as it drifts in and out of
    // the throttle, so a single tick's snapshot is noisy; the calibration
    // harness's own `α` reading (`scripts/calibration/alpha.ts`) handles
    // this the same way, by time-averaging over a window instead of reading
    // one tick.
    const SETTLE_TICKS = 300;
    const WINDOW_TICKS = 200;
    const alphaSums = radii.map(() => 0);
    const alphaCounts = radii.map(() => 0);
    for (let tick = 0; tick < SETTLE_TICKS + WINDOW_TICKS; tick++) {
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
      const outcomes = population.map((organism) => applyRespiration(organism));
      for (const organism of population) {
        applyMaintenance(organism);
      }
      pools = settlement.commit();

      if (tick >= SETTLE_TICKS) {
        outcomes.forEach((outcome, i) => {
          if (!outcome.throttledByFullEnergyStore) {
            alphaSums[i] += outcome.energyProduced / radii[i];
            alphaCounts[i]++;
          }
        });
      }
    }

    const alphas = alphaSums.map((sum, i) => sum / alphaCounts[i]);
    const mean = alphas.reduce((a, b) => a + b, 0) / alphas.length;
    const variance =
      alphas.reduce((a, b) => a + (b - mean) ** 2, 0) / alphas.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    expect(alphaCounts.every((count) => count > 0)).toBe(true);
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

  /**
   * ADR-0023's split reading. Both worlds below are **fixed populations**
   * (mortality and fertility both off), because that is the only world
   * either `α` is a measurement in, and both are built from an explicit
   * founder list so the depth the reading is about is chosen rather than
   * drawn.
   */
  describe("bright-band alpha", () => {
    const ladderAt = (depth: number): Founder[] =>
      [6, 18, 30, 42, 54].map((x) => ({
        x,
        y: depth,
        genome: {...BASELINE_GENOME, lineageHue: 0.5},
      }));

    const fixedWorldOf = (founders: Founder[], ticks: number) =>
      advance(
        createWorld(3, {
          mortality: "off",
          fertility: "off",
          generation0: {founders},
        }),
        ticks * FIXED_DT_MS,
      ).world;

    it("reads zero at tick 0, exactly as the whole-population mean does", () => {
      const world = createWorld(3);

      expect(getBrightAlpha(world)).toBe(0);
    });

    it("reads zero when every body sits below the band", () => {
      // Not asserting a positive whole-population mean here any more: #35's
      // carbon budget starts every founder's internal CO₂ above
      // `K_CAP.carbonDioxide`, and clearing it needs photosynthesis, whose
      // rate this far below the band is slow enough that "50 ticks" and
      // "never" are hard to tell apart (clearing at the band's own floor,
      // `y = BRIGHT_BAND_DEPTH`, already measures in the thousands). The
      // property this test exists for — a population with nobody in the
      // band reads zero on the bright side — still holds and is what it
      // checks; `getMeasuredAlpha` reading positive once real substrate
      // exists is `describe("respiration and maintenance (M2)")`'s own
      // test, on the default, depth-scattered population.
      const world = fixedWorldOf(ladderAt(AQUARIUM_HEIGHT - 2), 50);

      expect(getBrightAlpha(world)).toBe(0);
    });

    it("agrees with the whole-population mean when every body is in the band", () => {
      const world = fixedWorldOf(ladderAt(2), 50);

      expect(getBrightAlpha(world)).toBeGreaterThan(0);
      expect(getBrightAlpha(world)).toBeCloseTo(getMeasuredAlpha(world), 12);
    });

    it("reports the brighter of the two ecologies when the population straddles the band", () => {
      const world = fixedWorldOf(
        [...ladderAt(2), ...ladderAt(AQUARIUM_HEIGHT - 2)],
        50,
      );

      expect(getBrightAlpha(world)).toBeGreaterThan(getMeasuredAlpha(world));
    });

    it("counts a body exactly on the band's floor as inside it", () => {
      // Not asserting a positive reading at tick 1 any more: #35's carbon
      // budget starts internal CO₂ above `K_CAP.carbonDioxide`, and this
      // depth is dim enough (10% of surface) that clearing it takes
      // thousands of ticks, not one — see the below-band test's comment.
      // What this test is actually about is the `≤` in `isBright`, which a
      // lone organism's equal reading on both sides proves regardless of
      // the reading's sign; a body strictly inside the band earning
      // something is `"agrees with the whole-population mean..."`'s job.
      const world = fixedWorldOf(
        [
          {
            x: 30,
            y: BRIGHT_BAND_DEPTH,
            genome: {...BASELINE_GENOME, lineageHue: 0.5},
          },
        ],
        1,
      );

      expect(getBrightAlpha(world)).toBe(getMeasuredAlpha(world));
    });
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

// M4 (ADR-0020): fertility is a mode independent of mortality, precisely so
// this whole block can go on meaning "death without birth" — every world
// built here now says `fertility: "off"` explicitly, and the interaction
// between the two modes gets its own "fertility mode (M4)" block below.
describe("mortality mode (M3)", () => {
  // ADR-0017: the floor is a property of the immortal world, not of
  // maintenance itself, so this M2 invariant now has to ask for that world
  // explicitly rather than get it as `createWorld`'s default.
  it("never lets an organism's energy go negative, over a long run, in the immortal world", () => {
    let world = createWorld(3, {mortality: "off", fertility: "off"});

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
    let world = createWorld(3, {fertility: "off"});
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
    let world = createWorld(3, {mortality: "off", fertility: "off"});
    const initialCount = getPopulation(world).length;

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    expect(getPopulation(world).length).toBe(initialCount);
  });

  // `getZeroEnergyCount` only means something in the immortal world (see
  // the ticket and ADR-0017): in the mortal default, energy passes straight
  // through zero to negative, so nothing rests there to be counted.
  it("counts organisms sitting at exactly zero energy, in the immortal world", () => {
    let world = createWorld(3, {mortality: "off", fertility: "off"});

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    const liveCount = getPopulation(world).filter((o) => o.energy > 0).length;
    expect(getZeroEnergyCount(world)).toBe(
      getPopulation(world).length - liveCount,
    );
    expect(getZeroEnergyCount(world)).toBeGreaterThan(0);
  });

  // `getZeroEnergyCount` is scoped to the immortal world (see the ticket):
  // in the mortal default nothing ever rests at exactly zero, so the
  // readout stays 0 even once the population has visibly shrunk.
  it("reads 0 for getZeroEnergyCount in the mortal (default) world, even once organisms have died", () => {
    let world = createWorld(3, {fertility: "off"});
    const initialCount = getPopulation(world).length;

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    expect(getPopulation(world).length).toBeLessThan(initialCount);
    expect(getZeroEnergyCount(world)).toBe(0);
  });

  it("reads 0 for getCumulativeDeaths for the lifetime of the immortal world", () => {
    let world = createWorld(3, {mortality: "off", fertility: "off"});

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    expect(getCumulativeDeaths(world)).toBe(0);
  });

  // The count a catch-up `advance` call has to get right: `advance` runs up
  // to `MAX_TICKS_PER_ADVANCE` ticks inside a single call, and a readout
  // written per-tick rather than accumulated would show only the last
  // tick's toll. The population is forced deep and dark first, the same way
  // `death.test.ts`'s acceptance run does, so several organisms starve well
  // inside one such batch rather than depending on the default population's
  // placement to produce a death in time.
  it("counts every death inside a single catch-up batch, matching exactly how far the population shrank", () => {
    const world = createWorld(3, {fertility: "off"});
    const initialCount = getPopulation(world).length;
    for (const organism of getPopulation(world) as unknown as Organism[]) {
      organism.y = AQUARIUM_HEIGHT - 2;
    }

    const {world: after} = advance(world, 5000 * FIXED_DT_MS);

    const lost = initialCount - getPopulation(after).length;
    expect(lost).toBeGreaterThan(0);
    expect(getCumulativeDeaths(after)).toBe(lost);
  });

  it("keeps accumulating cumulative deaths across many advance calls, in the mortal (default) world", () => {
    let world = createWorld(3, {fertility: "off"});
    const initialCount = getPopulation(world).length;

    for (let tick = 0; tick < 2000; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }

    const lost = initialCount - getPopulation(world).length;
    expect(lost).toBeGreaterThan(0);
    expect(getCumulativeDeaths(world)).toBe(lost);
  });
});

describe("fertility mode (M4)", () => {
  // Boosts every organism straight past mitosis's threshold gate and both
  // physical requirements, so a birth is imminent rather than a matter of
  // waiting out thousands of ticks of differentiation — the same trick
  // `mortality mode (M3)`'s catch-up test already plays on `y` to force a
  // death quickly.
  function primeForBirth(world: World): void {
    for (const organism of getPopulation(world) as unknown as Organism[]) {
      organism.energy = capFor(organism, "energy");
      organism.food = capFor(organism, "food");
    }
  }

  it("grows the population once organisms have enough energy and food to breed", () => {
    let world = createWorld(3);
    primeForBirth(world);
    const initialCount = getPopulation(world).length;

    ({world} = advance(world, 20 * FIXED_DT_MS));

    expect(getPopulation(world).length).toBeGreaterThan(initialCount);
  });

  // The invariant `motion`'s "never lets a body cross the aquarium
  // boundary" test already exercises over a long default run — this is the
  // same claim, forced to actually cover a birth tick rather than trusting
  // one occurred somewhere in 2000 ticks by chance.
  it("never lets a newborn land outside the aquarium, births included", () => {
    let world = createWorld(3);
    primeForBirth(world);
    let worstSoFar = Number.NEGATIVE_INFINITY;

    for (let tick = 0; tick < 30; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      worstSoFar = Math.max(worstSoFar, worstExcursion(getPopulation(world)));
    }

    expect(getPopulation(world).length).toBeGreaterThan(STARTING_POPULATION);
    expect(worstSoFar).toBeLessThanOrEqual(0);
  });

  // The short-run counterpart of "carbon ledger (M2)"'s check, now with
  // births actually growing the population inside the window measured —
  // mitosis moves mass only between a parent's own stores and its child's,
  // never through a pool, so the ledger has to hold exactly as it did
  // before reproduction existed.
  //
  // Measured against a baseline struck *after* `primeForBirth`, not against
  // `getWorldCarbonDrift`'s tick-0 one: priming pours carbon into every
  // organism's stores by hand, outside the tick pipeline and without
  // touching a pool, which is a deliberate unbalancing of this test's own
  // setup rather than anything the simulation is supposed to conserve
  // through.
  it("conserves carbon and oxygen within tolerance over a short run in which the population grows", () => {
    // `totalCarbon`/`totalOxygen` read real `Organism[]`, not the read-only
    // `OrganismView[]` the world hands the App layer — the same cast
    // `primeForBirth` uses above, and for the same reason: this test's own
    // business is with the mutable population, not with what a renderer
    // would be allowed to see.
    const population = (world: World) =>
      getPopulation(world) as unknown as Organism[];

    let world = createWorld(3);
    primeForBirth(world);
    const referenceCarbon = totalCarbon(
      population(world),
      getPoolLevels(world),
    );
    const referenceOxygen = totalOxygen(
      population(world),
      getPoolLevels(world),
    );
    let peakPopulation = getPopulation(world).length;

    for (let tick = 0; tick < 500; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
      const carbonDrift =
        Math.abs(
          totalCarbon(population(world), getPoolLevels(world)) -
            referenceCarbon,
        ) / referenceCarbon;
      const oxygenDrift =
        Math.abs(
          totalOxygen(population(world), getPoolLevels(world)) -
            referenceOxygen,
        ) / referenceOxygen;
      expect(carbonDrift).toBeLessThan(1e-9);
      expect(oxygenDrift).toBeLessThan(1e-9);
      peakPopulation = Math.max(peakPopulation, getPopulation(world).length);
    }

    // A population primed to breed immediately can boom and then correct —
    // that is a real ecological outcome (see the ticket's own risk note),
    // not a defect — so the growth claim is checked against the run's peak
    // rather than against wherever the population happens to sit at the
    // end of the window.
    expect(peakPopulation).toBeGreaterThan(STARTING_POPULATION);
  });

  // M0's determinism invariant, now that the hash covers births too.
  it("reaches the same hash at tick N in two runs from the same seed, once births are in the mix", () => {
    const runTo = (seed: number) => {
      let world = createWorld(seed);
      primeForBirth(world);
      for (let tick = 0; tick < 20; tick++) {
        ({world} = advance(world, FIXED_DT_MS));
      }
      return hashState(world);
    };

    expect(runTo(3)).toBe(runTo(3));
  });

  // ADR-0019's order-independence guarantee, exercised head-on: a
  // population priced to breed within a handful of ticks, so at least two
  // organisms almost certainly breed on the same tick, has to leave the
  // pools bit-identical whichever order it is held in — the M4 counterpart
  // of `death.test.ts`'s deposit test and `world.test.ts`'s own exchange
  // and metabolism versions above. Mitosis never calls `Environment.exchange`
  // and `appendBirths` never touches a pool, so this is also a check that
  // wiring mitosis into the pipeline did not quietly change that.
  it("leaves the pools bit-identical whatever order a population primed to breed is held in", () => {
    const seedPopulation = (): {population: Organism[]; pools: Pools} => {
      const population = randomPopulation(21, 20);
      const pools = initializeMetabolism(population);
      for (const organism of population) {
        organism.energy = capFor(organism, "energy");
        organism.food = capFor(organism, "food");
      }
      return {population, pools};
    };

    const runFertileTicks = (
      population: readonly Organism[],
      pools: Pools,
      ticks: number,
    ): {population: readonly Organism[]; pools: Pools} => {
      let currentPopulation = population;
      let currentPools = pools;
      for (let tick = 0; tick < ticks; tick++) {
        currentPools = runMetabolism(currentPopulation, currentPools);
        for (const organism of currentPopulation) {
          applyBrownianMotion(organism);
        }
        const births = currentPopulation
          .map((organism) => evaluateMitosis(organism, []))
          .filter((birth): birth is PendingBirth => birth !== null);
        separateOverlaps(
          currentPopulation,
          buildUniformGrid(currentPopulation),
        );
        for (const organism of currentPopulation) {
          constrainToAquarium(organism);
        }
        currentPopulation = appendBirths(currentPopulation, births);
      }
      return {population: currentPopulation, pools: currentPools};
    };

    const {population: inOrder, pools: poolsA} = seedPopulation();
    const {population: reference, pools: poolsB} = seedPopulation();
    const shuffled = shuffle([...reference], createRngStream(4242));

    const resultA = runFertileTicks(inOrder, poolsA, 5);
    const resultB = runFertileTicks(shuffled, poolsB, 5);

    expect(shuffled).not.toEqual(reference);
    // The scenario this test claims to exercise actually happened.
    expect(resultA.population.length).toBeGreaterThan(inOrder.length);
    expect(resultB.pools).toEqual(resultA.pools);
  });

  it("reads 0 for getCumulativeBirths for the lifetime of the infertile world", () => {
    let world = createWorld(3, {fertility: "off"});

    ({world} = advance(world, 2000 * FIXED_DT_MS));

    expect(getCumulativeBirths(world)).toBe(0);
  });

  // The count a catch-up `advance` call has to get right: `advance` runs up
  // to `MAX_TICKS_PER_ADVANCE` ticks inside a single call, and a readout
  // written per-tick rather than accumulated would show only the last
  // tick's crop of newborns. Immortal so growth is births alone, the same
  // isolation `mortality mode (M3)`'s catch-up test uses in reverse.
  it("counts every birth inside a single catch-up batch, matching exactly how far the population grew", () => {
    let world = createWorld(3, {mortality: "off"});
    primeForBirth(world);
    const initialCount = getPopulation(world).length;

    ({world} = advance(world, 5000 * FIXED_DT_MS));

    const grown = getPopulation(world).length - initialCount;
    expect(grown).toBeGreaterThan(0);
    expect(getCumulativeBirths(world)).toBe(grown);
  });

  it("keeps accumulating cumulative births across many advance calls, in the fertile (default) world", () => {
    let world = createWorld(3, {mortality: "off"});
    primeForBirth(world);
    const initialCount = getPopulation(world).length;

    for (let tick = 0; tick < 20; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }

    const grown = getPopulation(world).length - initialCount;
    expect(grown).toBeGreaterThan(0);
    expect(getCumulativeBirths(world)).toBe(grown);
  });
});

describe("generation 0 (M5)", () => {
  const LADDER: readonly Founder[] = [0.8, 1.2, 1.8, 2.6].map(
    (cytoplasmThickness, i) => ({
      x: 10 + 10 * i,
      y: 4 + 8 * i,
      genome: {...BASELINE_GENOME, cytoplasmThickness, lineageHue: 0.2 * i},
    }),
  );

  const hashAfter = (world: World, ticks: number) => {
    let ticked = world;
    for (let tick = 0; tick < ticks; tick++) {
      ({world: ticked} = advance(ticked, FIXED_DT_MS));
    }
    return hashState(ticked);
  };

  // The whole ticket's verification, in one line: additive means additive.
  // Pinned against a hash literal it would only restate whatever the
  // constants happen to be; stated as "the explicit default is the
  // default" it survives M5 moving them, which is what the next two
  // tickets do.
  it("reaches the same hash at tick N whether the default baseline is omitted or spelled out", () => {
    expect(hashAfter(createWorld(1234), 60)).toBe(
      hashAfter(
        createWorld(1234, {generation0: {baselineGenome: BASELINE_GENOME}}),
        60,
      ),
    );
  });

  it("mutates founders from the baseline genome it was given", () => {
    const population = getPopulation(
      createWorld(1234, {
        generation0: {
          baselineGenome: {...BASELINE_GENOME, cytoplasmThickness: 2.5},
        },
      }),
    );

    const mean =
      population.reduce((sum, organism) => sum + organism.bodyRadius, 0) /
      population.length;
    expect(mean).toBeGreaterThan(2);
    expect(mean).toBeLessThan(3);
  });

  it("diverges from the default world once the baseline genome differs", () => {
    expect(
      hashAfter(
        createWorld(1234, {
          generation0: {
            baselineGenome: {...BASELINE_GENOME, cytoplasmThickness: 2.5},
          },
        }),
        60,
      ),
    ).not.toBe(hashAfter(createWorld(1234), 60));
  });

  it("places an explicit ladder of founders exactly as given", () => {
    const population = getPopulation(
      createWorld(1234, {generation0: {founders: LADDER}}),
    );

    expect(population).toHaveLength(LADDER.length);
    for (const [i, organism] of population.entries()) {
      expect(organism.cytoplasmThickness).toBe(
        LADDER[i].genome.cytoplasmThickness,
      );
      expect(organism.x).toBe(LADDER[i].x);
      expect(organism.y).toBe(LADDER[i].y);
      expect(organism.lineageHue).toBe(LADDER[i].genome.lineageHue);
    }
  });

  // An explicit generation 0 goes through exactly the same ledger
  // construction the placed one does, or the harness would be measuring a
  // world that opens on a filling transient instead of at equilibrium.
  it("brings an explicit generation 0 to diffusive equilibrium like any other", () => {
    const world = createWorld(1234, {generation0: {founders: LADDER}});
    const pools = getPoolLevels(world);

    for (const organism of getPopulation(world)) {
      const area = bodyArea(organism);
      for (const resource of DIFFUSIBLES) {
        expect(organism[resource] / area).toBeCloseTo(
          pools[resource] / AQUARIUM_AREA,
          12,
        );
      }
    }
  });

  it("reaches the same hash at tick N in two runs from the same seed and the same ladder", () => {
    const of = () =>
      hashAfter(createWorld(1234, {generation0: {founders: LADDER}}), 60);

    expect(of()).toBe(of());
  });

  it("holds carbon and oxygen within tolerance over a run from an explicit generation 0", () => {
    let world = createWorld(1234, {generation0: {founders: LADDER}});
    for (let tick = 0; tick < 500; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }

    expect(Math.abs(getCarbonDrift(world))).toBeLessThan(1e-9);
    expect(Math.abs(getOxygenDrift(world))).toBeLessThan(1e-9);
  });

  // An empty ladder is a world with nothing in it, not a crash and not a
  // silently refilled default: the harness is what chooses a generation 0,
  // and a world that quietly placed forty founders behind its back would
  // be measuring something other than what was asked for.
  it("builds an empty world from an empty founder list, and ticks it", () => {
    let world = createWorld(1234, {generation0: {founders: []}});
    expect(getPopulation(world)).toHaveLength(0);

    for (let tick = 0; tick < 10; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }

    expect(getPopulation(world)).toHaveLength(0);
    expect(getTick(world)).toBe(10);
    expect(Math.abs(getCarbonDrift(world))).toBeLessThan(1e-9);
    expect(Math.abs(getOxygenDrift(world))).toBeLessThan(1e-9);
  });

  it("exposes all four genes on every organism the world hands out", () => {
    for (const organism of getPopulation(createWorld(1234))) {
      expect(organism.bodyRadius).toBeGreaterThan(0);
      expect(organism.lineageHue).toBeGreaterThanOrEqual(0);
      expect(organism.mitosisEnergyThreshold).toBeGreaterThanOrEqual(0);
      expect(organism.childAllocationRatio).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("a body with neurons (M7)", () => {
  // Founders spread across the bright band, each carrying a small cluster of
  // neurons, overlapping on purpose so the body relaxes them apart. They
  // are small on purpose too: the Birth Cost Ceiling prices an organelle's
  // worst event by its radius, and a parent short of food cannot afford
  // larger ones. Worlds built from them run with an empty roster, so no
  // neuron is inserted and every carrier descends from one of these.
  const CARRIERS: readonly Founder[] = Array.from({length: 12}, (_, i) => ({
    x: 4 + 6.5 * i,
    y: 3 + (i % 3) * 2,
    genome: {
      ...BASELINE_GENOME,
      lineageHue: i / 12,
      genes: Array.from({length: 1 + (i % 4)}, (_, k) => ({
        type: "neuron" as const,
        x: 0.03 * k,
        y: 0,
        radius: 0.03 + 0.002 * k,
      })),
    },
  }));
  const BARE: readonly Founder[] = CARRIERS.map((founder) => ({
    ...founder,
    genome: {...founder.genome, genes: []},
  }));

  const run = (founders: readonly Founder[], ticks: number) => {
    let world = createWorld(1234, {generation0: {founders}, roster: []});
    for (let tick = 0; tick < ticks; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }
    return world;
  };

  it("mints every founder's Innovation Ids once, distinct, in placement order", () => {
    const ids = getPopulation(
      createWorld(1234, {generation0: {founders: CARRIERS}}),
    )
      .flatMap((organism) => organism.organelles)
      .map((organelle) => organelle.innovationId);
    const expectedCount = CARRIERS.reduce(
      (sum, founder) => sum + founder.genome.genes.length,
      0,
    );

    expect(ids).toHaveLength(expectedCount);
    expect(new Set(ids).size).toBe(expectedCount);
    // The counter advances in placement order; this reads it only to check
    // that, never to rank genes (glossary: Innovation Id).
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("hands out each founder's organelles relaxed apart, inside a body grown around them", () => {
    for (const organism of getPopulation(
      createWorld(1234, {generation0: {founders: CARRIERS}}),
    )) {
      const organelleArea = organism.organelles.reduce(
        (sum, organelle) => sum + Math.PI * organelle.radius ** 2,
        0,
      );
      expect(organism.bodyRadius).toBeGreaterThan(organism.cytoplasmThickness);
      expect(organism.cytoplasmArea).toBeCloseTo(
        bodyArea(organism) - organelleArea,
        12,
      );
      for (const organelle of organism.organelles) {
        expect(
          Math.hypot(organelle.x, organelle.y) + organelle.radius,
        ).toBeLessThanOrEqual(
          organism.bodyRadius - organism.cytoplasmThickness + 1e-9,
        );
      }
    }
  });

  it("starts carriers at diffusive equilibrium over their Cytoplasm Area", () => {
    const world = createWorld(1234, {generation0: {founders: CARRIERS}});
    const pools = getPoolLevels(world);

    for (const organism of getPopulation(world)) {
      for (const resource of DIFFUSIBLES) {
        expect(organism[resource] / organism.cytoplasmArea).toBeCloseTo(
          pools[resource] / AQUARIUM_AREA,
          12,
        );
      }
    }
  });

  it("breeds carriers whose children inherit their neurons, holding carbon and oxygen", () => {
    const world = run(CARRIERS, 1500);

    expect(getCumulativeBirths(world)).toBeGreaterThan(0);
    expect(Math.abs(getCarbonDrift(world))).toBeLessThan(1e-9);
    expect(Math.abs(getOxygenDrift(world))).toBeLessThan(1e-9);

    const foundingIds = new Set(
      getPopulation(createWorld(1234, {generation0: {founders: CARRIERS}}))
        .flatMap((organism) => organism.organelles)
        .map((organelle) => organelle.innovationId),
    );
    // The structural law is live (#63): a split mints a new id, so a
    // descendant holds founding ids it inherited and minted ones it did not.
    const ids = getPopulation(world).flatMap((organism) =>
      organism.organelles.map((organelle) => organelle.innovationId),
    );
    expect(ids.some((id) => foundingIds.has(id))).toBe(true);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it("reaches the same hash at tick N in two runs from the same carriers", () => {
    expect(hashState(run(CARRIERS, 300))).toBe(hashState(run(CARRIERS, 300)));
  });

  it("folds the organelles into the hash, so carriers and bare twins hash apart", () => {
    expect(
      hashState(createWorld(1234, {generation0: {founders: CARRIERS}})),
    ).not.toBe(hashState(createWorld(1234, {generation0: {founders: BARE}})));
  });
});

describe("the roster and the Innovation Id counter (M7)", () => {
  const ticks = (world: World, count: number): World => {
    let current = world;
    for (let tick = 0; tick < count; tick++) {
      ({world: current} = advance(current, FIXED_DT_MS));
    }
    return current;
  };

  it("defaults to the neuron, and an empty roster is M6's world", () => {
    const reference = createWorld(1234);
    const explicit = createWorld(1234, {roster: ["neuron"]});
    const m6 = createWorld(1234, {roster: []});

    expect(hashState(explicit)).toBe(hashState(reference));
    expect(hashState(m6)).not.toBe(hashState(reference));
    expect(
      getPopulation(m6).every((organism) => organism.organelles.length === 0),
    ).toBe(true);
  });

  it("never inserts a neuron into an unprimed world with an empty roster", () => {
    const world = ticks(createWorld(1, {roster: []}), 1500);

    expect(getCumulativeBirths(world)).toBeGreaterThan(0);
    for (const organism of getPopulation(world)) {
      expect(organism.organelles).toHaveLength(0);
    }
  });

  it("lets neurons appear in an unprimed world, with distinct minted ids and the counter past them", () => {
    let carriers = 0;
    for (const seed of [1, 2, 3]) {
      const world = ticks(createWorld(seed), 3000);
      const ids = getPopulation(world).flatMap((organism) =>
        organism.organelles.map((organelle) => organelle.innovationId),
      );
      carriers += getPopulation(world).filter(
        (organism) => organism.organelles.length > 0,
      ).length;

      expect(ids.every((id) => id > 0)).toBe(true);
      expect(getNextInnovationId(world)).toBeGreaterThan(Math.max(0, ...ids));
      expect(Math.abs(getCarbonDrift(world))).toBeLessThan(1e-9);
      expect(Math.abs(getOxygenDrift(world))).toBeLessThan(1e-9);
    }
    expect(carriers).toBeGreaterThan(0);
  });

  it("reaches the same hash at tick N in two runs of the default world", () => {
    expect(hashState(ticks(createWorld(2), 1500))).toBe(
      hashState(ticks(createWorld(2), 1500)),
    );
  });
});

describe("placeFounders (M7)", () => {
  it("stores each founder's layout relaxed and recentred, so its genome holds the body it builds (ADR-0034)", () => {
    const {population} = placeFounders(createRngStream(1234), [
      {
        x: 20,
        y: 5,
        genome: {
          ...BASELINE_GENOME,
          genes: [
            {type: "neuron", x: 3, y: 3, radius: 0.2},
            {type: "neuron", x: 3.05, y: 3, radius: 0.15},
            {type: "neuron", x: 3, y: 3.05, radius: 0.1},
          ],
        },
      },
    ]);
    const founder = population[0];

    // Equal to rounding: recentring a layout already centred moves it by
    // the last bits of a centre that computes to ~1e-16 rather than 0.
    expect(founder.genome.genes).toHaveLength(founder.organelles.length);
    for (const [i, gene] of founder.genome.genes.entries()) {
      const organelle = founder.organelles[i];
      expect(gene.innovationId).toBe(organelle.innovationId);
      expect(gene.radius).toBe(organelle.radius);
      expect(gene.x).toBeCloseTo(organelle.x, 12);
      expect(gene.y).toBeCloseTo(organelle.y, 12);
    }
    // And the stored layout is no longer the one the caller wrote down.
    expect(founder.genome.genes[0]?.x).not.toBe(3);
  });
});
