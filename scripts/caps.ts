import {reportAlpha} from "./calibration/alpha";
import {reportCaps} from "./calibration/caps";
import {reportDarkBand} from "./calibration/dark";
import {heading, note, rendered} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run caps`: ADR-0035's before/after table (#69, #71), an entry point
 * beside `calibrate` and `neuron`, for their reason: five 100k-tick worlds
 * is too long for every rerun of `calibrate`. It prints the Reference World
 * section (persistence, births, highest internal concentration), then `α_bright` and population `α` in a fixed population,
 * then the dark ladder. It asserts nothing (ADR-0024).
 */
function main(): void {
  heading("AcquarioTS soft-caps run");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  reportCaps();
  reportAlpha();
  reportDarkBand();

  console.log(rendered().trimEnd());
}

main();
