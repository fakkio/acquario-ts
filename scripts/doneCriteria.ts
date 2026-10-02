import {reportDoneCriteria} from "./calibration/doneCriteria";
import {heading, note, rendered} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run done-criteria` — the done-criteria runs, as a harness entry
 * point of their own beside `npm run calibrate`.
 *
 * A sibling rather than a section of `calibrate`, because the two are rerun
 * for different reasons and at very different costs. `calibrate` is the
 * instrument rerun whenever a constant is questioned, and a person waits at
 * the terminal for it; fifteen 100k-tick worlds would turn every such rerun
 * into a long one. This one is a verdict, run once per world worth judging.
 *
 * It is the harness's, not the long suite's, and for the harness's reasons
 * (ADR-0024): it asserts nothing, and exits successfully whatever the
 * numbers say. Since ADR-0027 its verdict is a measurement that is
 * reported, not a gate. It can still crash on a bad `ACQUARIO_` override,
 * which is the instrument being broken, and should be loud.
 *
 * M13's knockout seed pairs are the next done-criteria runs (ADR-0033), and
 * this is where they land.
 */
function main(): void {
  heading("AcquarioTS done-criteria runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024, ADR-0027).",
  );

  reportTheWorldMeasured();
  reportDoneCriteria();

  console.log(rendered().trimEnd());
}

main();
