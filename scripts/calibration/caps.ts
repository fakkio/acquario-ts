import {
  AQUARIUM_AREA,
  createWorld,
  getCumulativeBirths,
  getPoolLevels,
  getPopulation,
  type Diffusible,
} from "../../src/world";
import {heading, integer, note, num, table} from "./report";
import {CAPS_TICKS, seeds} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * The Reference World section of ADR-0035's before/after table (#69, #71):
 * persistence, births, and each diffusible's highest internal concentration
 * next to its ledger's ambient total. Report only: nothing here asserts
 * (ADR-0024). The cap-binding columns of the "before" table went with the
 * caps (#70); no diffusible has a cap to bind.
 *
 * Everything comes through `createWorld`, `advance` and the readers: the
 * highest internal concentrations are read off the population after each tick.
 */

const DIFFUSIBLES: readonly Diffusible[] = ["food", "oxygen", "carbonDioxide"];

interface CapsRun {
  readonly seed: number;
  readonly minPopulation: number;
  readonly finalPopulation: number;
  readonly births: number;
  readonly meanGeneration: number;
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
  const peak = {food: 0, oxygen: 0, carbonDioxide: 0};
  let peakCarbon = 0;
  let peakOxygen = 0;
  let minPopulation = Infinity;

  const finished = runTicksWatching(start, CAPS_TICKS, (world) => {
    const population = getPopulation(world);
    minPopulation = Math.min(minPopulation, population.length);
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
    peak,
    peakCarbon,
    peakOxygen,
    ambientCarbon: (pools.food + pools.carbonDioxide) / AQUARIUM_AREA,
    ambientOxygen: (pools.oxygen + pools.carbonDioxide) / AQUARIUM_AREA,
  };
}

export function reportCaps(): void {
  const runs = seeds().map(measureSeed);

  heading("The Reference World — persistence and births");
  note(
    `  Seeds ${seeds().join(", ")}, ${integer(CAPS_TICKS)} ticks each, mortal and fertile, as the app runs it.`,
  );
  table(
    ["seed", "min pop", "final pop", "births", "mean gen"],
    runs.map((run) => [
      String(run.seed),
      integer(run.minPopulation),
      integer(run.finalPopulation),
      integer(run.births),
      num(run.meanGeneration, 3),
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
