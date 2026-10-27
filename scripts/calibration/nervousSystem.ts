import {
  AQUARIUM_HEIGHT,
  createWorld,
  getPopulation,
  lightAt,
  type Founder,
} from "../../src/world";
import {
  BROWNIAN_FORCE,
  DRAG_PER_RADIUS,
  K_FORCE,
  R_NEW,
} from "../../src/world/constants";
import {BODY_ID} from "../../src/world/organelles";
import {FIRST_INNOVATION_ID} from "../../src/world/organism";
import {randomFounders} from "./buoyancy";
import {heading, integer, note, num, percent, row, table} from "./report";
import {
  NERVOUS_SYSTEM_BIN_WIDTH,
  NERVOUS_SYSTEM_BODIES,
  NERVOUS_SYSTEM_DRIVE,
  NERVOUS_SYSTEM_SAMPLE_EVERY,
  NERVOUS_SYSTEM_TICKS,
  NERVOUS_SYSTEM_WEIGHT,
  SEED,
} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * M11's first behaviour, measured (#102): a Fixed Population of baseline
 * bodies, each carrying one thruster at `r_new`, radial at the centre and
 * pointing up, and one Reflex, a synapse from the body's `light` to the
 * thruster's `power` with a negative weight `w`. Mortality and fertility
 * off, so nothing but motion and the walls shapes the result.
 *
 * **The prediction, derived before the run.** With no weighing organelle and
 * no lever arm the Body Axis stays vertical and nothing turns the body, so
 * the thrust is a force along `−y` of
 *
 *     F(y) = kForce · 2·r_new · s(y),    s(y) = clamp(drive + w·I(y), 0, 1),
 *
 * `I(y) = exp(−k·y)` the light at the body's centre. A body of radius `R`
 * has drag `6π·R`, so it drifts upward at `v(y) = F(y)/(6π·R)`, and it
 * diffuses with `D = s_B²/4`, `s_B` its Brownian step per tick. Zero flux
 * between the walls makes the stationary profile satisfy `D·p′ = −v·p`, so
 *
 *     p(y) ∝ exp(−Φ(y)),    Φ(y) = (1/D) ∫ v(u) du,
 *
 * the generalisation of the constant force's `exp(−y/L)` (`Φ = y/L`). With
 * `w < 0` the signal is zero above the stopping depth `y*`, where
 * `drive + w·I(y*) = 0`, i.e. `y* = ln(|w|/drive)/k`, so `p` is flat from the
 * surface down to `y*`. Below it the clamp does not bind (while `s ≤ 1`) and
 *
 *     Φ(y) = (a/D)·[drive·(y − y*) − |w|·(e^{−k·y*} − e^{−k·y})/k],
 *     a = kForce·2·r_new / (6π·R).
 *
 * The code integrates the same `Φ` by midpoint quadrature over the light
 * table, which needs no case split for the clamp at 1 or at the walls.
 * Assumptions: a vertical axis, no torque, Brownian `D`, drag `6π·R`, and
 * non-interacting bodies. Forty bodies of radius ~1 crowd the flat part
 * above `y*` and push each other, so a mean depth deeper than predicted may
 * be the separation pass, as in `thrusters`.
 *
 * Reported, never gated (ADR-0024).
 */

const UP = {cos: 0, sin: -1};

/** Light's decay rate, read from the table's own two ends rather than
 * imported: `y* = ln(|w|/drive)/k` is the closed form for a pure
 * exponential, and the table is that to within its interpolation. */
const LIGHT_RATE = Math.log(lightAt(0) / lightAt(1));

/** One founder's genes: a thruster, then the synapse that wires it. The
 * world mints Innovation Ids from `FIRST_INNOVATION_ID` in placement then
 * genome order, so founder `i`'s thruster is `2i + FIRST_INNOVATION_ID`. */
function reflexGenes(index: number): Founder["genome"]["genes"] {
  const thrusterId = FIRST_INNOVATION_ID + 2 * index;

  return [
    {
      type: "thruster",
      radius: R_NEW,
      x: 0,
      y: 0,
      orientation: UP,
      drive: NERVOUS_SYSTEM_DRIVE,
    },
    {
      source: {id: BODY_ID, port: "light"},
      destination: {id: thrusterId, port: "power"},
      weight: NERVOUS_SYSTEM_WEIGHT,
    },
  ];
}

function reflexFounders(): readonly Founder[] {
  return randomFounders(NERVOUS_SYSTEM_BODIES, SEED, []).map(
    (founder, index) => ({
      ...founder,
      genome: {...founder.genome, genes: reflexGenes(index)},
    }),
  );
}

/** The signal at depth `y`: `clamp(drive + w·I(y), 0, 1)`. */
function signalAt(y: number): number {
  return Math.min(
    1,
    Math.max(0, NERVOUS_SYSTEM_DRIVE + NERVOUS_SYSTEM_WEIGHT * lightAt(y)),
  );
}

/** The Brownian diffusion `D = s²/4` of a body of radius `R`. */
function diffusion(radius: number): number {
  const step = BROWNIAN_FORCE / (DRAG_PER_RADIUS * Math.sqrt(radius));

  return (step * step) / 4;
}

/** `y*`, where `drive + w·I(y) = 0`: `ln(|w|/drive)/k`. */
export function stoppingDepth(): number {
  return (
    Math.log(Math.abs(NERVOUS_SYSTEM_WEIGHT) / NERVOUS_SYSTEM_DRIVE) /
    LIGHT_RATE
  );
}

export interface Profile {
  /** Fraction of the mass in each bin of `NERVOUS_SYSTEM_BIN_WIDTH`, from
   * the surface. */
  readonly bins: readonly number[];
  readonly meanDepth: number;
  /** Fraction at or above the stopping depth. */
  readonly aboveStop: number;
}

/** The predicted profile `exp(−Φ)` between the walls, by midpoint
 * quadrature, binned like the measurement. */
export function predictedProfile(radius: number): Profile {
  const lowest = radius;
  const highest = AQUARIUM_HEIGHT - radius;
  const steps = 200_000;
  const width = (highest - lowest) / steps;
  const speed = (K_FORCE * 2 * R_NEW) / (DRAG_PER_RADIUS * radius);
  const scale = diffusion(radius);
  const stop = stoppingDepth();
  const mass = new Array<number>(binCount()).fill(0);

  let phi = 0;
  let total = 0;
  let depthSum = 0;
  let above = 0;
  for (let step = 0; step < steps; step++) {
    const y = lowest + (step + 0.5) * width;
    phi += ((speed * signalAt(y)) / scale) * width;
    const weight = Math.exp(-phi);
    total += weight;
    depthSum += weight * y;
    above += y <= stop ? weight : 0;
    mass[Math.floor(y / NERVOUS_SYSTEM_BIN_WIDTH)] += weight;
  }

  return {
    bins: mass.map((value) => value / total),
    meanDepth: depthSum / total,
    aboveStop: above / total,
  };
}

function binCount(): number {
  return Math.ceil(AQUARIUM_HEIGHT / NERVOUS_SYSTEM_BIN_WIDTH);
}

export interface ReflexCheck {
  readonly radius: number;
  readonly samples: number;
  readonly measured: Profile;
  readonly predicted: Profile;
  readonly stoppingDepth: number;
}

export function measureReflexProfile(): ReflexCheck {
  const world = createWorld(SEED, {
    mortality: "off",
    fertility: "off",
    generation0: {founders: reflexFounders()},
  });
  const radius = getPopulation(world)[0].bodyRadius;
  const counts = new Array<number>(binCount()).fill(0);
  const stop = stoppingDepth();
  const settledFrom = NERVOUS_SYSTEM_TICKS / 2;
  let depthSum = 0;
  let aboveStop = 0;
  let samples = 0;
  runTicksWatching(world, NERVOUS_SYSTEM_TICKS, (current, tick) => {
    if (tick <= settledFrom || tick % NERVOUS_SYSTEM_SAMPLE_EVERY !== 0) {
      return;
    }
    for (const organism of getPopulation(current)) {
      depthSum += organism.y;
      aboveStop += organism.y <= stop ? 1 : 0;
      counts[Math.floor(organism.y / NERVOUS_SYSTEM_BIN_WIDTH)] += 1;
      samples += 1;
    }
  });

  return {
    radius,
    samples,
    stoppingDepth: stop,
    predicted: predictedProfile(radius),
    measured: {
      bins: counts.map((count) => count / samples),
      meanDepth: depthSum / samples,
      aboveStop: aboveStop / samples,
    },
  };
}

export function reportReflexProfile(check: ReflexCheck): void {
  const {measured, predicted} = check;
  heading("A hand-wired Reflex, light → power, on a Fixed Population");
  note(
    `  ${String(NERVOUS_SYSTEM_BODIES)} baseline bodies, one thruster each at r_new = ${num(R_NEW)}, drive = ${num(NERVOUS_SYSTEM_DRIVE)}, radial at the centre pointing up, and one synapse light → power, w = ${num(NERVOUS_SYSTEM_WEIGHT)}. Mortality and fertility off, seed ${String(SEED)}.`,
  );
  note(
    `  ${integer(NERVOUS_SYSTEM_TICKS)} ticks, second half sampled (${integer(check.samples)} readings). Profile exp(−Φ(y)), Φ = (1/D)·∫ F(y)/(6π·R) dy, within the walls.`,
  );
  row("body radius R", num(check.radius));
  row("stopping depth y*, drive + w·I(y*) = 0", num(check.stoppingDepth));
  row("mean depth, measured", num(measured.meanDepth));
  row("mean depth, predicted", num(predicted.meanDepth));
  row("at or above y*, measured", percent(measured.aboveStop));
  row("at or above y*, predicted", percent(predicted.aboveStop));

  // The tail past the last bin either profile puts a thousandth in is one
  // row, so the table is the part that moves.
  let last = 0;
  predicted.bins.forEach((value, index) => {
    if (value >= 1e-3 || measured.bins[index] >= 1e-3) {
      last = index;
    }
  });
  const tail = (bins: readonly number[]): number =>
    bins.slice(last + 1).reduce((sum, value) => sum + value, 0);
  const rows = predicted.bins.slice(0, last + 1).map((value, index) => {
    const from = index * NERVOUS_SYSTEM_BIN_WIDTH;

    return [
      `${num(from, 3)}–${num(from + NERVOUS_SYSTEM_BIN_WIDTH, 3)}`,
      percent(measured.bins[index]),
      percent(value),
    ];
  });
  rows.push([
    "deeper",
    percent(tail(measured.bins)),
    percent(tail(predicted.bins)),
  ]);
  note("");
  table(["depth", "measured", "predicted"], rows);
}
