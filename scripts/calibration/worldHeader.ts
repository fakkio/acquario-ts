import {
  AQUARIUM_AREA,
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  BRIGHT_BAND_DEPTH,
  bodyArea,
  createWorld,
  getPoolLevels,
  getPopulation,
} from "../../src/world";
import * as constants from "../../src/world/constants";
import {heading, num, row, table} from "./report";
import {SEED, overrideNames} from "./settings";
import {ambientCarbon} from "./worlds";

/**
 * The world a report is about, stated at its top: which constants were
 * overridden, the aquarium, the baseline genome and every constant in
 * force. Shared by every entry point of the harness, because a number in
 * any of them means nothing without the world it was measured on, and two
 * copies of this header would come to describe that world differently.
 */

/** Everything in `constants.ts` that is a plain number, so the report can
 * state the world it measured without a hand-maintained list that drifts
 * from the module beside it. */
function scalarConstants(): readonly (readonly [string, number])[] {
  return Object.entries(constants)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort(([left], [right]) => left.localeCompare(right));
}

export function reportTheWorldMeasured(): void {
  heading("The world these numbers are about");
  const overrides = overrideNames();
  row(
    "constants overridden",
    overrides.length === 0
      ? "none — every value below is the committed one"
      : overrides.join(", "),
  );
  row(
    "aquarium",
    `${num(AQUARIUM_WIDTH)} × ${num(AQUARIUM_HEIGHT)} baseline radii`,
  );
  row("bright band", `y ≤ ${num(BRIGHT_BAND_DEPTH)}`);
  row(
    "baseline genome",
    `thickness=${num(BASELINE_GENOME.cytoplasmThickness)}, threshold=${num(BASELINE_GENOME.mitosisEnergyThreshold)}, allocation=${num(BASELINE_GENOME.childAllocationRatio)}`,
  );

  // Generation 0's own summed body area is what the ambient concentration
  // falls out of, so it is read off a real world rather than assumed at the
  // baseline: the founders are mutated, and their areas are not π each.
  const world = createWorld(SEED);
  const totalBodyArea = getPopulation(world).reduce(
    (sum, organism) => sum + bodyArea(organism),
    0,
  );
  const ambient = ambientCarbon(getPoolLevels(world));

  row("generation 0 body area A", num(totalBodyArea));
  row("ambient carbon s", num(ambient));
  row(
    "s / ρ",
    `${num(ambient / constants.RHO)}  (ADR-0022: a same-sized child needs ≥ 1)`,
  );
  // ADR-0022's closed-form ceiling, run forwards from the budget in force.
  // `K` here is `CARBON_BUDGET_BASELINE_ORGANISMS` itself, not `K·π`: the
  // `·π` in vision.md's `s = (K·π − A)/(A + aquariumArea)` is what turns the
  // "K baseline organisms" count into an amount of carbon, and it appears
  // nowhere in the N_max formula that inverts it.
  const rOptCeiling =
    constants.CARBON_BUDGET_BASELINE_ORGANISMS / (2 * 1.5 ** 2) -
    AQUARIUM_AREA / (2 * Math.PI * 1.5 ** 2);
  row(
    "N_max at r = 1.5",
    `${num(rOptCeiling)}  (ADR-0022: K/(2r²) − aquariumArea/(2π r²))`,
  );

  table(
    ["constant", "value"],
    scalarConstants().map(([name, value]) => [name, num(value, 6)]),
  );
  table(
    ["K_CAP", "value"],
    Object.entries(constants.K_CAP).map(([name, value]) => [
      name,
      num(value, 6),
    ]),
  );
}
