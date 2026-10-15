import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  ROTATIONAL_DRAG_PER_CUBE,
  createWorld,
  getPopulation,
  type Founder,
} from "../../src/world";
import {
  BROWNIAN_FORCE,
  DRAG_PER_RADIUS,
  DRIVE_NEW,
  K_FORCE,
  R_NEW,
} from "../../src/world/constants";
import {randomFounders} from "./buoyancy";
import {heading, integer, note, num, percent, row} from "./report";
import {
  SEED,
  THRUSTER_BODIES,
  THRUSTER_ORBIT_PERIODS,
  THRUSTER_RIM,
  THRUSTER_SAMPLE_EVERY,
  THRUSTER_TICKS,
} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * M10's lone-thruster checks (#94): is a thruster's push the `F/ζ` and
 * `τ/ζ_rot` the motion step claims, seen on a population rather than on one
 * tick? Fixed Populations of baseline bodies each carrying one thruster at
 * `r_new` and `drive_new`, mortality and fertility off, so the Thrust Cost
 * moves no body and nothing but motion and the walls shapes the result.
 *
 * Thrust is constant in depth, unlike lift, so a thruster pointing up
 * against Brownian motion settles to `p(y) ∝ exp(−y/L)` between the walls,
 * with `L = D/v₀`, `v₀ = F/(6π·R)` and `D = s²/4`, `s` the Brownian step of
 * a body of radius `R`. It is the float's profile without its `y²/2H` term.
 * Pointing down, the same law piles the bodies on the floor.
 *
 * The prediction is for non-interacting bodies. Forty bodies of radius 1
 * pile against the wall and push each other off it, so a mean distance
 * longer than predicted is the separation pass, as in `buoyancy`. The orbit
 * runs with Brownian motion off (`WorldOptions.brownian`), since diffusion
 * over one period would swamp a circle of radius 1.4.
 *
 * Reported, never gated (ADR-0024).
 */

/** `drive_new × kForce × 2·r_new`, the push of a new thruster. */
const FORCE = DRIVE_NEW * K_FORCE * 2 * R_NEW;

const UP = {cos: 0, sin: -1};
const DOWN = {cos: 0, sin: 1};

/** The radius of a baseline body carrying one thruster, read from a world
 * rather than derived: the body's own accounting of its area is the one the
 * drag reads, and a formula here would be a second copy of it. */
function carrierRadius(genes: Founder["genome"]["genes"]): number {
  const world = createWorld(SEED, {
    generation0: {
      founders: randomFounders(1, SEED, genes),
    },
  });

  return getPopulation(world)[0].bodyRadius;
}

function thruster(
  x: number,
  y: number,
  orientation: {readonly cos: number; readonly sin: number},
): Founder["genome"]["genes"] {
  return [
    {type: "thruster", radius: R_NEW, x, y, orientation, drive: DRIVE_NEW},
  ];
}

/** The scale height `D/v₀` of a body of radius `R` pushed by `FORCE`. */
function scaleHeight(radius: number): number {
  const step = BROWNIAN_FORCE / (DRAG_PER_RADIUS * Math.sqrt(radius));
  const diffusion = (step * step) / 4;

  return diffusion / (FORCE / (DRAG_PER_RADIUS * radius));
}

export interface DepthCheck {
  readonly direction: "up" | "down";
  readonly bodies: number;
  readonly ticks: number;
  readonly samples: number;
  readonly scaleHeight: number;
  /** Mean distance from the wall the thruster pushes towards. */
  readonly meanDistance: number;
  readonly predictedMeanDistance: number;
  /** Fraction within one scale height of that wall. */
  readonly nearFraction: number;
  readonly predictedNearFraction: number;
}

/** The mean distance from the wall and the fraction within `L` of it, of
 * `exp(−d/L)` between the walls, by midpoint quadrature. */
export function predictedPile(
  scale: number,
  span: number,
): {
  readonly meanDistance: number;
  readonly nearFraction: number;
} {
  const steps = 200_000;
  const width = span / steps;

  let total = 0;
  let distanceSum = 0;
  let near = 0;
  for (let step = 0; step < steps; step++) {
    const distance = (step + 0.5) * width;
    const weight = Math.exp(-distance / scale);
    total += weight;
    distanceSum += weight * distance;
    near += distance <= scale ? weight : 0;
  }

  return {meanDistance: distanceSum / total, nearFraction: near / total};
}

function measureDepth(direction: "up" | "down"): DepthCheck {
  const orientation = direction === "up" ? UP : DOWN;
  const world = createWorld(SEED, {
    mortality: "off",
    fertility: "off",
    generation0: {
      founders: randomFounders(
        THRUSTER_BODIES,
        SEED,
        thruster(0, 0, orientation),
      ),
    },
  });

  const radius = carrierRadius(thruster(0, 0, UP));
  const lowest = radius;
  const highest = AQUARIUM_HEIGHT - radius;
  const scale = scaleHeight(radius);
  const settledFrom = THRUSTER_TICKS / 2;
  let distanceSum = 0;
  let nearSum = 0;
  let samples = 0;
  runTicksWatching(world, THRUSTER_TICKS, (current, tick) => {
    if (tick <= settledFrom || tick % THRUSTER_SAMPLE_EVERY !== 0) {
      return;
    }
    const population = getPopulation(current);
    for (const organism of population) {
      const distance =
        direction === "up" ? organism.y - lowest : highest - organism.y;
      distanceSum += distance;
      nearSum += distance <= scale ? 1 : 0;
    }
    samples += population.length;
  });

  const predicted = predictedPile(scale, highest - lowest);

  return {
    direction,
    bodies: THRUSTER_BODIES,
    ticks: THRUSTER_TICKS,
    samples,
    scaleHeight: scale,
    meanDistance: distanceSum / samples,
    predictedMeanDistance: predicted.meanDistance,
    nearFraction: nearSum / samples,
    predictedNearFraction: predicted.nearFraction,
  };
}

export function measureUp(): DepthCheck {
  return measureDepth("up");
}

export function measureDown(): DepthCheck {
  return measureDepth("down");
}

export function reportDepth(check: DepthCheck): void {
  const wall = check.direction === "up" ? "surface" : "floor";
  heading(
    check.direction === "up"
      ? "A lone thruster pointing up against exp(−y/L)"
      : "A lone thruster pointing down against a pile on the floor",
  );
  note(
    `  ${String(check.bodies)} baseline bodies, one thruster each at r_new = ${num(R_NEW)}, drive_new = ${num(DRIVE_NEW)}, radial at the centre, random placement, mortality and fertility off, seed ${String(SEED)}.`,
  );
  note(
    `  ${integer(check.ticks)} ticks, second half sampled (${integer(check.samples)} readings). Profile exp(−d/L), d the distance from the ${wall}, within the walls.`,
  );
  row("F = drive × kForce × 2r", num(FORCE));
  row("L = D/v₀, predicted", num(check.scaleHeight));
  row(`mean distance from the ${wall}, measured`, num(check.meanDistance));
  row(
    `mean distance from the ${wall}, predicted`,
    num(check.predictedMeanDistance),
  );
  row(`within L of the ${wall}, measured`, percent(check.nearFraction));
  row(
    `within L of the ${wall}, predicted`,
    percent(check.predictedNearFraction),
  );
}

export interface OrbitCheck {
  readonly lever: number;
  readonly ticks: number;
  readonly period: number;
  readonly predictedPeriod: number;
  readonly radius: number;
  readonly predictedRadius: number;
}

/** One thruster, tangential at distance `l` from the centre, Brownian motion
 * off: the body turns at `l·F/(8π·R³)` and the push turns with it, so the
 * centre goes round a circle. The period is read from the unwrapped angle of
 * the Body Axis, the radius from the half-extent of the trajectory. */
export function measureOrbit(): OrbitCheck {
  const lever = THRUSTER_RIM;
  const radius = carrierRadius(thruster(lever, 0, DOWN));
  const predictedPeriod =
    (2 * Math.PI * ROTATIONAL_DRAG_PER_CUBE * radius ** 3) / (FORCE * lever);
  const predictedRadius = (4 * radius ** 2) / (3 * lever);
  const ticks = Math.ceil(THRUSTER_ORBIT_PERIODS * predictedPeriod);

  const world = createWorld(SEED, {
    mortality: "off",
    fertility: "off",
    brownian: "off",
    generation0: {
      founders: [
        {
          x: AQUARIUM_WIDTH / 2,
          y: AQUARIUM_HEIGHT / 2,
          genome: {...BASELINE_GENOME, genes: thruster(lever, 0, DOWN)},
        },
      ],
    },
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let previous = 0;
  let unwrapped = 0;
  runTicksWatching(world, ticks, (current) => {
    const [body] = getPopulation(current);
    minX = Math.min(minX, body.x);
    maxX = Math.max(maxX, body.x);
    minY = Math.min(minY, body.y);
    maxY = Math.max(maxY, body.y);
    const angle = Math.atan2(body.axis.sin, body.axis.cos);
    let step = angle - previous;
    if (step > Math.PI) {
      step -= 2 * Math.PI;
    } else if (step < -Math.PI) {
      step += 2 * Math.PI;
    }
    unwrapped += step;
    previous = angle;
  });

  const turns = unwrapped / (2 * Math.PI);

  return {
    lever,
    ticks,
    period: turns > 0 ? ticks / turns : Number.NaN,
    predictedPeriod,
    radius: (maxX - minX + (maxY - minY)) / 4,
    predictedRadius,
  };
}

export function reportOrbit(check: OrbitCheck): void {
  heading("A tangential thruster at the rim: period and orbit radius");
  note(
    `  One baseline body, one thruster at l = ${num(check.lever)} from the centre pushing across the lever, Brownian motion off, seed ${String(SEED)}.`,
  );
  note(
    `  ${integer(check.ticks)} ticks (${num(THRUSTER_ORBIT_PERIODS)} predicted periods). Period 2π·8π·R³/(F·l), orbit radius 4R²/(3·l).`,
  );
  row("period, measured", num(check.period));
  row("period, predicted", num(check.predictedPeriod));
  row("orbit radius, measured", num(check.radius));
  row("orbit radius, predicted", num(check.predictedRadius));
}
