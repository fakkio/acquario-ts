import {
  bodyAreaOfRadius,
  capForRadius,
  createWorld,
  getPoolLevels,
  getPopulation,
  isPhotic,
  type OrganismView,
} from "../../src/world";
import {
  BODY_COST_COEFFICIENT,
  EXISTENCE_COST,
  RHO,
} from "../../src/world/constants";
import {
  heading,
  integer,
  meanAndSigma,
  meanSigma,
  note,
  num,
  percent,
  row,
  table,
} from "./report";
import {
  LADDER_DEPTH,
  LADDER_MAX_RADIUS,
  LADDER_MIN_RADIUS,
  LADDER_MIN_SPAN_TICKS,
  LADDER_RUNGS,
  SETTLE_TICKS,
  WINDOW_TICKS,
  seeds,
} from "./settings";
import {
  ambientCarbon,
  ladderFounders,
  radiusLadder,
  runTicksWatching,
} from "./worlds";

/**
 * Two of ADR-0025's three gates, measured off one run: the income exponent
 * `n` in `income ∝ r^n`, and `r_max`, the largest radius that can still
 * reach mitosis's mass gate. Plus the peak internal food concentration as a
 * fraction of the ambient, which is how close the world sits to ADR-0022's
 * threshold.
 *
 * All three come off the same ladder world because they are three readings
 * of one thing: how the supply-limited regime shares a body's `1/r` between
 * income and internal concentration. Measuring them in separate worlds
 * would let them disagree about a world neither of them was describing.
 *
 * **Income is reconstructed, not read.** In a fixed population nothing is
 * born, nothing dies, and nobody pays a mitosis cost, so an organism's
 * energy changes by exactly two terms: what respiration produced and what
 * maintenance charged. Maintenance is `c₀ + β·area`, known exactly from the
 * radius, so
 *
 *     income = Δenergy / ticks + c₀ + β · area
 *
 * is respiration's energy output per tick and not an estimate of it. That
 * this only works in a fixed population is convenient rather than awkward:
 * it is the very world ADR-0015 requires `α` to be measured in.
 */

/** An organism resting on the immortal floor is not earning what its radius
 * would earn; it is being held up by `mortality: "off"`. One of the two
 * exclusions ADR-0024 leaves to the instrument — predicates for an
 * instrument belong to the instrument, not to the world. */
const FLOOR_ENERGY = 0;

/** The other exclusion: an organism whose energy store is full measures the
 * size of its own tank rather than its income, exactly as `meanMeasuredAlpha`
 * already excludes a respiration throttled that way. A hair below the cap
 * rather than at it, because the throttle binds before the store is exactly
 * full.
 *
 * Widened from `1e-6` at #36: this ladder reads `organism.energy` after the
 * tick, not the `throttledByFullEnergyStore` flag `applyRespiration` itself
 * computed, so it is reconstructing the same fact from a coarser signal.
 * `1e-6` caught only a store sitting essentially exactly at its ceiling; a
 * store cycling at 99.9% of it — filling most of the way back to the cap
 * every tick, immediately after maintenance opens a sliver of headroom — is
 * genuinely throttled by the same rule (`throttledByFullEnergyStore` fires
 * for it), and this margin let it through uncaught, reporting `income =
 * maintenance` as if it were real respiration — the finding recorded at
 * length in `constants.ts`'s own `K_CAP_ENERGY` comment. `1e-2` is still a
 * hair below the cap in the sense the comment above means, just a wider
 * hair, chosen against the cycling range a settled rung was observed to
 * sit in. */
const FULL_ENERGY_MARGIN = 1e-2;

interface Rung {
  readonly radius: number;
  /** `Δenergy/tick + maintenance`, or null when no long enough window of
   * this rung's life was measurable. */
  readonly income: number | null;
  /** The stretch the income above was reconstructed over, null when none
   * was long enough. */
  readonly stretch: Stretch | null;
  /**
   * Whether that stretch reaches past `SETTLE_TICKS`.
   *
   * A rung whose stretch ends before it was measured in the world's opening
   * transient rather than in the supply-limited steady state ADR-0025
   * defines `n` over. Not by choice: a body whose maintenance outruns its
   * income has no steady state other than the floor, and the floor is where
   * the reconstruction stops working. So it is reported rather than
   * silently fitted, and `n` is fitted a second time without such rungs, so
   * the two numbers can be read against each other.
   */
  readonly settled: boolean;
  /** Why the rung yielded no usable window, or null when it did. */
  readonly excluded: Exclusion | null;
  /**
   * The highest `(food + min(CO₂, O₂ headroom)) / ρ` this body reached
   * during the window — the mass a same-sized child actually costs, read
   * against everything ADR-0025's fallback can draw it from (`mitosis.ts`),
   * not against food alone. At 1 it can afford a same-sized child; below
   * it, never (ADR-0022).
   */
  readonly peakFoodOverRho: number;
  /** The highest `(food + min(CO₂, O₂ headroom)) / s` it reached — the same
   * peak, read against what the world had dissolved rather than against
   * body density. */
  readonly peakFoodOverAmbient: number;
  readonly meanDepth: number;
  readonly leftTheBand: boolean;
}

/**
 * Why a rung yielded no measurable window. Named rather than boolean,
 * because "three rungs of ten" is a different finding depending on which
 * end of the ladder went and why: a floored body says maintenance beat its
 * income at that radius, a saturated one says its income beat its own tank.
 */
type Exclusion =
  | "never off the immortal floor"
  | "energy store always full"
  | "no window long enough";

function exclusionFor(organism: OrganismView): Exclusion | null {
  const cap = capForRadius(organism.bodyRadius, "energy");
  if (organism.energy <= FLOOR_ENERGY) {
    return "never off the immortal floor";
  }
  if (organism.energy >= cap * (1 - FULL_ENERGY_MARGIN)) {
    return "energy store always full";
  }

  return null;
}

/**
 * The longest stretch of one rung's life over which its energy was neither
 * on the floor nor against the cap, tracked as the run goes.
 *
 * A single window shared by the whole ladder does not work, and finding
 * that out is itself a measurement. Maintenance is `c₀ + β·r²` while income
 * is roughly linear, so at today's constants every body above about `r = 1.4`
 * spends its whole steady state pinned to the immortal floor, where
 * `Δenergy` is 0 by the floor's doing and the reconstruction reads
 * maintenance instead of income. Its income is perfectly real over the few
 * hundred ticks it takes to get there, and that is the stretch this finds.
 *
 * The span length is reported per rung, so a fit resting on three hundred
 * ticks at one end and ten thousand at the other is visible as that rather
 * than as a clean line.
 */
/** One measurable run of a rung's life: when it started, when it ended,
 * and what its energy did in between. */
interface Stretch {
  readonly fromTick: number;
  readonly toTick: number;
  readonly delta: number;
}

interface Span {
  /** Where the stretch currently being measured began, or null while the
   * organism is clamped and no stretch is open. */
  openedAt: {readonly tick: number; readonly energy: number} | null;
  /** The longest stretch seen so far, null until one exists. */
  best: Stretch | null;
}

function stretchTicks(stretch: Stretch): number {
  return stretch.toTick - stretch.fromTick;
}

function openSpan(): Span {
  return {openedAt: null, best: null};
}

/** One tick's worth of bookkeeping on a rung's longest measurable stretch.
 * Told whether the organism is clamped rather than deciding it, so the
 * reason a rung was excluded is recorded by the caller that already has it
 * and this stays about spans alone. */
function extendSpan(
  span: Span,
  organism: OrganismView,
  tick: number,
  isClamped: boolean,
): void {
  if (isClamped) {
    span.openedAt = null;
    return;
  }
  if (span.openedAt === null) {
    span.openedAt = {tick, energy: organism.energy};
    return;
  }
  const ticks = tick - span.openedAt.tick;
  if (span.best === null || ticks > stretchTicks(span.best)) {
    span.best = {
      fromTick: span.openedAt.tick,
      toTick: tick,
      delta: organism.energy - span.openedAt.energy,
    };
  }
}

function measureLadder(
  seed: number,
  radii: readonly number[],
): readonly Rung[] {
  const world = createWorld(seed, {
    mortality: "off",
    fertility: "off",
    generation0: {founders: ladderFounders(radii, LADDER_DEPTH)},
  });

  const spans = radii.map(() => openSpan());
  const lastExclusion: (Exclusion | null)[] = radii.map(() => null);
  const peakFood = radii.map(() => 0);
  const peakFoodOverAmbient = radii.map(() => 0);
  const depthSum = radii.map(() => 0);
  const leftTheBand = radii.map(() => false);
  const totalTicks = SETTLE_TICKS + WINDOW_TICKS;

  const finished = runTicksWatching(world, totalTicks, (current, tick) => {
    const ambient = ambientCarbon(getPoolLevels(current));
    getPopulation(current).forEach((organism, rung) => {
      // ADR-0025's fallback (`mitosis.ts`) draws a child's mass from food
      // first and then CO₂, up to whatever O₂ headroom lets it convert — so
      // the mass a rung can actually afford is this sum, not food alone.
      const oxygenHeadroom = Math.max(
        0,
        capForRadius(organism.bodyRadius, "oxygen") - organism.oxygen,
      );
      const affordableMass =
        organism.food + Math.min(organism.carbonDioxide, oxygenHeadroom);
      const concentration =
        affordableMass / bodyAreaOfRadius(organism.bodyRadius);
      peakFood[rung] = Math.max(peakFood[rung], concentration);
      peakFoodOverAmbient[rung] = Math.max(
        peakFoodOverAmbient[rung],
        concentration / ambient,
      );
      depthSum[rung] += organism.y;
      if (!isPhotic(organism.y)) {
        leftTheBand[rung] = true;
      }
      const exclusion = exclusionFor(organism);
      lastExclusion[rung] = exclusion;
      extendSpan(spans[rung], organism, tick, exclusion !== null);
    });
  });

  return getPopulation(finished).map((organism, rung) => {
    const area = bodyAreaOfRadius(organism.bodyRadius);
    const maintenance = EXISTENCE_COST + BODY_COST_COEFFICIENT * area;
    const best = spans[rung].best;
    const usable = best !== null && stretchTicks(best) >= LADDER_MIN_SPAN_TICKS;

    return {
      radius: organism.bodyRadius,
      stretch: usable ? best : null,
      settled: usable && best.toTick >= SETTLE_TICKS,
      excluded: usable
        ? null
        : (lastExclusion[rung] ?? "no window long enough"),
      income: usable ? best.delta / stretchTicks(best) + maintenance : null,
      peakFoodOverRho: peakFood[rung] / RHO,
      peakFoodOverAmbient: peakFoodOverAmbient[rung],
      meanDepth: depthSum[rung] / totalTicks,
      leftTheBand: leftTheBand[rung],
    };
  });
}

/**
 * Ordinary least squares of `ln income` on `ln radius`. The slope *is* `n`:
 * `income = k·r^n` becomes `ln income = ln k + n·ln r`, so the exponent is
 * read as a slope rather than solved for. `r²` rides along because a slope
 * fitted through a curve is still a slope, and the gate is meaningless if
 * the points were never on a line.
 */
function fitExponent(
  rungs: readonly Rung[],
  settledOnly = false,
): {
  readonly n: number;
  readonly rSquared: number;
  readonly points: number;
} {
  const points = rungs
    .filter((rung): rung is Rung & {income: number} => rung.income !== null)
    .filter((rung) => rung.income > 0)
    .filter((rung) => !settledOnly || rung.settled)
    .map((rung) => ({x: Math.log(rung.radius), y: Math.log(rung.income)}));

  if (points.length < 3) {
    return {n: Number.NaN, rSquared: Number.NaN, points: points.length};
  }

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const covariance = points.reduce(
    (sum, p) => sum + (p.x - meanX) * (p.y - meanY),
    0,
  );
  const varianceX = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const n = covariance / varianceX;
  const residual = points.reduce(
    (sum, p) => sum + (p.y - (meanY + n * (p.x - meanX))) ** 2,
    0,
  );
  const totalY = points.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0);

  return {n, rSquared: 1 - residual / totalY, points: points.length};
}

/**
 * The largest radius whose peak internal food still reaches body density.
 * Interpolated in `ln r` between the last rung that reached it and the first
 * that did not, because the ladder is a sample of a continuum and reporting
 * the rung itself would quantise `r_max` to whatever resolution the ladder
 * happened to have.
 *
 * Returns `null` at both ends of the ladder, and the caller says which: a
 * world where even the smallest body cannot afford a child is a different
 * finding from one where the largest still can.
 */
function interpolateMaxReproductiveRadius(rungs: readonly Rung[]): {
  readonly radius: number | null;
  readonly reason: string;
} {
  const reaching = rungs.filter((rung) => rung.peakFoodOverRho >= 1);
  if (reaching.length === 0) {
    return {
      radius: null,
      reason: `no rung reached affordable mass = ρ — nothing on this ladder can afford a child`,
    };
  }

  const lastIndex = rungs.lastIndexOf(reaching[reaching.length - 1]);
  if (lastIndex === rungs.length - 1) {
    return {
      radius: null,
      reason: `every rung reached affordable mass = ρ — r_max is above the ladder's top`,
    };
  }

  const below = rungs[lastIndex];
  const above = rungs[lastIndex + 1];
  const fraction =
    (below.peakFoodOverRho - 1) /
    (below.peakFoodOverRho - above.peakFoodOverRho);
  const logRadius =
    Math.log(below.radius) +
    fraction * (Math.log(above.radius) - Math.log(below.radius));

  return {radius: Math.exp(logRadius), reason: "interpolated between rungs"};
}

export interface IncomeReport {
  /**
   * `n` over the rungs that reached a settled regime, which is the one
   * ADR-0025 defines the gate against, and `n` over every rung the ladder
   * admitted.
   *
   * Both, and in this order, because they differ and the difference runs
   * one way: the transient rungs pull the slope *toward* the gate. A
   * summary carrying only `all` would be a report flattering itself by
   * layout, which is the one thing an instrument that asserts nothing has
   * left to get wrong.
   */
  readonly exponentSettled: number;
  readonly exponentAllRungs: number;
  readonly maxReproductiveRadius: number | null;
}

export function reportIncome(): IncomeReport {
  const radii = radiusLadder(
    LADDER_MIN_RADIUS,
    LADDER_MAX_RADIUS,
    LADDER_RUNGS,
  );
  const runs = seeds().map((seed) => ({
    seed,
    rungs: measureLadder(seed, radii),
  }));
  const first = runs[0];

  heading("Income exponent n, and the maximum reproductive radius");
  note(
    `  A ladder of ${String(LADDER_RUNGS)} radii from ${num(LADDER_MIN_RADIUS)} to ${num(LADDER_MAX_RADIUS)}, all at depth ${num(LADDER_DEPTH)}, in one`,
  );
  note(
    `  fixed population so every rung sees the same pools. Income is reconstructed as`,
  );
  note(`  Δenergy/tick + c₀ + β·area, exact in a world with no births.`);
  note(
    `  Each rung is measured over its own longest unclamped stretch. A rung marked`,
  );
  note(
    `  (transient) sank to the immortal floor before tick ${integer(SETTLE_TICKS)} and has no steady`,
  );
  note(`  state to measure — its income is real, its regime is not settled.`);
  note(
    `  "mass" below is food + CO₂ drawn up to O₂ headroom (ADR-0025's fallback,`,
  );
  note(`  fired in mitosis.ts), not food alone.`);
  note(`  Rungs below are seed ${String(first.seed)}.`);
  table(
    [
      "r",
      "income",
      "income/r",
      "measured over",
      "peak mass/ρ",
      "peak mass/s",
      "mean depth",
      "left band",
    ],
    first.rungs.map((rung) => [
      num(rung.radius, 3),
      rung.income === null ? (rung.excluded ?? "excluded") : num(rung.income),
      rung.income === null ? "—" : num(rung.income / rung.radius),
      rung.stretch === null
        ? "—"
        : `${integer(rung.stretch.fromTick)}–${integer(rung.stretch.toTick)}${rung.settled ? "" : " (transient)"}`,
      num(rung.peakFoodOverRho, 3),
      num(rung.peakFoodOverAmbient, 3),
      num(rung.meanDepth, 3),
      rung.leftTheBand ? "yes" : "no",
    ]),
  );

  const fits = runs.map(({rungs}) => fitExponent(rungs));
  const fitted = fits.filter((fit) => Number.isFinite(fit.n));
  const settledFits = runs
    .map(({rungs}) => fitExponent(rungs, true))
    .filter((fit) => Number.isFinite(fit.n));
  row(
    "n, settled rungs only",
    settledFits.length === 0
      ? "unfittable — fewer than 3 rungs reached a settled regime"
      : `${meanSigma(settledFits.map((fit) => fit.n))} over ${String(settledFits[0].points)} rungs`,
  );
  row(
    "n, every admitted rung",
    fitted.length === 0
      ? `unfittable — fewer than 3 rungs yielded a window in any seed`
      : `${meanSigma(fitted.map((fit) => fit.n))} over ${String(fitted.length)} of ${String(fits.length)} seeds`,
  );
  if (fitted.length > 0) {
    row("fit r², across seeds", meanSigma(fitted.map((fit) => fit.rSquared)));
  }
  row(
    "rungs admitted",
    `${String(fits[0].points)} of ${String(LADDER_RUNGS)} (seed ${String(first.seed)})`,
  );
  row("ADR-0025 gate", "n ∈ [0.9, 1.15]");

  const maxima = runs.map(({rungs}) => interpolateMaxReproductiveRadius(rungs));
  const found = maxima.filter(
    (maximum): maximum is {radius: number; reason: string} =>
      maximum.radius !== null,
  );
  const maxRadius =
    found.length === maxima.length
      ? meanAndSigma(found.map((maximum) => maximum.radius)).mean
      : null;
  if (maxRadius === null) {
    row("r_max", maxima[0].reason);
  } else {
    row(
      "r_max, across seeds",
      meanSigma(found.map((maximum) => maximum.radius)),
    );
  }
  row("ADR-0025 gate", "r_max ≥ 2 · r_opt");

  const peak = Math.max(
    ...runs.flatMap(({rungs}) => rungs.map((rung) => rung.peakFoodOverAmbient)),
  );
  row("peak mass / s, any rung", `${num(peak)}  (${percent(peak)} of ambient)`);
  row(
    "peak mass / ρ, any rung",
    num(
      Math.max(
        ...runs.flatMap(({rungs}) => rungs.map((rung) => rung.peakFoodOverRho)),
      ),
    ),
  );

  return {
    exponentSettled: meanAndSigma(settledFits.map((fit) => fit.n)).mean,
    exponentAllRungs: meanAndSigma(fitted.map((fit) => fit.n)).mean,
    maxReproductiveRadius: maxRadius,
  };
}
