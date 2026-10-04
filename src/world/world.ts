import {depositRemains, evaluateDeaths, type Remains} from "./death";
import {ExchangeSettlement} from "./environment";
import {type Genome} from "./genome";
import {buildUniformGrid, type GridOccupancy} from "./grid";
import {EMPTY_HASH, foldString, toHashString} from "./hash";
import {isBright} from "./light";
import {
  foldPools,
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
  type RespirationOutcome,
} from "./metabolism";
import {
  appendBirths,
  evaluateMitosis,
  mintBirths,
  type PendingBirth,
} from "./mitosis";
import {DEFAULT_ROSTER, type OrganelleType} from "./organelles";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {
  createPopulation,
  foldPopulation,
  placeFounders,
  type Founder,
  type Organism,
  type OrganismView,
  type PopulationDraw,
} from "./organism";
import {createRngStream, type RngStream} from "./rng";
import {separateOverlaps, worstPenetration} from "./separation";

/**
 * Fixed simulation step, decoupled from `requestAnimationFrame`: how much real
 * time one tick stands for. The tick is the simulation's own unit of time, so
 * every world quantity is expressed per tick and never per frame; this
 * constant is only the exchange rate between the two, and belongs to the
 * accumulator below rather than to any quantity the world computes.
 */
export const FIXED_DT_MS = 1000 / 60;

/**
 * Bounds how much real time a single `advance` call will turn into ticks,
 * so a tab backgrounded for minutes can't trigger a catch-up "spiral of
 * death" on resume. Excess elapsed time beyond the cap is dropped, not
 * carried forward.
 */
const MAX_TICKS_PER_ADVANCE = 240;

/**
 * Guards the tick-count division against floating-point drift: summing
 * fractional-millisecond remainders across many `advance` calls can leave
 * the accumulator a hair under a full tick's worth of time.
 */
const EPSILON_MS = 1e-9;

/** What the immortal world hands step 8: nothing is ever condemned there. */
const NO_REMAINS: readonly Remains[] = [];

/** What an infertile world hands step 7: nobody is ever evaluated for
 * mitosis there — see `FertilityMode`. */
const NO_BIRTHS: readonly PendingBirth[] = [];

/**
 * Whether a world lets energy fall below zero. `"off"` is the **immortal
 * world** (ADR-0017): an instrument, not M2 scaffolding — ADR-0015 measures
 * `α` in it, and M5 has to be able to measure it again once calibration
 * moves the constants. `"on"`, the default from M3, is the mortal world
 * death eventually acts in.
 *
 * A string union rather than a boolean so no call site ever reads
 * `immortal: false` — the mode names the state a world is *in*, not a
 * feature it lacks.
 */
export type MortalityMode = "on" | "off";

/**
 * Whether a world's organisms reproduce (ADR-0020, glossary: Fertility).
 * `"off"` is not sterility as a trait: no organism in such a world
 * evaluates mitosis at all, the same way `mortality: "off"` never lets an
 * organism reach the death predicate. `"on"` is the default from M4 — a
 * population can grow for the first time in the project's history.
 *
 * Independent of `MortalityMode`, deliberately: they are two different
 * mechanisms, one a floor under energy and the other a step in the resolve
 * phase, and collapsing them into one flag would mean `mortality` silently
 * controlling something that is not mortality. A world constructed with
 * both off is ADR-0020's **Fixed Population** — ADR-0015's instrument,
 * where `α` is measured free of any selection.
 */
export type FertilityMode = "on" | "off";

/**
 * Where a world's generation 0 comes from, in the two forms M5 needs.
 *
 * `{baselineGenome}` is the world the app runs: `STARTING_POPULATION`
 * founders independently mutated from one genome, exactly as M4 placed
 * them, but with the genome as an argument — the done-criteria runs vary
 * the starting point as well as the seed, one of them starting *above* the
 * target so drift has no downhill excuse for landing where selection would
 * (ADR-0025).
 *
 * `{founders}` is the world the calibration harness builds: every body
 * placed by hand. It exists because generation 0's natural spread of radii
 * is `[1/1.4, 1.4]`, which is far too narrow to fit an income exponent
 * against.
 *
 * One field rather than two options, because both are answers to the same
 * question, and the question has exactly one answer per world. Omitting it
 * keeps `BASELINE_GENOME` and the behaviour M4 shipped.
 */
export type Generation0 =
  {readonly baselineGenome: Genome} | {readonly founders: readonly Founder[]};

export interface WorldOptions {
  readonly mortality?: MortalityMode;
  readonly fertility?: FertilityMode;
  readonly generation0?: Generation0;
  /**
   * The organelle types the world's structural mutation draws insertions
   * from (ADR-0032). Defaults to M7's roster, the neuron; an empty roster
   * is M6's world, with no structural event ever drawn.
   */
  readonly roster?: readonly OrganelleType[];
}

declare const worldBrand: unique symbol;

/**
 * Opaque outside this module: the type carries none of its own fields, so
 * a consumer can hold a `World` and pass it to `advance`/`hashState` but
 * cannot read its tick count, accumulator remainder or PRNG state directly.
 *
 * **A `World` is not a snapshot of the past.** Its own record is immutable
 * and `advance` returns a new one, but the population it holds is an array
 * of mutable `Organism` instances mutated in place, per ADR-0013's choice
 * of OOP over SoA. A caller holding an older `World` therefore reads
 * *current* body positions, not the ones that were current when it captured
 * the reference. Only the clock, the accumulator and the global PRNG stream
 * are versioned per `advance`.
 */
export interface World {
  readonly [worldBrand]: never;
}

interface WorldState {
  readonly seed: number;
  readonly tick: number;
  readonly accumulatorMs: number;
  readonly globalRng: RngStream;
  /**
   * The world's mortality mode (ADR-0017). Deliberately **not** folded into
   * `hashState`: a hash identifies a state, not the law that produced it,
   * and two worlds of different mode at tick 0 are the same state — they
   * only diverge once a tick charges maintenance. Folding it in would
   * invalidate every hash M2 recorded, for nothing.
   */
  readonly mortality: MortalityMode;
  /**
   * The world's fertility mode (ADR-0020). Deliberately **not** folded into
   * `hashState`, for the same reason `mortality` is not: a hash identifies
   * a state, not the law that produced it.
   */
  readonly fertility: FertilityMode;
  /**
   * The world's roster (ADR-0032). Not folded into `hashState` either: it
   * is the law that produced a state, and a genome's organelles already
   * carry what it drew.
   */
  readonly roster: readonly OrganelleType[];
  /** Carried by reference across `advance`: the array is versioned with the
   * record, the organisms inside it are not. */
  readonly population: readonly Organism[];
  readonly pools: Pools;
  /**
   * Total carbon and oxygen at tick 0, kept for the lifetime of the world
   * so the HUD and the tests can read conservation as *relative drift*
   * rather than as an absolute value — a leak in the twelfth significant
   * digit is visible against a value near 0 and invisible against a large
   * constant. Derived readouts, not simulation state: nothing in a tick
   * reads them back, so they stay out of `hashState`, the same way
   * `getWorstPenetration` does.
   */
  readonly initialTotalCarbon: number;
  readonly initialTotalOxygen: number;
  /**
   * ADR-0015's `α`, in the two readings ADR-0023 asks for: this tick's
   * respiration energy over body radius, averaged over organisms whose
   * respiration was *not* throttled by a full energy store, from the tick
   * that has just run — once over the whole population and once over the
   * bright band alone. Read fresh every tick and never smoothed here —
   * smoothing is the App layer's job, so a moving average never becomes
   * state this record has to carry, and stays out of `hashState` for the
   * same reason `initialTotalCarbon` does: nothing in a tick reads it back.
   */
  readonly measuredAlpha: MeasuredAlpha;
  /**
   * How many organisms have died since this world's creation, summed across
   * every tick rather than read per-tick: `advance` can run up to
   * `MAX_TICKS_PER_ADVANCE` ticks inside one catch-up frame, and a per-tick
   * readout would show only the last batch's toll and silently drop the
   * rest. Only ever advances in the mortal world — the immortal world's
   * floor never lets step 8 condemn anyone. Derived, and nothing in a tick
   * reads it back, so it stays out of `hashState` for the same reason
   * `measuredAlpha` does.
   */
  readonly cumulativeDeaths: number;
  /**
   * How many organisms have been born since this world's creation, summed
   * across every tick rather than read per-tick, for the same reason
   * `cumulativeDeaths` is: `advance` can run up to `MAX_TICKS_PER_ADVANCE`
   * ticks inside one catch-up frame, and a per-tick readout would show only
   * the last batch's births and silently drop the rest. Only ever advances
   * in a fertile world — an infertile one never evaluates mitosis at all.
   * Derived, and nothing in a tick reads it back, so it stays out of
   * `hashState` for the same reason `cumulativeDeaths` does.
   */
  readonly cumulativeBirths: number;
  /**
   * The world's Innovation Id counter (ADR-0028): the next id a new
   * structural gene receives, advancing monotonically. Generation 0 mints
   * its founders' ids from it, and the commit step mints each
   * child's new genes in birth order. Part of the world's own state, yet
   * deliberately **not** folded into `hashState`: an id's value never
   * reaches behaviour, and every id minted is folded through the gene that
   * holds it (`foldPopulation`).
   */
  readonly nextInnovationId: number;
}

function toWorld(state: WorldState): World {
  return state as unknown as World;
}

function toState(world: World): WorldState {
  return world as unknown as WorldState;
}

export interface AdvanceResult {
  readonly world: World;
  readonly ticksRun: number;
}

export function createWorld(seed: number, options: WorldOptions = {}): World {
  const roster = options.roster ?? DEFAULT_ROSTER;
  const {population, stream, nextInnovationId} = placeGeneration0(
    createRngStream(seed),
    options.generation0,
    roster,
  );
  // The carbon ledger's one-time construction: generation 0 starts at
  // diffusive equilibrium, and every later tick's conservation check reads
  // its drift from the totals struck right here.
  const pools = initializeMetabolism(population);

  return toWorld({
    seed,
    tick: 0,
    accumulatorMs: 0,
    globalRng: stream,
    mortality: options.mortality ?? "on",
    fertility: options.fertility ?? "on",
    roster,
    population,
    pools,
    initialTotalCarbon: totalCarbon(population, pools),
    initialTotalOxygen: totalOxygen(population, pools),
    // No tick has run yet, so both readings report the value a tick that
    // produced no energy at all would.
    measuredAlpha: NO_ENERGY_PRODUCED,
    cumulativeDeaths: 0,
    cumulativeBirths: 0,
    nextInnovationId,
  });
}

/**
 * `WorldOptions.generation0`, resolved to the population it names. The
 * default arm calls `createPopulation` with no genome argument rather than
 * with `BASELINE_GENOME` spelled out: one default, held where the placement
 * rule lives, so the two cannot drift apart.
 */
function placeGeneration0(
  stream: RngStream,
  generation0: Generation0 | undefined,
  roster: readonly OrganelleType[],
): PopulationDraw {
  if (generation0 === undefined) {
    return createPopulation(stream, undefined, roster);
  }

  return "founders" in generation0
    ? placeFounders(stream, generation0.founders)
    : createPopulation(stream, generation0.baselineGenome, roster);
}

/**
 * One tick of simulated time, laid out as ADR-0006's three phases.
 *
 * Deliberately private: `advance` stays the only door the App layer walks
 * through, so nothing outside this module can run half a tick or run one
 * out of order. The accumulator's remainder stays `advance`'s bookkeeping
 * and is written once the catch-up loop is done, so a tick never reads a
 * half-updated one; a tick's only clock business is the increment at
 * step 13.
 *
 * The numbered steps are ADR-0006's. Every step that has no work yet is
 * named below with the milestone that fills it, so later work has a place
 * to land rather than a decision to re-make.
 */
function runTick(state: WorldState): WorldState {
  // ---- Read: sample the environment into a snapshot ----------------
  // 1. Snapshot concentrations and light. `state.pools` is already an
  //    immutable record, so building the tick's `ExchangeSettlement` from
  //    it *is* taking the snapshot — nothing here copies it. Light needs
  //    no snapshot at all: `lightAt` is a pure function of depth.
  const settlement = new ExchangeSettlement(state.pools);

  // ---- Resolve: per organism, no writes to the world ---------------
  // Every step here reads the snapshot and writes only to the organism
  // it is running for. That restriction is what makes the phase
  // order-independent by construction, and it is the whole reason the
  // metabolic core is unit-testable against one organism and a snapshot.
  // 2. Passive exchange, in the two sub-passes ADR-0016 requires: 2a
  //    every organism registers the flux it wants against the same
  //    `Environment` interface, writing nothing; between the passes the
  //    per-pool scaling factor is struck from total demand; 2b every
  //    organism is handed its granted amount and ends the tick holding
  //    it. `applyPassiveExchange` does not know which sub-pass it runs
  //    in — only the `Environment` it is given each time does.
  const requestEnvironment = settlement.requestPass();
  for (const organism of state.population) {
    applyPassiveExchange(organism, requestEnvironment);
  }
  settlement.settle();
  const grantEnvironment = settlement.grantPass();
  for (const organism of state.population) {
    applyPassiveExchange(organism, grantEnvironment);
  }
  // 3. Photosynthesis: CO₂ + light → food + O₂, no energy produced. Runs
  //    after both exchange sub-passes above, against the same
  //    `grantEnvironment`, so it reads this tick's settled CO₂ rather than
  //    last tick's, and reads light off the same seam even though the
  //    reaction never calls `exchange` itself.
  for (const organism of state.population) {
    applyPhotosynthesis(organism, grantEnvironment);
  }
  // 4. Respiration: food + O₂ → energy + CO₂, chained after photosynthesis
  //    so an illuminated organism nets light → energy within this tick
  //    (ADR-0006, and the load-bearing comment on `applyRespiration`).
  //    Every outcome is kept, not just applied, so this tick's population
  //    mean `α` (ADR-0015) can be struck below without a second pass over
  //    the population.
  const respirationOutcomes = state.population.map((organism) =>
    applyRespiration(organism),
  );
  // 5. Maintenance: c₀ + β·area, charged in full and unconditionally
  //    (ADR-0017) — whether the result is allowed to go below zero is this
  //    world's mortality mode, not this reaction's business.
  for (const organism of state.population) {
    applyMaintenance(organism);
  }
  // Immortal floor (ADR-0017), not one of ADR-0006's numbered steps: only
  // in a world constructed with `mortality: "off"` does energy stop here
  // rather than falling below zero — the instrument ADR-0015 measures `α`
  // in, and M5 must be able to reconstruct after calibration moves the
  // constants. In a mortal world this line does not run, and energy passes
  // through zero to negative, which step 8 (M3) reads to condemn the
  // organism.
  if (state.mortality === "off") {
    for (const organism of state.population) {
      organism.energy = Math.max(0, organism.energy);
    }
  }
  const measuredAlpha = meanMeasuredAlpha(
    state.population,
    respirationOutcomes,
  );
  // 6. Brownian motion.
  for (const organism of state.population) {
    applyBrownianMotion(organism);
  }
  // 7. Evaluate mitosis: per organism, writing only to that organism —
  //    exactly like the steps above — and enqueuing a pending birth
  //    (ADR-0019). Runs *before* step 8 reads energy, deliberately: the
  //    parent pays here, so an organism that breeds at exactly its
  //    threshold and then cannot cover its own maintenance is condemned by
  //    the very next step, its child already alive. Only a fertile world
  //    evaluates this at all — an infertile one never asks, the same way
  //    an immortal world never lets step 8's predicate fire.
  const births: readonly PendingBirth[] =
    state.fertility === "on"
      ? state.population
          .map((organism) => evaluateMitosis(organism, state.roster))
          .filter((birth): birth is PendingBirth => birth !== null)
      : NO_BIRTHS;
  // 8. Evaluate death: `energy <= 0` condemns an organism (ADR-0017), and
  //    its remains are frozen here, pre-separation — step 10 has not run
  //    yet, so a condemned organism still gets to move on its final tick,
  //    and it deposits the position it died at rather than the one its
  //    neighbours push it to. Only the mortal world evaluates this: the
  //    immortal world's floor two steps up never lets energy reach the
  //    predicate, which is what keeps ADR-0015's fixed population fixed.
  const {survivors, remains} =
    state.mortality === "on"
      ? evaluateDeaths(state.population)
      : {survivors: state.population, remains: NO_REMAINS};

  // ---- Commit: every world mutation, in a fixed order --------------
  // 9. Apply delta buffer: the exchange settlement's grants, decided in
  //    2b above, applied to the pools at this one well-defined point.
  const poolsAfterExchange = settlement.commit();
  // 10. Collisions and walls, run over the *whole* population, condemned
  //     organisms included — ADR-0017's point exactly. The grid is built
  //     here, consumed by the separation pass, and dropped when the tick
  //     ends: it is an index of where the bodies are *now*, and the only
  //     place that is true is between the last write to a position and the
  //     next one. Separation runs ahead of the wall constraint, so a body
  //     pushed out of another body still ends the tick inside the
  //     aquarium.
  separateOverlaps(state.population, buildUniformGrid(state.population));
  for (const organism of state.population) {
    constrainToAquarium(organism);
  }
  // 11. Deaths: step 8's remains are deposited into the pools settled at
  //     step 9, and the population becomes step 8's survivors — never a
  //     second evaluation of the predicate (ADR-0017).
  const pools = depositRemains(poolsAfterExchange, remains);
  // 12. Births: step 7's pending births are constructed, constrained to
  //     the aquarium — step 10's separation and wall clamp have already
  //     run for everyone else this tick — and appended (ADR-0019).
  //     Appended rather than spliced in, so newborns are inert for their
  //     first tick: the iteration above never sees them, which rules out
  //     half-initialised organisms metabolising or a birth cascade within
  //     one tick.
  //     Each child's provisional Innovation Ids are minted first, from the
  //     world's counter in birth order (ADR-0028).
  const minted = mintBirths(births, state.nextInnovationId);
  const population = appendBirths(survivors, minted.births);
  // 13. Tick++.
  return {
    ...state,
    pools,
    population,
    tick: state.tick + 1,
    measuredAlpha,
    cumulativeDeaths: state.cumulativeDeaths + remains.length,
    cumulativeBirths: state.cumulativeBirths + births.length,
    nextInnovationId: minted.nextInnovationId,
  };
}

/**
 * ADR-0015's `α`, read twice over the same tick (ADR-0023). `whole` is the
 * population mean M2 shipped, unchanged; `bright` is the same mean taken
 * over the organisms inside the **bright band** — the only ones that can
 * ever contribute a birth, and therefore the only ones `c₀` is worth
 * solving against, since selection acts through reproduction alone.
 *
 * Two scalars, never an array of depth bins: ADR-0015's depth-binned
 * consequence was withdrawn with the CSV it existed for (ADR-0024), and an
 * array allocated every tick for a reader that no longer exists is a cost
 * with nothing on the other side of it.
 */
interface MeasuredAlpha {
  readonly whole: number;
  readonly bright: number;
}

/** What both readings report for a tick with no admissible organism in it
 * — the same value a tick that produced no energy at all would. */
const NO_ENERGY_PRODUCED: MeasuredAlpha = {whole: 0, bright: 0};

/**
 * ADR-0015's population mean: `energyProduced / bodyRadius`, averaged over
 * every organism whose respiration this tick was *not* throttled by a full
 * energy store — those measure the size of their own tank rather than the
 * income available to them. Organisms at zero energy stay in: they are
 * genuinely poor, and that is part of what the mean has to say. Reads 0
 * for a population that is entirely throttled, the same value a tick that
 * produced no energy at all would report.
 *
 * One fold producing both readings rather than two folds over the same
 * array (ADR-0023: "the same fold with one more predicate"). The depth
 * predicate sits beside the throttle predicate rather than replacing it:
 * an organism excluded from the whole-population mean is excluded from the
 * band's too, so the two numbers stay comparable — the only thing that
 * differs between them is the set, never the rule.
 */
function meanMeasuredAlpha(
  population: readonly Organism[],
  outcomes: readonly RespirationOutcome[],
): MeasuredAlpha {
  let sum = 0;
  let count = 0;
  let brightSum = 0;
  let brightCount = 0;
  for (let i = 0; i < population.length; i++) {
    const outcome = outcomes[i];
    if (outcome.throttledByFullEnergyStore) {
      continue;
    }
    const organism = population[i];
    const alpha = outcome.energyProduced / organism.bodyRadius;
    sum += alpha;
    count++;
    if (isBright(organism.y)) {
      brightSum += alpha;
      brightCount++;
    }
  }

  return {
    whole: count > 0 ? sum / count : 0,
    bright: brightCount > 0 ? brightSum / brightCount : 0,
  };
}

export function advance(world: World, elapsedMs: number): AdvanceResult {
  const state = toState(world);
  const maxAccumulatorMs = MAX_TICKS_PER_ADVANCE * FIXED_DT_MS;
  const accumulatorMs = Math.min(
    state.accumulatorMs + elapsedMs,
    maxAccumulatorMs,
  );

  const ticksRun = Math.floor((accumulatorMs + EPSILON_MS) / FIXED_DT_MS);

  let ticked = state;
  for (let i = 0; i < ticksRun; i++) {
    ticked = runTick(ticked);
  }

  return {
    world: toWorld({
      ...ticked,
      accumulatorMs: Math.max(0, accumulatorMs - ticksRun * FIXED_DT_MS),
    }),
    ticksRun,
  };
}

export function getTick(world: World): number {
  return toState(world).tick;
}

export function getSeed(world: World): number {
  return toState(world).seed;
}

/**
 * The render layer's one window onto the population. `OrganismView` is the
 * read-only face of `Organism`, so the App layer can draw a body without
 * being able to move one: positions change inside a tick's commit phase or
 * nowhere.
 */
export function getPopulation(world: World): readonly OrganismView[] {
  return toState(world).population;
}

/**
 * What the grid debug overlay draws: the population bucketed by the same
 * rule neighbour queries bucket by, flattened to counts.
 *
 * It builds a grid of its own on every call, and throws it away. That is the
 * point rather than a shortcut. An overlay is only worth drawing if it cannot
 * disagree with the index it depicts, and the way to guarantee that is to
 * call `buildUniformGrid` rather than to re-derive cell boundaries in the
 * render layer — a grid is a pure function of the population, so the cells
 * this reads are the cells any other build would read. Handing the render
 * layer a *stored* grid instead would be the thing to avoid: a grid belongs
 * to the tick that built it and outlives nothing.
 */
export function getGridOccupancy(world: World): GridOccupancy {
  return buildUniformGrid(toState(world).population).occupancy();
}

/**
 * What the HUD reads: how deep the worst-overlapping pair of bodies currently
 * stands, in baseline body radii.
 *
 * Measured on demand from the population as it stands rather than recorded by
 * the tick that separated it, for the same reason `getGridOccupancy` builds
 * its own grid: a stored number would be a claim about a moment that has
 * passed, and a readout of an invariant is worth having only if it cannot
 * disagree with the state it describes. It is also not simulation state —
 * nothing reads it back into the world — so it stays out of `hashState`,
 * where it would only restate positions the hash already covers.
 */
export function getWorstPenetration(world: World): number {
  const {population} = toState(world);

  return worstPenetration(population, buildUniformGrid(population));
}

/**
 * How rich the three pools currently sit — the HUD's window onto
 * ADR-0001's ledger. Hands back amounts, not concentrations: dividing by
 * `AQUARIUM_AREA` is a display decision the App layer can make for itself.
 */
export function getPoolLevels(world: World): Pools {
  return toState(world).pools;
}

/** `(current − initial) / initial`. Reads as 0 while a ledger holds and as
 * a fraction the moment it does not — the shared shape behind
 * `getCarbonDrift` and `getOxygenDrift`, stating conservation as drift
 * rather than as an absolute value (ADR-0001). */
function relativeDrift(current: number, initial: number): number {
  return (current - initial) / initial;
}

/** Total carbon now, relative to total carbon at tick 0. See
 * `relativeDrift`. */
export function getCarbonDrift(world: World): number {
  const state = toState(world);

  return relativeDrift(
    totalCarbon(state.population, state.pools),
    state.initialTotalCarbon,
  );
}

/** Total oxygen now, relative to total oxygen at tick 0. See
 * `relativeDrift`. */
export function getOxygenDrift(world: World): number {
  const state = toState(world);

  return relativeDrift(
    totalOxygen(state.population, state.pools),
    state.initialTotalOxygen,
  );
}

/** ADR-0015's population-mean `α`, from the tick that has just run. Raw
 * and unsmoothed: smoothing it into something legible on the HUD is the
 * App layer's job, so it adds no state here. */
export function getMeasuredAlpha(world: World): number {
  return toState(world).measuredAlpha.whole;
}

/**
 * ADR-0023's reading of the same tick: `α` over the **bright band** alone,
 * the depth range fixed in advance by `BRIGHT_BAND_DEPTH`.
 *
 * This is the one `c₀` is solved against. `c₀ = α·r_opt/2` decides where
 * `bodyRadius` converges, convergence is produced by reproduction, and in
 * v0.1 reproduction happens only in the light — so a mean that includes
 * organisms which will never contribute a birth predicts an optimum for a
 * depth no lineage occupies. Reads 0 for a tick with nobody admissible in
 * the band, exactly as `getMeasuredAlpha` does for an empty population.
 */
export function getBrightAlpha(world: World): number {
  return toState(world).measuredAlpha.bright;
}

/**
 * How many organisms sit at exactly zero energy right now. Measured on
 * demand from the population as it stands, for the same reason
 * `getWorstPenetration` builds its own grid rather than reading a stored
 * count: an organism's energy is live, mutable state, so a readout of it
 * is worth having only if it cannot disagree with the state it describes.
 *
 * **Scoped to the immortal world** (ADR-0017): there, the maintenance floor
 * holds a starved organism exactly at zero, which is exactly the signal
 * that the constants are wrong — and M5 measures `α` in this world. In the
 * mortal world energy passes straight through zero to negative and the
 * organism is condemned the same tick (`getCumulativeDeaths` is that
 * world's counterpart), so nothing ever rests here to be counted and this
 * reads 0 unconditionally rather than run a filter that would always come
 * back empty.
 */
export function getZeroEnergyCount(world: World): number {
  const state = toState(world);
  if (state.mortality === "on") {
    return 0;
  }

  return state.population.filter((organism) => organism.energy === 0).length;
}

/**
 * How many organisms have died since this world was created — cumulative,
 * not per-tick, so a catch-up `advance` call that runs a whole batch of
 * ticks loses no death to the readout (see the field's own comment on
 * `WorldState`). Reads 0 for the lifetime of an immortal world, whose
 * counterpart readout is `getZeroEnergyCount`.
 */
export function getCumulativeDeaths(world: World): number {
  return toState(world).cumulativeDeaths;
}

/**
 * How many organisms have been born since this world was created —
 * cumulative, not per-tick, for the same reason `getCumulativeDeaths` is
 * (see the field's own comment on `WorldState`). Reads 0 for the lifetime
 * of an infertile world, whose counterpart mode `mortality: "off"` is to
 * `getCumulativeDeaths`.
 */
export function getCumulativeBirths(world: World): number {
  return toState(world).cumulativeBirths;
}

/**
 * The next Innovation Id the world will mint (ADR-0028). A readout for
 * tests: no id's value is ever read by behaviour.
 */
export function getNextInnovationId(world: World): number {
  return toState(world).nextInnovationId;
}

/**
 * The determinism probe: it does not make the world deterministic, it
 * compares two worlds and says whether they are still the same one. The
 * invariant it serves is precisely **same seed and same tick number ⇒ same
 * hash**, not "same seed and same wall-clock time elapsed".
 *
 * `accumulatorMs` is deliberately left out, and the omission is load-bearing.
 * It is the only state here that is a function of how the browser chopped up
 * real time rather than of the simulation, and absorbing that jitter so the
 * simulation never sees it is the fixed-step accumulator's whole job. Two
 * runs from one seed, one at a steady 60fps and one with long frames, reach
 * tick 100 with identical simulated state and different leftover remainders
 * — hashing the remainder would fail them as divergent when they are as
 * deterministic as a run can be. The carried remainder is covered by the
 * accumulator's own tests instead.
 *
 * Note what this does *not* promise: the catch-up cap drops excess elapsed
 * time, so two runs that stalled differently sit at different tick counts
 * after the same wall-clock span. That is divergence in how far each got,
 * never in what either computed.
 *
 * Every organism's position, radius and stream state folds in too, via
 * `foldPopulation` — including, from M2, its four internal resource
 * stores. The three pools fold in via `foldPools`. Anything later
 * milestones add to an organism or to the world's own state must be
 * folded in as well, or the invariant quietly stops covering it. Derived
 * readouts — `initialTotalCarbon`/`initialTotalOxygen` among them — stay
 * out: the rule is what the next tick *reads*, not what the HUD shows.
 */
export function hashState(world: World): string {
  const state = toState(world);
  const worldOwnState = `${String(state.seed)}|${String(state.tick)}|${String(state.globalRng.state)}`;

  return toHashString(
    foldPools(
      foldPopulation(foldString(EMPTY_HASH, worldOwnState), state.population),
      state.pools,
    ),
  );
}
