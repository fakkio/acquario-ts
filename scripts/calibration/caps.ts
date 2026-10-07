import {
  AQUARIUM_AREA,
  createWorld,
  getCapBinding,
  getCumulativeBirths,
  getPoolLevels,
  getPopulation,
  type CapBinding,
  type Diffusible,
} from "../../src/world";
import {heading, integer, note, num, percent, table} from "./report";
import {CAPS_TICKS, seeds} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * How much the diffusibles' caps bind on the Reference World (#69, ADR-0035's
 * "before" table). Report only: nothing here asserts (ADR-0024). It lives
 * between the readout ticket and the law ticket: the caps it reads are the
 * ones the law deletes.
 *
 * Everything comes through `createWorld`, `advance` and the readers. The
 * binding counts are the tick's own (`getCapBinding`); the highest internal
 * concentrations are read off the population after each tick.
 */

const DIFFUSIBLES: readonly Diffusible[] = ["food", "oxygen", "carbonDioxide"];

interface CapsRun {
  readonly seed: number;
  readonly minPopulation: number;
  readonly finalPopulation: number;
  readonly births: number;
  readonly meanGeneration: number;
  readonly organismTicks: number;
  readonly bound: CapBinding;
  /** Highest internal concentration any organism held on any tick. */
  readonly peak: Readonly<Record<Diffusible, number>>;
  /** Highest internal carbon (food + CO₂) and oxygen (O₂ + CO₂) over the
   * Cytoplasm Area: the ledgers' own sums. */
  readonly peakCarbon: number;
  readonly peakOxygen: number;
  /** The ledgers' ambient totals at tick 0, over the aquarium's area. */
  readonly ambientCarbon: number;
  readonly ambientOxygen: number;
}

function measureSeed(seed: number): CapsRun {
  const start = createWorld(seed);
  const pools = getPoolLevels(start);
  const bound = {food: 0, oxygen: 0, carbonDioxide: 0};
  const peak = {food: 0, oxygen: 0, carbonDioxide: 0};
  let peakCarbon = 0;
  let peakOxygen = 0;
  let minPopulation = Infinity;
  let organismTicks = 0;
  // The reactions run over the population the tick began with, before its
  // deaths and births, so that is the denominator the counts are shares of.
  let reacting = getPopulation(start).length;

  const finished = runTicksWatching(start, CAPS_TICKS, (world) => {
    const counts = getCapBinding(world);
    for (const resource of DIFFUSIBLES) {
      bound[resource] += counts[resource];
    }
    const population = getPopulation(world);
    minPopulation = Math.min(minPopulation, population.length);
    organismTicks += reacting;
    reacting = population.length;
    for (const organism of population) {
      const area = organism.cytoplasmArea;
      for (const resource of DIFFUSIBLES) {
        peak[resource] = Math.max(peak[resource], organism[resource] / area);
      }
      peakCarbon = Math.max(
        peakCarbon,
        (organism.food + organism.carbonDioxide) / area,
      );
      peakOxygen = Math.max(
        peakOxygen,
        (organism.oxygen + organism.carbonDioxide) / area,
      );
    }
  });

  const last = getPopulation(finished);

  return {
    seed,
    minPopulation: Number.isFinite(minPopulation) ? minPopulation : 0,
    finalPopulation: last.length,
    births: getCumulativeBirths(finished),
    meanGeneration:
      last.length > 0
        ? last.reduce((sum, organism) => sum + organism.generation, 0) /
          last.length
        : 0,
    organismTicks,
    bound,
    peak,
    peakCarbon,
    peakOxygen,
    ambientCarbon: (pools.food + pools.carbonDioxide) / AQUARIUM_AREA,
    ambientOxygen: (pools.oxygen + pools.carbonDioxide) / AQUARIUM_AREA,
  };
}

export function reportCaps(): void {
  const runs = seeds().map(measureSeed);

  heading("The caps on the Reference World — how often each one binds");
  note(
    `  Seeds ${seeds().join(", ")}, ${integer(CAPS_TICKS)} ticks each, mortal and fertile, as the app runs it.`,
  );
  note(
    `  "Bound" is the share of organism-ticks where a diffusible's cap headroom was strictly the`,
  );
  note(
    `  smallest limit on a reaction that would otherwise have run: respiration by CO₂,`,
  );
  note(`  photosynthesis by food or O₂.`);
  table(
    [
      "seed",
      "min pop",
      "final pop",
      "births",
      "mean gen",
      "food bound",
      "O₂ bound",
      "CO₂ bound",
    ],
    runs.map((run) => [
      String(run.seed),
      integer(run.minPopulation),
      integer(run.finalPopulation),
      integer(run.births),
      num(run.meanGeneration, 3),
      percent(run.bound.food / run.organismTicks),
      percent(run.bound.oxygen / run.organismTicks),
      percent(run.bound.carbonDioxide / run.organismTicks),
    ]),
  );

  heading("The highest internal concentration, against the ledgers' ambient");
  note(
    `  Over every organism and every tick. Ambient is the pools' level at tick 0 over the`,
  );
  note(
    `  aquarium's area. Internal carbon is food + CO₂, internal oxygen is O₂ + CO₂, both`,
  );
  note(`  over the Cytoplasm Area (ADR-0035's bound).`);
  table(
    [
      "seed",
      "food",
      "O₂",
      "CO₂",
      "carbon (food+CO₂)",
      "ambient carbon",
      "oxygen (O₂+CO₂)",
      "ambient oxygen",
    ],
    runs.map((run) => [
      String(run.seed),
      num(run.peak.food, 3),
      num(run.peak.oxygen, 3),
      num(run.peak.carbonDioxide, 3),
      num(run.peakCarbon, 3),
      num(run.ambientCarbon, 3),
      num(run.peakOxygen, 3),
      num(run.ambientOxygen, 3),
    ]),
  );
}
