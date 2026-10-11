import {
  measureBuoyancy,
  measureReferenceWorld,
  reportBuoyancy,
  reportReferenceWorld,
} from "./calibration/buoyancy";
import {heading, note, rendered} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run buoyancy`: M8's gravity readings (#77 on), an entry point beside
 * `neuron` and `caps`. It asserts nothing (ADR-0024).
 */
function main(): void {
  heading("AcquarioTS buoyancy runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  reportBuoyancy(measureBuoyancy());
  reportReferenceWorld(measureReferenceWorld());

  console.log(rendered().trimEnd());
}

main();
