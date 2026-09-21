import {beforeAll, describe, expect, it} from "vitest";

import {totalCarbon, totalOxygen, type Pools} from "./ledger";
import {
  STARTING_POPULATION,
  capFor,
  type Organism,
  type OrganismView,
} from "./organism";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCumulativeDeaths,
  getPoolLevels,
  getPopulation,
  hashState,
  type World,
} from "./world";

/**
 * Ticket #29, M4's acceptance gate — the reproduction counterpart of
 * `conservation.long.test.ts`'s #20: the full tick pipeline, mitosis
 * included, run for the length `docs/vision.md`'s M2 gate already
 * established as the milestone's own long-run measure.
 *
 * **Primed, not placed.** Every founder starts at its own energy and food
 * cap rather than at `createWorld`'s usual diffusive equilibrium. This is
 * a deliberate device, the same shape `death.test.ts`'s "extinction
 * acceptance run" already uses (placing a population deep and dark rather
 * than trusting default placement to starve it inside a test's patience) —
 * except here the finding that forces it is a milestone-level one, worth
 * recording plainly rather than only in a code comment nobody reads twice:
 *
 * `mitosisMassCost = ρ × childArea` is forced (ADR-0019), and with `ρ = 1`
 * and `K_CAP = 1` it is *exactly* a same-sized child's own food cap — a
 * parent has to hold close to its own entire food store just to afford
 * one birth. M2's respiration is deliberately supply-limited (ADR-0015),
 * so food is consumed at roughly the rate it arrives rather than piling
 * up: measured directly against this world's own constants, the richest
 * organism in a 100k-tick immortal, infertile run never holds more than
 * about 6% of its food cap. Natural reproduction is therefore outside this
 * milestone's reach under M2's current, pre-calibration constants — not a
 * defect in this ticket's own code, since `mitosisEnergyCost` and
 * `mitosisEnergyThreshold` are the only levers M4 owns (see the ticket's
 * own risk note), and neither one touches the food side of the ledger.
 * Recalibrating `K_CAP`, `RHO` or the reaction-rate constants to change
 * that is explicitly M5's job, not this one's.
 *
 * What priming buys, honestly: a run that actually exercises mitosis,
 * `appendBirths`, and the conservation and determinism invariants across a
 * population that grows before it shrinks — instead of a 100k-tick run
 * that would otherwise assert nothing about reproduction at all.
 *
 * **What this gate does not claim.** A mortal population primed this way
 * still runs down toward extinction well before tick 100k, precisely
 * because natural reproduction essentially never re-fires once the
 * initial, artificial food surplus is spent — a pre-existing M3
 * characteristic (`docs/vision.md`'s "total extinction is a genuinely
 * possible outcome") that M4 inherits rather than introduces. So this
 * gate does **not** assert the population is non-zero at tick 100k, nor
 * that it avoids collapsing to a handful — both would be false today, for
 * reasons that predate this ticket and belong to M5's calibration pass.
 * What it does assert — conservation, determinism, and that reproduction
 * and death both genuinely happened — is exactly what M4's own code is
 * responsible for.
 *
 * **Ticket #31 asked for more, and hit the same wall harder.** #31 wants
 * this run *unprimed* — a plain `createWorld` start — plus population
 * non-zero at tick 100k and neither collapsed nor pegged at the ceiling.
 * Run unprimed at `{mortality: "on", fertility: "on"}`, 40 founders lose
 * 39 to starvation by tick 11k, one survivor rides out to 20k, and not one
 * birth ever fires — the founders' food never climbs past roughly 12% of
 * cap, confirming the ratio measured above from the other side. That is
 * not a tuning miss `MITOSIS_ENERGY_COST` or `mitosisEnergyThreshold` can
 * close: both gate the *energy* check in `evaluateMitosis`, and the wall
 * here is the *food* check — `mitosisMassCost = ρ × childArea`, forced by
 * ADR-0019 to equal a same-sized child's entire food cap, against a food
 * store that structurally never gets past roughly a tenth of its own cap
 * while respiration stays supply-limited (ADR-0015). Neither of M4's own
 * levers touches that side of the ledger. Per #31's own instruction — "if
 * the gate cannot be made to pass without changing a law rather than a
 * constant, that is a finding about the model" — this is recorded as a
 * comment on #31 rather than forced into a passing assertion here.
 * Closing that gap for real is a pre-calibration question for M5 (moving
 * `RHO`, `K_CAP` or the reaction-rate constants), not something this
 * ticket's scope owns, so #31 stays open against this finding instead of
 * being closed on a weakened test.
 */
// Roughly 3.9s for this file's whole suite — two full 100k-tick runs, the
// primed run above plus the determinism repeat below — measured on this
// ticket's own machine, the one place that number is written down (as #20
// records its own run cost in `conservation.long.test.ts`).
const TICKS = 100_000;
const SEED = 7;

function primePopulation(world: World): void {
  for (const organism of getPopulation(world) as unknown as Organism[]) {
    organism.energy = capFor(organism, "energy");
    organism.food = capFor(organism, "food");
  }
}

/** `getPopulation` hands out `OrganismView[]`; `totalCarbon`/`totalOxygen`
 * read real `Organism[]`. The same cast `primePopulation` uses above, for
 * the same reason: this gate's business is with the mutable population a
 * `World` actually holds, not with the read-only face the App layer sees. */
function asOrganisms(population: readonly OrganismView[]): Organism[] {
  return population as unknown as Organism[];
}

interface LongRun {
  readonly hash: string;
  readonly carbonDrift: number;
  readonly oxygenDrift: number;
  readonly pools: Pools;
  readonly peakPopulation: number;
  readonly cumulativeDeaths: number;
}

function runLong(seed: number): LongRun {
  let world: World = createWorld(seed);
  primePopulation(world);
  // Struck *after* priming, not at `createWorld`'s own tick 0: priming
  // pours carbon into every organism's stores by hand, outside the tick
  // pipeline and without touching a pool, so it is this run's own starting
  // point that conservation has to hold against — not the diffusive
  // equilibrium `createWorld` would otherwise have struck.
  const referenceCarbon = totalCarbon(
    asOrganisms(getPopulation(world)),
    getPoolLevels(world),
  );
  const referenceOxygen = totalOxygen(
    asOrganisms(getPopulation(world)),
    getPoolLevels(world),
  );
  let peakPopulation = getPopulation(world).length;

  for (let tick = 1; tick <= TICKS; tick++) {
    ({world} = advance(world, FIXED_DT_MS));
    peakPopulation = Math.max(peakPopulation, getPopulation(world).length);
  }

  const carbon = totalCarbon(
    asOrganisms(getPopulation(world)),
    getPoolLevels(world),
  );
  const oxygen = totalOxygen(
    asOrganisms(getPopulation(world)),
    getPoolLevels(world),
  );

  return {
    hash: hashState(world),
    carbonDrift: (carbon - referenceCarbon) / referenceCarbon,
    oxygenDrift: (oxygen - referenceOxygen) / referenceOxygen,
    pools: getPoolLevels(world),
    peakPopulation,
    cumulativeDeaths: getCumulativeDeaths(world),
  };
}

describe("conservation survives birth: the 100k gate (#29)", () => {
  let run: LongRun;

  beforeAll(() => {
    run = runLong(SEED);
  });

  it("conserves total carbon within 1e-9 relative drift", () => {
    expect(Math.abs(run.carbonDrift)).toBeLessThan(1e-9);
  });

  it("conserves total oxygen within 1e-9 relative drift", () => {
    expect(Math.abs(run.oxygenDrift)).toBeLessThan(1e-9);
  });

  it("drains no pool to zero", () => {
    expect(run.pools.food).toBeGreaterThan(0);
    expect(run.pools.carbonDioxide).toBeGreaterThan(0);
    expect(run.pools.oxygen).toBeGreaterThan(0);
  });

  // Non-vacuity, the milestone's own instruction: a run that never
  // reproduced would conserve carbon perfectly too, and say nothing about
  // whether M4's own code works.
  it("actually grew the population above its starting count at some point — a birth genuinely happened", () => {
    expect(run.peakPopulation).toBeGreaterThan(STARTING_POPULATION);
  });

  it("actually lost organisms along the way — a death genuinely happened", () => {
    expect(run.cumulativeDeaths).toBeGreaterThan(0);
  });

  it("reaches the same hash at tick 100k for the same seed", () => {
    const repeat = runLong(SEED);
    expect(repeat.hash).toBe(run.hash);
  }, 30_000);
});
