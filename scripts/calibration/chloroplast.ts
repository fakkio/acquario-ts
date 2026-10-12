import {
  AQUARIUM_HEIGHT,
  BRIGHT_BAND_DEPTH,
  createWorld,
  getPopulation,
  lightAt,
} from "../../src/world";
import {
  C_ORGANELLE,
  DENSITY_SPAN,
  G,
  K_CHLORO,
  R_NEW,
  RESPIRATION_ENERGY_YIELD,
  WATER_DENSITY_AT_SURFACE,
} from "../../src/world/constants";
import {ORGANELLE_TYPES, type OrganelleType} from "../../src/world/organelles";
import {centreRange, randomFounders} from "./buoyancy";
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
  COMPOSITION_BODIES,
  COMPOSITION_SAMPLE_EVERY,
  COMPOSITION_TICKS,
  EARNINGS_BODIES,
  EARNINGS_SAMPLE_EVERY,
  SEED,
  SETTLE_TICKS,
  WINDOW_TICKS,
  seeds,
} from "./settings";
import {runTicks, runTicksWatching} from "./worlds";

/**
 * M9's first two harness sections (#87), both on Fixed Populations with
 * explicit founders: what a chloroplast earns by depth, and the Resting Depth
 * by composition. Mortality and fertility off, so nothing but motion, gravity
 * and the walls shape what is read. Every number is reported, never gated
 * (ADR-0024).
 */

/** The committed `X` that `c_organelle` was derived from (`constants.ts`). */
const COMMITTED_X = 260;

/** Band edges in baseline radii: the Bright Band in quarters, then thirds of
 * the dark below it. */
function bandEdges(): readonly number[] {
  const quarter = BRIGHT_BAND_DEPTH / 4;
  const edges = [0, quarter, 2 * quarter, 3 * quarter, BRIGHT_BAND_DEPTH];
  const rest = (AQUARIUM_HEIGHT - BRIGHT_BAND_DEPTH) / 3;
  for (let band = 1; band <= 3; band++) {
    edges.push(BRIGHT_BAND_DEPTH + band * rest);
  }

  return edges;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly readings: number;
  readonly meanDepth: number;
  readonly x: number;
}

interface EarningsRun {
  /** Per band, summed over the run: readings, depth, `X`. */
  readonly counts: readonly number[];
  readonly depthSums: readonly number[];
  readonly xSums: readonly number[];
}

/**
 * `X(y) = light × internal CO₂ concentration × yield`, per body per tick,
 * read after the tick: the CO₂ is the store the tick left, which respiration
 * has already refilled a little, so the reading runs a touch above what
 * photosynthesis itself saw. The way `α` is read, off the same bodies.
 */
function measureEarnings(seed: number, edges: readonly number[]): EarningsRun {
  const bands = edges.length - 1;
  const counts = new Array<number>(bands).fill(0);
  const depthSums = new Array<number>(bands).fill(0);
  const xSums = new Array<number>(bands).fill(0);

  const world = createWorld(seed, {
    mortality: "off",
    fertility: "off",
    generation0: {founders: randomFounders(EARNINGS_BODIES, seed, [])},
  });
  const settled = runTicks(world, SETTLE_TICKS);
  runTicksWatching(settled, WINDOW_TICKS, (current, tick) => {
    if (tick % EARNINGS_SAMPLE_EVERY !== 0) {
      return;
    }
    for (const organism of getPopulation(current)) {
      const band = edges.findIndex(
        (edge, index) =>
          index < bands && organism.y >= edge && organism.y < edges[index + 1],
      );
      if (band < 0) {
        continue;
      }
      counts[band]++;
      depthSums[band] += organism.y;
      xSums[band] +=
        lightAt(organism.y) *
        (organism.carbonDioxide / organism.cytoplasmArea) *
        RESPIRATION_ENERGY_YIELD;
    }
  });

  return {counts, depthSums, xSums};
}

/** The depth where `X` falls to `target`, interpolated between band means. */
function crossing(bands: readonly Band[], target: number): number | null {
  for (let i = 0; i + 1 < bands.length; i++) {
    const a = bands[i];
    const b = bands[i + 1];
    if (a.readings === 0 || b.readings === 0) {
      continue;
    }
    if (a.x >= target && b.x < target) {
      const t = (a.x - target) / (a.x - b.x);

      return a.meanDepth + t * (b.meanDepth - a.meanDepth);
    }
  }

  return null;
}

export function reportEarnings(): void {
  const edges = bandEdges();
  const runs = seeds().map((seed) => measureEarnings(seed, edges));

  const bands: Band[] = edges.slice(0, -1).map((from, band) => {
    const readings = runs.reduce((sum, run) => sum + run.counts[band], 0);
    const depth = runs.reduce((sum, run) => sum + run.depthSums[band], 0);
    const x = runs.reduce((sum, run) => sum + run.xSums[band], 0);

    return {
      from,
      to: edges[band + 1],
      readings,
      meanDepth: readings > 0 ? depth / readings : Number.NaN,
      x: readings > 0 ? x / readings : Number.NaN,
    };
  });

  heading("What a chloroplast earns by depth: X(y) in a Fixed Population");
  note(
    `  ${String(EARNINGS_BODIES)} baseline bodies with no organelles, random placement, mortality and fertility off, seeds ${seeds().join(", ")}.`,
  );
  note(
    `  Settled ${integer(SETTLE_TICKS)} ticks, then ${integer(WINDOW_TICKS)} read every ${integer(EARNINGS_SAMPLE_EVERY)}. X = light × internal CO₂ concentration × yield (${num(RESPIRATION_ENERGY_YIELD)}).`,
  );
  note(
    `  k(y) = kChloro·X(y), kChloro = ${num(K_CHLORO)}; r*(y) = c_organelle / k(y), c_organelle = ${num(C_ORGANELLE)}, r_new = ${num(R_NEW)}.`,
  );
  table(
    ["band", "readings", "mean depth", "X", "k(y)", "r*(y)", "r*/r_new"],
    bands.map((band) => {
      const k = K_CHLORO * band.x;

      return [
        `${num(band.from, 3)}–${num(band.to, 3)}`,
        integer(band.readings),
        num(band.meanDepth),
        num(band.x),
        num(k),
        num(C_ORGANELLE / k),
        num(C_ORGANELLE / k / R_NEW),
      ];
    }),
  );

  // The Bright Band's X: the readings pooled per seed, then across seeds.
  const bright = runs.map((run) => {
    let count = 0;
    let sum = 0;
    for (let band = 0; band < edges.length - 1; band++) {
      if (edges[band + 1] <= BRIGHT_BAND_DEPTH + 1e-9) {
        count += run.counts[band];
        sum += run.xSums[band];
      }
    }

    return count > 0 ? sum / count : Number.NaN;
  });
  row("X over the Bright Band, across seeds", meanSigma(bright));
  row("X committed (c_organelle's derivation)", num(COMMITTED_X));
  const breakEven = crossing(bands, C_ORGANELLE / (2 * R_NEW * K_CHLORO));
  row(
    "break-even depth, chloroplast at r_new",
    breakEven === null ? "not crossed by the bands" : num(breakEven),
  );
  note(
    "  Break-even: where a disc at r_new earns its overhead, 2·k(y)·r_new = c_organelle, i.e. r*(y) = 2·r_new",
  );
  note(
    "  (X = 260 by construction), interpolated between band means. Its tissue cost is not counted.",
  );
}

/** A composition's weighing totals in the water's units (`Δ = 1`): `M` the
 * summed `(c − ρ_w(0))·a` and `A` the summed `Δ·a`. */
function compositionTotals(types: readonly OrganelleType[]): {
  readonly m: number;
  readonly a: number;
} {
  const area = Math.PI * R_NEW * R_NEW;
  let m = 0;
  let a = 0;
  for (const type of types) {
    const density = ORGANELLE_TYPES[type].density;
    if (density === "weightless") {
      continue;
    }
    m += (density - WATER_DENSITY_AT_SURFACE) * area;
    a += DENSITY_SPAN * area;
  }

  return {m, a};
}

interface CompositionCheck {
  readonly label: string;
  readonly samples: number;
  readonly meanDepth: number;
  readonly sigma: number;
  readonly brightFraction: number;
  readonly restingDepth: number;
  readonly predictedMeanDepth: number;
  readonly predictedSigma: number;
  readonly predictedBrightFraction: number;
  /** `σ` of the profile with no walls, and the relaxation time. */
  readonly freeSigma: number;
  readonly relaxation: number;
}

/** The profile `p(y) ∝ exp((M·y − A·y²/2H)/(L·a_new))` within the walls, by
 * midpoint quadrature: its mean, spread and Bright Band fraction. */
function predictedProfile(
  m: number,
  a: number,
): {
  readonly meanDepth: number;
  readonly sigma: number;
  readonly brightFraction: number;
} {
  const {lowest, highest} = centreRange();
  const scale = BRIGHT_BAND_DEPTH * Math.PI * R_NEW * R_NEW;
  const steps = 200_000;
  const width = (highest - lowest) / steps;
  const exponent = (y: number): number =>
    (m * y - (a * y * y) / (2 * AQUARIUM_HEIGHT)) / scale;
  // Subtract the peak so the exponential never overflows.
  let peak = -Infinity;
  for (let step = 0; step < steps; step++) {
    peak = Math.max(peak, exponent(lowest + (step + 0.5) * width));
  }
  let total = 0;
  let first = 0;
  let second = 0;
  let bright = 0;
  for (let step = 0; step < steps; step++) {
    const y = lowest + (step + 0.5) * width;
    const weight = Math.exp(exponent(y) - peak);
    total += weight;
    first += weight * y;
    second += weight * y * y;
    bright += y <= BRIGHT_BAND_DEPTH ? weight : 0;
  }
  const mean = first / total;

  return {
    meanDepth: mean,
    sigma: Math.sqrt(second / total - mean * mean),
    brightFraction: bright / total,
  };
}

function measureComposition(
  label: string,
  types: readonly OrganelleType[],
): CompositionCheck {
  const genes = types.map((type) => ({type, radius: R_NEW, x: 0, y: 0}));
  const world = createWorld(SEED, {
    mortality: "off",
    fertility: "off",
    generation0: {founders: randomFounders(COMPOSITION_BODIES, SEED, genes)},
  });

  const settledFrom = COMPOSITION_TICKS / 2;
  const depths: number[] = [];
  let bright = 0;
  runTicksWatching(world, COMPOSITION_TICKS, (current, tick) => {
    if (tick <= settledFrom || tick % COMPOSITION_SAMPLE_EVERY !== 0) {
      return;
    }
    for (const organism of getPopulation(current)) {
      depths.push(organism.y);
      bright += organism.y <= BRIGHT_BAND_DEPTH ? 1 : 0;
    }
  });

  const {m, a} = compositionTotals(types);
  const predicted = predictedProfile(m, a);
  const measured = meanAndSigma(depths);
  const area = Math.PI * R_NEW * R_NEW;
  // Linearising the drift (D/(L·a_new))·(M − A·y/H) about y*: the rate is
  // D·A/(H·L·a_new), D = s²/4 per axis for a baseline body's step s.
  const diffusion = (2 / (6 * Math.PI)) ** 2 / 4;

  return {
    label,
    samples: depths.length,
    meanDepth: measured.mean,
    sigma: measured.sigma,
    brightFraction: bright / depths.length,
    restingDepth: (AQUARIUM_HEIGHT * m) / a,
    predictedMeanDepth: predicted.meanDepth,
    predictedSigma: predicted.sigma,
    predictedBrightFraction: predicted.brightFraction,
    freeSigma: Math.sqrt((BRIGHT_BAND_DEPTH * AQUARIUM_HEIGHT * area) / a),
    relaxation: (AQUARIUM_HEIGHT * BRIGHT_BAND_DEPTH * area) / (diffusion * a),
  };
}

export function reportRestingDepthByComposition(): void {
  const checks = [
    measureComposition("1F+1C", ["float", "chloroplast"]),
    measureComposition("1F+2C", ["float", "chloroplast", "chloroplast"]),
  ];

  heading("The Resting Depth by composition: Fixed Populations");
  note(
    `  ${String(COMPOSITION_BODIES)} baseline bodies placed at random, organelles at r_new = ${num(R_NEW)} on the centre, mortality and fertility off, seed ${String(SEED)}.`,
  );
  note(
    `  ${integer(COMPOSITION_TICKS)} ticks, second half read (${integer(checks[0].samples)} depth readings). Profile exp((M·y − A·y²/2H)/(L·a_new)) within the walls, g = ${num(G)}.`,
  );
  note(
    "  The layout's P_y/A term is ignored: the organelles sit on the centre. The profile also ignores bodies crowding and pushing each other.",
  );
  table(
    [
      "composition",
      "y*",
      "mean depth",
      "predicted",
      "σ",
      "predicted σ",
      "free σ",
      "Bright Band",
      "predicted",
      "relaxes in",
    ],
    checks.map((check) => [
      check.label,
      num(check.restingDepth),
      num(check.meanDepth),
      num(check.predictedMeanDepth),
      num(check.sigma),
      num(check.predictedSigma),
      num(check.freeSigma),
      percent(check.brightFraction),
      percent(check.predictedBrightFraction),
      `${integer(Math.round(check.relaxation))} ticks`,
    ]),
  );
}
