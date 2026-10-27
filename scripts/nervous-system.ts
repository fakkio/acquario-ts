import {heading, note, rendered} from "./calibration/report";
import {
  measureReflexProfile,
  reportReflexProfile,
} from "./calibration/nervousSystem";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run nervous-system`: M11's readings, an entry point beside
 * `thrusters`. It asserts nothing (ADR-0024).
 */
function main(): void {
  heading("AcquarioTS nervous-system runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  reportReflexProfile(measureReflexProfile());

  console.log(rendered().trimEnd());
}

main();
