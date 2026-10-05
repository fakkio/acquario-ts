import {
  measureNeuron,
  measureNeuronWithoutCost,
  nodeProcess,
  reportNeuron,
} from "./calibration/neuron";
import {heading, note, rendered} from "./calibration/report";
import {reportTheWorldMeasured} from "./calibration/worldHeader";

/**
 * `npm run neuron`: M7's neuron and ceiling readings (#66), an entry point
 * beside `calibrate` and `done-criteria`, for the latter's reason: it runs
 * ten 100k-tick worlds by default (five seeds, with and without the cost), which no rerun of `calibrate` should wait for. It
 * asserts nothing (ADR-0024).
 *
 * With `--json` it is the child the report spawns for the `c_neuron = 0`
 * baseline, and prints its raw readings instead of a report.
 */
async function main(): Promise<void> {
  if (nodeProcess().argv.includes("--json")) {
    console.log(JSON.stringify(measureNeuron()));

    return;
  }

  heading("AcquarioTS neuron and ceiling runs");
  note(
    "  An instrument, not a gate: no number it measures can make it fail (ADR-0024).",
  );

  reportTheWorldMeasured();
  const baseline = measureNeuronWithoutCost();
  const costed = measureNeuron();
  reportNeuron(costed, await baseline);

  console.log(rendered().trimEnd());
}

await main();
