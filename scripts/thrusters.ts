import {heading, note, rendered} from "./calibration/report";
import {
  measureDown,
  measureOrbit,
  measureUp,
  reportDepth,
  reportOrbit,
} from "./calibration/thrusters";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run thrusters`: M10's thruster readings, an entry point beside
 * `buoyancy` and `chloroplast`. It asserts nothing (ADR-0024).
 */
function main(): void {
  heading("AcquarioTS thruster runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  reportDepth(measureUp());
  reportDepth(measureDown());
  reportOrbit(measureOrbit());

  console.log(rendered().trimEnd());
}

main();
