import {
  BRIGHT_BAND_DEPTH,
  createWorld,
  getBrightAlpha,
  getMeasuredAlpha,
  getPopulation,
  isBright,
} from "../../src/world";
import {
  heading,
  meanAndSigma,
  meanSigma,
  note,
  num,
  percent,
  row,
  table,
} from "./report";
import {SETTLE_TICKS, WINDOW_TICKS, seeds} from "./settings";
import {runTicks, runTicksWatching} from "./worlds";

/**
 * `α`, over the bright band and over the whole population (ADR-0015,
 * ADR-0023).
 *
 * Measured in a **fixed population** — mortality and fertility both off —
 * and in no other world. That is ADR-0015's whole anti-circularity
 * argument: `α` is what `c₀` is solved against, `c₀` decides where
 * `bodyRadius` converges, and a measurement taken in a world that can
 * select would carry the fitness it is meant to predict. Generation 0 is
 * the one the app places, so the number is about the world the run is
 * about.
 */

interface AlphaRun {
  readonly whole: number;
  readonly bright: number;
  /** Ticks each reading had anybody admissible in its set at all. Both
   * readings report 0 for a tick with nobody in them, and averaging those
   * zeros in would report a `c₀` for an ecology that was empty rather than
   * poor — so both skip them, by the same rule. Skipping them for the band
   * alone would have made the gap between the two means partly an artefact
   * of how each was averaged, which is exactly what `meanMeasuredAlpha`'s
   * comment promises it is not. */
  readonly wholeTicks: number;
  readonly brightTicks: number;
  /** The share of organism-ticks spent inside the band. The context the
   * two means need: a bright `α` measured over two organisms out of forty
   * is a real number about a small corner of the aquarium. */
  readonly occupancy: number;
}

function measureAlpha(seed: number): AlphaRun {
  const settled = runTicks(
    createWorld(seed, {mortality: "off", fertility: "off"}),
    SETTLE_TICKS,
  );

  let wholeSum = 0;
  let wholeTicks = 0;
  let brightSum = 0;
  let brightTicks = 0;
  let insideBand = 0;
  let organismTicks = 0;

  runTicksWatching(settled, WINDOW_TICKS, (world) => {
    const whole = getMeasuredAlpha(world);
    if (whole > 0) {
      wholeSum += whole;
      wholeTicks++;
    }
    const bright = getBrightAlpha(world);
    if (bright > 0) {
      brightSum += bright;
      brightTicks++;
    }
    for (const organism of getPopulation(world)) {
      organismTicks++;
      if (isBright(organism.y)) {
        insideBand++;
      }
    }
  });

  return {
    whole: wholeTicks > 0 ? wholeSum / wholeTicks : 0,
    bright: brightTicks > 0 ? brightSum / brightTicks : 0,
    wholeTicks,
    brightTicks,
    occupancy: organismTicks > 0 ? insideBand / organismTicks : 0,
  };
}

export interface AlphaReport {
  /** The bright-band mean across seeds — the one `EXISTENCE_COST` is
   * solved against in #35, and the one `r_opt` is predicted from. The
   * whole-population mean is printed and not returned: nothing downstream
   * is allowed to solve anything against it (ADR-0023). */
  readonly bright: number;
}

export function reportAlpha(): AlphaReport {
  const runs = seeds().map((seed) => ({seed, run: measureAlpha(seed)}));

  heading(
    "α — potential respiration rate per unit radius, in a fixed population",
  );
  note(
    `  Mortality off, fertility off (ADR-0015's instrument). Generation 0 as the app`,
  );
  note(
    `  places it, settled for ${String(SETTLE_TICKS)} ticks, then time-averaged over ${String(WINDOW_TICKS)}.`,
  );
  note(
    `  The bright band is y ≤ ${num(BRIGHT_BAND_DEPTH)} baseline radii, fixed before calibration.`,
  );
  note(
    `  Both means skip the ticks their own set had nobody earning in, so the only thing`,
  );
  note(`  that differs between the two numbers is the set (ADR-0023).`);
  table(
    [
      "seed",
      "α bright",
      "α whole",
      "band occupancy",
      "ticks earning, band",
      "ticks earning, all",
    ],
    runs.map(({seed, run}) => [
      String(seed),
      num(run.bright),
      num(run.whole),
      percent(run.occupancy),
      percent(run.brightTicks / WINDOW_TICKS),
      percent(run.wholeTicks / WINDOW_TICKS),
    ]),
  );

  const bright = runs.map(({run}) => run.bright);
  const whole = runs.map(({run}) => run.whole);
  row("α bright, across seeds", meanSigma(bright));
  row("α whole, across seeds", meanSigma(whole));

  return {bright: meanAndSigma(bright).mean};
}
