import {
  BRIGHT_BAND_DEPTH,
  bodyArea,
  createWorld,
  getCumulativeBirths,
  getCumulativeDeaths,
  getPoolLevels,
  getPopulation,
  isBright,
  type OrganismView,
} from "../../src/world";
import {K_DIFFUSION, RHO} from "../../src/world/constants";
import {heading, integer, note, num, percent, row, table} from "./report";
import {LIVE_SAMPLE_EVERY, LIVE_TICKS, SEED} from "./settings";
import {ambientCarbon, runTicksWatching} from "./worlds";

/**
 * The world the app actually runs — mortal, fertile, generation 0 mutated
 * from the baseline — watched for what it does rather than for what it
 * should.
 *
 * Four of the harness's readings come off this one run, because all four
 * are about the same thing and a second run would let them describe
 * different worlds: time to first unaided birth, the population trajectory
 * with births and deaths, peak internal food against the ambient, and
 * ADR-0025's third gate, **tenancy**.
 *
 * "Unaided" is the load-bearing word in the first of those. Nothing here
 * primes a pool or hands an organism a surplus; the run starts where
 * `createWorld` leaves it, which is the only way "this world can reproduce"
 * is a fact about the world rather than about the setup.
 */

/**
 * What the harness remembers about one organism between samples. Keyed by
 * the `OrganismView` itself: the views the world hands out *are* the
 * mutable organisms (ADR-0013), so object identity is a stable name for a
 * body across ticks — which matters because array position is not, once a
 * death in the middle of the population shifts everyone after it.
 */
interface Residence {
  /** The sample this body entered the band on, or null while it is outside. */
  enteredAt: number | null;
}

interface TrajectoryPoint {
  readonly tick: number;
  readonly populationSize: number;
  readonly births: number;
  readonly deaths: number;
  readonly meanBodyRadius: number;
  readonly insideBand: number;
}

interface LiveRun {
  readonly firstBirthTick: number | null;
  readonly trajectory: readonly TrajectoryPoint[];
  readonly births: number;
  readonly deaths: number;
  readonly finalPopulationSize: number;
  readonly peakFoodOverRho: number;
  readonly peakFoodOverAmbient: number;
  readonly meanStayTicks: number;
  readonly completedStays: number;
  readonly openStays: number;
  readonly occupancy: number;
  readonly meanPopulationSize: number;
  readonly meanBodyRadius: number;
}

function sampleResidence(
  residences: Map<OrganismView, Residence>,
  population: readonly OrganismView[],
  sample: number,
  completedStays: number[],
): void {
  const present = new Set(population);
  for (const organism of residences.keys()) {
    if (!present.has(organism)) {
      // Died, or was never seen again. An open stay it was in the middle
      // of goes with it rather than being closed at an arbitrary length: a
      // stay cut short by starvation ended, but it did not finish.
      residences.delete(organism);
    }
  }

  for (const organism of population) {
    let residence = residences.get(organism);
    if (residence === undefined) {
      residence = {enteredAt: null};
      residences.set(organism, residence);
    }
    const inside = isBright(organism.y);
    if (inside && residence.enteredAt === null) {
      residence.enteredAt = sample;
    } else if (!inside && residence.enteredAt !== null) {
      completedStays.push((sample - residence.enteredAt) * LIVE_SAMPLE_EVERY);
      residence.enteredAt = null;
    }
  }
}

function runLive(seed: number): LiveRun {
  const world = createWorld(seed);
  const trajectory: TrajectoryPoint[] = [];
  const residences = new Map<OrganismView, Residence>();
  const completedStays: number[] = [];

  let firstBirthTick: number | null = null;
  let peakFoodOverRho = 0;
  let peakFoodOverAmbient = 0;
  let organismTicks = 0;
  let insideBandTicks = 0;
  let radiusTicks = 0;
  let sample = 0;

  const finished = runTicksWatching(world, LIVE_TICKS, (current, tick) => {
    if (firstBirthTick === null && getCumulativeBirths(current) > 0) {
      firstBirthTick = tick;
    }
    if (tick % LIVE_SAMPLE_EVERY !== 0) {
      return;
    }

    sample++;
    const population = getPopulation(current);
    const ambient = ambientCarbon(getPoolLevels(current));
    let insideBand = 0;
    let radiusSum = 0;

    for (const organism of population) {
      const concentration = organism.food / bodyArea(organism);
      peakFoodOverRho = Math.max(peakFoodOverRho, concentration / RHO);
      peakFoodOverAmbient = Math.max(
        peakFoodOverAmbient,
        concentration / ambient,
      );
      radiusSum += organism.bodyRadius;
      if (isBright(organism.y)) {
        insideBand++;
      }
    }

    sampleResidence(residences, population, sample, completedStays);

    organismTicks += population.length;
    insideBandTicks += insideBand;
    radiusTicks += radiusSum;
    trajectory.push({
      tick,
      populationSize: population.length,
      births: getCumulativeBirths(current),
      deaths: getCumulativeDeaths(current),
      meanBodyRadius: population.length > 0 ? radiusSum / population.length : 0,
      insideBand,
    });
  });

  let openStays = 0;
  for (const residence of residences.values()) {
    if (residence.enteredAt !== null) {
      openStays++;
    }
  }

  const samples = Math.max(1, sample);

  return {
    firstBirthTick,
    trajectory,
    births: getCumulativeBirths(finished),
    deaths: getCumulativeDeaths(finished),
    finalPopulationSize: getPopulation(finished).length,
    peakFoodOverRho,
    peakFoodOverAmbient,
    meanStayTicks:
      completedStays.length > 0
        ? completedStays.reduce((sum, stay) => sum + stay, 0) /
          completedStays.length
        : 0,
    completedStays: completedStays.length,
    openStays,
    occupancy: organismTicks > 0 ? insideBandTicks / organismTicks : 0,
    meanPopulationSize: organismTicks / samples,
    meanBodyRadius: organismTicks > 0 ? radiusTicks / organismTicks : 0,
  };
}

export function reportLiveWorld(): void {
  const run = runLive(SEED);

  heading("A live world — mortal, fertile, unprimed");
  note(
    `  Seed ${String(SEED)}, generation 0 as the app places it, ${integer(LIVE_TICKS)} ticks, sampled every ${String(LIVE_SAMPLE_EVERY)}.`,
  );
  row(
    "time to first unaided birth",
    run.firstBirthTick === null
      ? `never — no birth in ${integer(LIVE_TICKS)} ticks`
      : `tick ${integer(run.firstBirthTick)}`,
  );
  row("cumulative births", integer(run.births));
  row("cumulative deaths", integer(run.deaths));
  row("population size at the end", integer(run.finalPopulationSize));
  row("peak C_food / ρ", num(run.peakFoodOverRho));
  row(
    "peak C_food / s",
    `${num(run.peakFoodOverAmbient)}  (${percent(run.peakFoodOverAmbient)} of ambient)`,
  );

  const shown = run.trajectory.filter(
    (_point, index) => index % Math.ceil(run.trajectory.length / 12) === 0,
  );
  table(
    ["tick", "size", "births", "deaths", "mean r", "in band"],
    shown.map((point) => [
      integer(point.tick),
      integer(point.populationSize),
      integer(point.births),
      integer(point.deaths),
      num(point.meanBodyRadius, 3),
      integer(point.insideBand),
    ]),
  );

  heading("Tenancy — births per stay in the bright band");
  note(
    `  Residence is measured by sampling depth every ${String(LIVE_SAMPLE_EVERY)} ticks against y ≤ ${num(BRIGHT_BAND_DEPTH)},`,
  );
  note(
    `  tracking each body by identity rather than by array position. A stay cut short`,
  );
  note(`  by death is dropped, not counted: it ended, but it did not finish.`);
  row("mean population size", num(run.meanPopulationSize));
  row("mean body radius", num(run.meanBodyRadius));
  row("bright-band occupancy", percent(run.occupancy));
  row(
    "mean completed stay",
    run.completedStays === 0
      ? "no stay both began and ended within the run"
      : `${num(run.meanStayTicks)} ticks over ${integer(run.completedStays)} stays`,
  );
  row("stays still open at the end", integer(run.openStays));

  // Two reproductive periods, because at today's constants the measured one
  // does not exist. The measured one is what the gate is defined against:
  // organism-ticks per birth, i.e. how long a body waits for a child. The
  // proxy is ADR-0022's charging time constant `r / (2·kDiffusion)` — how
  // long a body takes to fill toward the mass gate — which is what sets the
  // reproductive period when there is one, and is the only number available
  // when there is not.
  const lifetimeOrganismTicks = run.meanPopulationSize * LIVE_TICKS;
  const measuredPeriod =
    run.births > 0 ? lifetimeOrganismTicks / run.births : null;
  const proxyPeriod = run.meanBodyRadius / (2 * K_DIFFUSION);
  row(
    "reproductive period, measured",
    measuredPeriod === null
      ? "undefined — nothing was born"
      : `${num(measuredPeriod)} organism-ticks per birth`,
  );
  row("reproductive period, proxy r/(2·kDiff)", `${num(proxyPeriod)} ticks`);
  row(
    "tenancy, measured",
    measuredPeriod === null
      ? "undefined — see above"
      : num(run.meanStayTicks / measuredPeriod),
  );
  row(
    "tenancy, against the proxy",
    run.completedStays === 0 ? "—" : num(run.meanStayTicks / proxyPeriod),
  );
  row("ADR-0025 gate", "tenancy ≥ 5");
}
