import {buildUniformGrid, type GridOccupancy} from "./grid";
import {EMPTY_HASH, foldString, toHashString} from "./hash";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {
  createPopulation,
  foldPopulation,
  type Organism,
  type OrganismView,
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
  /** Carried by reference across `advance`: the array is versioned with the
   * record, the organisms inside it are not. */
  readonly population: readonly Organism[];
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

export function createWorld(seed: number): World {
  const {population, stream} = createPopulation(createRngStream(seed));

  return toWorld({
    seed,
    tick: 0,
    accumulatorMs: 0,
    globalRng: stream,
    population,
  });
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
  // 1. Snapshot concentrations and light — M2.
  //    Nothing to sample yet: the Environment seam (ADR-0005) arrives
  //    with M2, and until it does there is no snapshot to hand to the
  //    phases below.

  // ---- Resolve: per organism, no writes to the world ---------------
  // Every step here reads the snapshot and writes only to the organism
  // it is running for. That restriction is what makes the phase
  // order-independent by construction, and it is the whole reason the
  // metabolic core is unit-testable against one organism and a snapshot.
  // 2. Passive exchange — M2.
  // 3. Photosynthesis — M2.
  // 4. Respiration — M2.
  // 5. Maintenance — M2.
  // 6. Brownian motion.
  for (const organism of state.population) {
    applyBrownianMotion(organism);
  }
  // 7. Evaluate mitosis, enqueue — M4.
  // 8. Evaluate death, enqueue — M3.

  // ---- Commit: every world mutation, in a fixed order --------------
  // 9. Apply delta buffer — M2.
  // 10. Collisions and walls. The grid is built here, consumed by the
  //     separation pass, and dropped when the tick ends: it is an index of
  //     where the bodies are *now*, and the only place that is true is
  //     between the last write to a position and the next one. Separation
  //     runs ahead of the wall constraint, so a body pushed out of another
  //     body still ends the tick inside the aquarium.
  separateOverlaps(state.population, buildUniformGrid(state.population));
  for (const organism of state.population) {
    constrainToAquarium(organism);
  }
  // 11. Deaths — M3.
  // 12. Births — M4. Newborns are appended here and stay inert for
  //     their first tick, so no birth cascades within a tick.
  // 13. Tick++.
  return {...state, tick: state.tick + 1};
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
 * `foldPopulation`. Anything later milestones add to an organism must be
 * added there as well, or the invariant quietly stops covering it.
 */
export function hashState(world: World): string {
  const state = toState(world);
  const worldOwnState = `${String(state.seed)}|${String(state.tick)}|${String(state.globalRng.state)}`;

  return toHashString(
    foldPopulation(foldString(EMPTY_HASH, worldOwnState), state.population),
  );
}
