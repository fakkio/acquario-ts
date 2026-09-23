import {
  AQUARIUM_AREA,
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  PHOTIC_BAND_DEPTH,
  bodyArea,
  createWorld,
  getPoolLevels,
  getPopulation,
} from "../src/world";
import {ambientCarbon} from "./calibration/worlds";
import * as constants from "../src/world/constants";
import {reportAlpha} from "./calibration/alpha";
import {reportDarkBand} from "./calibration/dark";
import {reportIncome} from "./calibration/income";
import {reportLiveWorld} from "./calibration/live";
import {heading, note, num, rendered, row, table} from "./calibration/report";
import {SEED, overrideNames} from "./calibration/settings";

/**
 * `npm run calibrate` — M5's instrument (ADR-0024).
 *
 * It constructs worlds, runs them, and prints the numbers M5's constants
 * have to be chosen against. Three things it deliberately is not:
 *
 * **It is not a gate.** It asserts nothing: no number it measures can make
 * it fail, however unwelcome that number is. A test that prints instead of
 * asserting is a test that can never fail, and a suite holding one has a
 * permanently green square in it. The gates are the reopened #31 and the
 * done-criteria runs, both in the long suite, both assertions.
 *
 * It can still crash — on an `ACQUARIO_` name that is not a constant, or a
 * ladder too wide for the aquarium. That is the instrument being broken
 * rather than a measurement coming back wrong, and it is meant to be loud.
 *
 * **It is not in CI.** It is expected to be rerun by hand whenever a
 * constant is questioned again, including long after M5.
 *
 * **It changed no constant on the way in.** That is the ordering ADR-0011
 * and ADR-0024 both turn on: an instrument built after the constants moved
 * would have been calibrated against the run that produced it.
 *
 * Run it with a candidate world by overriding constants in the environment
 * — they are read once, at module import:
 *
 *     ACQUARIO_K_PHOTO=0.2 ACQUARIO_K_CAP_FOOD=4 npm run calibrate
 *
 * and shorten or lengthen the looking with `CALIBRATE_*` (see
 * `calibration/settings.ts`). The sweep that loops those child processes is
 * #36's; what lands here is the door it drives.
 */

/** Everything in `constants.ts` that is a plain number, so the report can
 * state the world it measured without a hand-maintained list that drifts
 * from the module beside it. */
function scalarConstants(): readonly (readonly [string, number])[] {
  return Object.entries(constants)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort(([left], [right]) => left.localeCompare(right));
}

function reportTheWorldMeasured(): void {
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
  row("photic band", `y ≤ ${num(PHOTIC_BAND_DEPTH)}`);
  row(
    "baseline genome",
    `r=${num(BASELINE_GENOME.bodyRadius)}, threshold=${num(BASELINE_GENOME.mitosisEnergyThreshold)}, allocation=${num(BASELINE_GENOME.childAllocationRatio)}`,
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

function main(): void {
  heading("AcquarioTS calibration harness");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );
  note(
    "  Nothing in CI runs it. Rerun it by hand whenever a constant is questioned.",
  );

  reportTheWorldMeasured();
  const alpha = reportAlpha();
  const income = reportIncome();
  reportDarkBand();
  reportLiveWorld();

  // The one derived number the rest of the milestone hangs on, stated where
  // the measurements that produced it can be read beside it. `c₀` is solved
  // against the *photic* mean (ADR-0023), because selection acts through
  // reproduction and in v0.1 reproduction happens only in the light.
  heading("What #35 would read off this run");
  const targetROpt = 1.5;
  row("target r_opt (ADR-0025)", num(targetROpt));
  row(
    "c₀ = α_photic · r_opt / 2",
    `${num((alpha.photic * targetROpt) / 2)}  (committed EXISTENCE_COST: ${num(constants.EXISTENCE_COST)})`,
  );
  row(
    "r_opt = 2·c₀/α_photic, as committed",
    num((2 * constants.EXISTENCE_COST) / alpha.photic),
  );
  // The settled fit first, and named as the gate's own number: it is what
  // ADR-0025 defines `n` over, and it is the less comfortable of the two.
  row("n, settled regime (the gate's)", num(income.exponentSettled));
  row("n, every admitted rung", num(income.exponentAllRungs));
  row(
    "r_max, measured",
    income.maxReproductiveRadius === null
      ? "not on the ladder — see above"
      : num(income.maxReproductiveRadius),
  );
  note("");
  note(
    "  A gate reading here is a reading, not a verdict: the gates assert in the long",
  );
  note("  suite, and the verdict on v0.1 is #38's.");

  console.log(rendered().trimEnd());
}

main();
