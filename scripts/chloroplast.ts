import {
  reportEarnings,
  reportRestingDepthByComposition,
} from "./calibration/chloroplast";
import {heading, note, rendered} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run chloroplast`: M9's readings (#87 on), an entry point beside
 * `buoyancy` and `neuron`. It asserts nothing (ADR-0024).
 */
function main(): void {
  heading("AcquarioTS chloroplast runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  reportEarnings();
  reportRestingDepthByComposition();

  console.log(rendered().trimEnd());
}

main();
