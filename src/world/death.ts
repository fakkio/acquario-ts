import {sumAscending} from "./environment";
import type {Pools} from "./ledger";
import {bodyMass, type Organism} from "./organism";

/**
 * ADR-0017's remains (glossary: Remains): a frozen snapshot of what a dying
 * organism gives back to the world, taken at step 8 — before step 10's
 * collisions can move it — so a condemned organism deposits the position it
 * died at, not the one its neighbours pushed it to on its last tick. Exists
 * for part of one tick, consumed at step 11; never a corpse, which is
 * v0.2's persistent entity.
 */
export interface Remains {
  readonly x: number;
  readonly y: number;
  readonly food: number;
  readonly carbonDioxide: number;
  readonly oxygen: number;
  readonly bodyMass: number;
}

function freezeRemains(organism: Organism): Remains {
  return {
    x: organism.x,
    y: organism.y,
    food: organism.food,
    carbonDioxide: organism.carbonDioxide,
    oxygen: organism.oxygen,
    bodyMass: bodyMass(organism),
  };
}

export interface DeathEvaluation {
  readonly survivors: readonly Organism[];
  readonly remains: readonly Remains[];
}

/**
 * Resolve-phase step 8 (ADR-0006/ADR-0017): every organism whose energy has
 * run out — `energy <= 0` — is condemned, and both halves of the tick's
 * later work are produced together here: the survivors that step 11 keeps
 * and the remains it deposits. Splitting the population this way, rather
 * than re-evaluating the predicate at step 11, is deliberate — two
 * predicates that have to agree forever is one too many (ADR-0017).
 */
export function evaluateDeaths(
  population: readonly Organism[],
): DeathEvaluation {
  const survivors: Organism[] = [];
  const remains: Remains[] = [];

  for (const organism of population) {
    if (organism.energy <= 0) {
      remains.push(freezeRemains(organism));
    } else {
      survivors.push(organism);
    }
  }

  return {survivors, remains};
}

/**
 * Commit-phase step 11: the deposit, a pure `(pools, remains[]) => pools`
 * (ADR-0017), so it is testable against no world at all. Deliberately never
 * `Environment.exchange` — that is the diffusion path, partially fulfilled
 * and scaled by demand; a death deposit is always a credit, never scaled,
 * never failing. Body mass returns as food, exactly the amount paid for it
 * at birth (`docs/vision.md`).
 *
 * Each resource is summed in ascending order before it is added to the
 * pool, the same way `ExchangeSettlement.commit` sums grants — see
 * `sumAscending` — so reordering the population that died on the same tick
 * leaves the pools bit-identical.
 */
export function depositRemains(
  pools: Pools,
  remains: readonly Remains[],
): Pools {
  const food = remains.map((r) => r.food);
  const bodyMasses = remains.map((r) => r.bodyMass);
  const carbonDioxide = remains.map((r) => r.carbonDioxide);
  const oxygen = remains.map((r) => r.oxygen);

  return {
    food: pools.food + sumAscending(food) + sumAscending(bodyMasses),
    carbonDioxide: pools.carbonDioxide + sumAscending(carbonDioxide),
    oxygen: pools.oxygen + sumAscending(oxygen),
  };
}
