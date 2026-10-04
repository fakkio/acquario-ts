import type {OrganelleType, OrganismView} from "../world";

export interface GeneStat {
  readonly mean: number;
  readonly sigma: number;
}

export interface PopulationGeneStatistics {
  /** The derived body radius, not a gene since M7, but folded with the
   * genes because it is what the population looks like on screen. */
  readonly bodyRadius: GeneStat;
  readonly cytoplasmThickness: GeneStat;
  readonly mitosisEnergyThreshold: GeneStat;
  readonly childAllocationRatio: GeneStat;
  readonly lineageHue: GeneStat;
}

/** Reads 0/0 for an empty population rather than `NaN`, so a HUD row can
 * format it through a restart without a special case of its own. */
const EMPTY_STAT: GeneStat = {mean: 0, sigma: 0};

function stat(values: readonly number[]): GeneStat {
  if (values.length === 0) {
    return EMPTY_STAT;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {mean, sigma: Math.sqrt(variance)};
}

/**
 * Mean ± σ for all four genes and the derived body radius, folded here in
 * the App layer rather than behind a reader of the world's — the same call
 * ADR-0015 made for `α` smoothing: a statistic kept in the world would be
 * state crossing tick boundaries with no reader inside a tick, so it would
 * only enter `hashState` for the sake of a HUD row, and a second path to
 * numbers `OrganismView` already carries is a second thing to keep in
 * agreement.
 */
export function foldGeneStatistics(
  population: readonly OrganismView[],
): PopulationGeneStatistics {
  return {
    bodyRadius: stat(population.map((organism) => organism.bodyRadius)),
    cytoplasmThickness: stat(
      population.map((organism) => organism.cytoplasmThickness),
    ),
    mitosisEnergyThreshold: stat(
      population.map((organism) => organism.mitosisEnergyThreshold),
    ),
    childAllocationRatio: stat(
      population.map((organism) => organism.childAllocationRatio),
    ),
    lineageHue: stat(population.map((organism) => organism.lineageHue)),
  };
}

/** What the HUD shows for one roster type: structural genes cannot be
 * averaged by name, so the population is summarised by who carries the type
 * and how many each carrier has. */
export interface CarrierStat {
  /** The fraction of the population carrying at least one organelle of the
   * type. */
  readonly fraction: number;
  /** The mean count among carriers only; 0 when there are none. */
  readonly meanCountPerCarrier: number;
}

export type CarrierStatistics = Partial<Record<OrganelleType, CarrierStat>>;

/**
 * Carrier fraction and mean count per carrier, per roster type, folded in
 * the App layer from the organism view like the gene means above. An empty
 * population and a population with no carriers read zero, not `NaN`.
 */
export function foldCarrierStatistics(
  population: readonly OrganismView[],
  roster: readonly OrganelleType[],
): CarrierStatistics {
  const statistics: CarrierStatistics = {};
  for (const type of roster) {
    let carriers = 0;
    let organelles = 0;
    for (const organism of population) {
      const carried: readonly string[] = organism.organelles.map(
        (organelle) => organelle.type,
      );
      const count = carried.filter(
        (carriedType) => carriedType === type,
      ).length;
      if (count > 0) {
        carriers += 1;
        organelles += count;
      }
    }
    statistics[type] = {
      fraction: population.length === 0 ? 0 : carriers / population.length,
      meanCountPerCarrier: carriers === 0 ? 0 : organelles / carriers,
    };
  }
  return statistics;
}
