import {createWorld, getPopulation} from "../../src/world";
import {runTicks} from "../../scripts/calibration/worlds";
const births: number[][] = [];
(globalThis as {__births?: number[][]}).__births = births;
let w = createWorld(Number(process.env.EXP_SEEDS ?? 7));
let seen = 0;
for (let t = 2000; t <= Number(process.env.EXP_TICKS ?? 14000); t += 2000) {
  w = runTicks(w, 2000);
  const slice = births.slice(seen);
  seen = births.length;
  if (!slice.length) {
    console.log(t, "no births");
    continue;
  }
  const shrunk = slice.filter(([p, c]) => c < p).length,
    grew = slice.filter(([p, c]) => c > p).length;
  const logRatio =
    slice.reduce((a, [p, c]) => a + Math.log(c / p), 0) / slice.length;
  console.log(
    `ticks ${t - 2000}-${t}: births ${slice.length}, child smaller ${((100 * shrunk) / slice.length).toFixed(0)}%, larger ${((100 * grew) / slice.length).toFixed(0)}%, same ${((100 * (slice.length - shrunk - grew)) / slice.length).toFixed(0)}%, mean child/parent r ${Math.exp(logRatio).toFixed(3)}, pop ${getPopulation(w).length}`,
  );
}
