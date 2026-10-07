import * as constants from "../src/world/constants";
import {reportAlpha} from "./calibration/alpha";
import {reportDarkBand} from "./calibration/dark";
import {reportIncome} from "./calibration/income";
import {reportLiveWorld} from "./calibration/live";
import {heading, note, num, rendered, row} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run calibrate` — M5's instrument (ADR-0024).
 *
 * It constructs worlds, runs them, and prints the numbers M5's constants
 * have to be chosen against. Three things it deliberately is not:
 *
 * **It is not a gate.** It asserts nothing: no number it measures can make
 * it fail, however unwelcome that number is. A test that prints instead of
 * asserting is a test that can never fail, and a suite holding one has a
 * permanently green square in it. The gate on what it measures is the
 * reopened #31, in the long suite, an assertion. The done-criteria runs
 * were the other gate until ADR-0027 made them a reported measurement: they
 * are an entry point of this harness now, `npm run done-criteria`, and
 * assert nothing either.
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
 *     ACQUARIO_K_PHOTO=0.2 ACQUARIO_K_CAP_ENERGY=800 npm run calibrate
 *
 * and shorten or lengthen the looking with `CALIBRATE_*` (see
 * `calibration/settings.ts`). The sweep that loops those child processes is
 * #36's; what lands here is the door it drives.
 */

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
  // against the *bright* mean (ADR-0023), because selection acts through
  // reproduction and in v0.1 reproduction happens only in the light.
  heading("What #35 would read off this run");
  const targetROpt = 1.5;
  row("target r_opt (ADR-0025)", num(targetROpt));
  row(
    "c₀ = α_bright · r_opt / 2",
    `${num((alpha.bright * targetROpt) / 2)}  (committed EXISTENCE_COST: ${num(constants.EXISTENCE_COST)})`,
  );
  row(
    "r_opt = 2·c₀/α_bright, as committed",
    num((2 * constants.EXISTENCE_COST) / alpha.bright),
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
    "  A gate reading here is a reading, not a verdict: the verdict on v0.1 is #38's,",
  );
  note("  and the done-criteria runs are `npm run done-criteria`'s.");

  console.log(rendered().trimEnd());
}

main();
