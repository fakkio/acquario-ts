import {AQUARIUM_AREA} from "./aquarium";
import {
  AMBIENT_CO2_SHARE,
  AMBIENT_OXYGEN_CONCENTRATION,
  CARBON_BUDGET_BASELINE_ORGANISMS,
} from "./constants";
import {foldString} from "./hash";
import {bodyArea, bodyMass, capFor, type Organism} from "./organism";

/**
 * The world's three global, well-mixed pools (ADR-0003). Held as an
 * immutable record inside the world's state, alongside the clock and the
 * global stream, so `advance` keeps returning a new record exactly as it
 * does today. Nothing in this slice mutates a pool in place: passive
 * exchange, and the delta buffer it settles through, arrive with the
 * `Environment` seam.
 */
export interface Pools {
  readonly food: number;
  readonly carbonDioxide: number;
  readonly oxygen: number;
}

/**
 * Generation 0's carbon ledger, set once at world creation and never again
 * in this slice — nothing here moves a unit of carbon, so there is no
 * tick-by-tick update to write.
 *
 * Requires tick 0 to sit at diffusive equilibrium: every organism's
 * diffusible stores start at exactly the ambient concentration the pools
 * hold. That requirement is what lets the ambient concentration fall out
 * of the carbon budget in closed form, with no iterative search —
 * `s = (K·π − A) / (A + aquariumArea)`, where `A` is the population's
 * summed body area. Internal stores and pool levels would otherwise each
 * depend on the other's answer.
 *
 * Mutates every organism's stores in place, per ADR-0013's mutable
 * organisms. This is generation 0's construction, called once from
 * `createWorld`, not a tick writing to a population mid-life, so it sits
 * outside the read/resolve/commit discipline `runTick` enforces.
 */
export function initializeMetabolism(population: readonly Organism[]): Pools {
  const totalBodyArea = population.reduce(
    (sum, organism) => sum + bodyArea(organism),
    0,
  );

  // "Enough carbon for K baseline organisms": a baseline body has area π
  // (bodyRadius = 1), so K of them are worth K·π of carbon in the
  // concentration unit K_CAP = 1 fixes.
  const carbonBudget = CARBON_BUDGET_BASELINE_ORGANISMS * Math.PI;
  const ambientConcentration =
    (carbonBudget - totalBodyArea) / (totalBodyArea + AQUARIUM_AREA);

  const co2Concentration = ambientConcentration * AMBIENT_CO2_SHARE;
  const foodConcentration = ambientConcentration * (1 - AMBIENT_CO2_SHARE);

  for (const organism of population) {
    const area = bodyArea(organism);
    organism.carbonDioxide = co2Concentration * area;
    organism.food = foodConcentration * area;
    organism.oxygen = AMBIENT_OXYGEN_CONCENTRATION * area;
    // Energy neither diffuses nor has an ambient value to match, so it is
    // the one store filled by fill ratio rather than by concentration.
    organism.energy = capFor(organism, "energy") / 2;
  }

  return {
    food: foodConcentration * AQUARIUM_AREA,
    carbonDioxide: co2Concentration * AQUARIUM_AREA,
    oxygen: AMBIENT_OXYGEN_CONCENTRATION * AQUARIUM_AREA,
  };
}

/**
 * ADR-0001's carbon total: the pools, every organism's internal food and
 * CO₂, and the mass every body itself is made of. A pure readout, never a
 * throwing assertion inside the tick — one function, two consumers, the
 * HUD and the tests — so an unattended 100k-tick run ends in a time series
 * rather than a stack trace the moment it drifts.
 */
export function totalCarbon(
  population: readonly Organism[],
  pools: Pools,
): number {
  let total = pools.food + pools.carbonDioxide;
  for (const organism of population) {
    total += bodyMass(organism) + organism.food + organism.carbonDioxide;
  }

  return total;
}

/**
 * ADR-0001's oxygen total. CO₂ carries oxygen of its own, so it counts on
 * both sides of both totals: this is what makes the two reactions
 * genuinely coupled rather than decorative.
 */
export function totalOxygen(
  population: readonly Organism[],
  pools: Pools,
): number {
  let total = pools.oxygen + pools.carbonDioxide;
  for (const organism of population) {
    total += organism.oxygen + organism.carbonDioxide;
  }

  return total;
}

/**
 * Folds the pool levels into the running world hash, alongside
 * `foldPopulation`'s organism stores — together, everything metabolism
 * reads.
 */
export function foldPools(hash: number, pools: Pools): number {
  return foldString(
    hash,
    `${String(pools.food)}|${String(pools.carbonDioxide)}|${String(pools.oxygen)}`,
  );
}
