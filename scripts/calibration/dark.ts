import {
  AQUARIUM_AREA,
  bodyAreaOfRadius,
  energyCap,
  createWorld,
  getPoolLevels,
  getPopulation,
  lightAt,
  type OrganismView,
} from "../../src/world";
import {
  BODY_COST_COEFFICIENT,
  EXISTENCE_COST,
  K_DIFFUSION,
  RESPIRATION_ENERGY_YIELD,
} from "../../src/world/constants";
import {heading, note, num, row, table} from "./report";
import {
  DARK_DEPTH,
  DARK_MAX_RADIUS,
  DARK_MIN_RADIUS,
  DARK_RUNGS,
  DARK_TICKS,
  SEED,
} from "./settings";
import {
  ambientCarbon,
  radiusLadder,
  runTicksWatching,
  soleFounder,
} from "./worlds";

/**
 * ADR-0023's dark prediction, confirmed or refuted — the first thing the
 * ticket asks this harness to settle, and the one measurement here with a
 * number written down in advance to be wrong about.
 *
 * The prediction, from the ADR: below the light, respiration's substrate
 * arrives entirely by diffusion, so income is linear in `r` with slope
 *
 *     α_dark = 2π · RESPIRATION_ENERGY_YIELD · kDiffusion · s_food
 *
 * and survival at radius `r` needs `α_dark·r ≥ c₀ + β·r²`. That is a
 * downward parabola, so the dark admits a *band* of radii rather than a
 * ceiling — small bodies fail on the flat `c₀`, large ones on `β·r²` — and
 * a band exists at all only where `α_dark ≥ 2√(β·c₀)`.
 *
 * Measured one world per rung, each holding a single body. Survival in the
 * dark is a pure energy balance with no neighbour in it, and one body per
 * world means no rung's body mass moves the ambient concentration another
 * rung is being measured against. These worlds are **mortal and
 * infertile**: mortality is the measurement — the question is who dies —
 * and fertility is off because a birth in the dark would be the thing under
 * test showing up as a confound.
 */

interface DarkRung {
  readonly radius: number;
  /** The tick it died on, or `null` if it was still alive at the end — the
   * outcome itself, rather than a flag beside it that could disagree. */
  readonly diedAt: number | null;
  /** Energy as a fraction of its cap at the end, or at death. A survivor
   * sitting at 2% of cap is surviving the way a candle burns out. */
  readonly finalEnergyFraction: number;
}

/** Read off the view, so the cap is the founder's own Cytoplasm Area's
 * rather than one recomputed here from the rung's radius. */
function energyFraction(organism: OrganismView): number {
  return organism.energy / energyCap(organism);
}

function measureRung(radius: number): DarkRung {
  const world = createWorld(SEED, {
    mortality: "on",
    fertility: "off",
    generation0: {founders: soleFounder(radius, DARK_DEPTH)},
  });

  let diedAt: number | null = null;
  let lastEnergyFraction = energyFraction(getPopulation(world)[0]);

  const finished = runTicksWatching(world, DARK_TICKS, (current, tick) => {
    const population = getPopulation(current);
    if (population.length === 0) {
      diedAt ??= tick;
      return;
    }
    lastEnergyFraction = energyFraction(population[0]);
  });

  return {
    radius,
    diedAt: getPopulation(finished).length > 0 ? null : diedAt,
    finalEnergyFraction: lastEnergyFraction,
  };
}

/** The two roots of `−β r² + α_dark r − c₀ = 0`: where the parabola crosses
 * zero, and therefore the band's own bounds on paper. */
function predictedBand(
  alphaDark: number,
): {readonly lower: number; readonly upper: number} | null {
  const discriminant =
    alphaDark ** 2 - 4 * BODY_COST_COEFFICIENT * EXISTENCE_COST;
  if (discriminant < 0) {
    return null;
  }
  const root = Math.sqrt(discriminant);

  return {
    lower: (alphaDark - root) / (2 * BODY_COST_COEFFICIENT),
    upper: (alphaDark + root) / (2 * BODY_COST_COEFFICIENT),
  };
}

export function reportDarkBand(): void {
  // Read off a world at tick 0, so `s_food` is the ambient the prediction
  // is about rather than whatever a run has since turned it into.
  const reference = createWorld(SEED);
  const pools = getPoolLevels(reference);
  const ambientFood = pools.food / AQUARIUM_AREA;
  const ambient = ambientCarbon(pools);
  const alphaDark =
    2 * Math.PI * RESPIRATION_ENERGY_YIELD * K_DIFFUSION * ambientFood;
  const threshold = 2 * Math.sqrt(BODY_COST_COEFFICIENT * EXISTENCE_COST);
  const band = predictedBand(alphaDark);

  heading("The dark — can anything live below the bright band?");
  note(
    `  One body per world, alone, at depth ${num(DARK_DEPTH)} where light is ${num(lightAt(DARK_DEPTH))} of the`,
  );
  note(
    `  surface's. Mortal and infertile, ${String(DARK_TICKS)} ticks each, seed ${String(SEED)}.`,
  );
  row("ambient carbon s", num(ambient));
  row("ambient food s_food", num(ambientFood));
  row("α_dark = 2π·Y·kDiff·s_food", num(alphaDark));
  row("survival threshold 2√(β·c₀)", num(threshold));
  row(
    "predicted band",
    band === null
      ? "empty — α_dark is below the threshold, no radius survives"
      : `r ∈ [${num(band.lower)}, ${num(band.upper)}]`,
  );

  const rungs = radiusLadder(DARK_MIN_RADIUS, DARK_MAX_RADIUS, DARK_RUNGS).map(
    (radius) => measureRung(radius),
  );
  table(
    ["r", "area", "maintenance", "outcome", "energy at end"],
    rungs.map((rung) => {
      const area = bodyAreaOfRadius(rung.radius);

      return [
        num(rung.radius, 3),
        num(area, 3),
        num(EXISTENCE_COST + BODY_COST_COEFFICIENT * area, 3),
        rung.diedAt === null ? "alive" : `died at tick ${String(rung.diedAt)}`,
        `${num(100 * rung.finalEnergyFraction, 3)}% of cap`,
      ];
    }),
  );

  const survivors = rungs.filter((rung) => rung.diedAt === null);
  row(
    "measured band",
    survivors.length === 0
      ? "EMPTY — every radius on the ladder starved"
      : `r ∈ [${num(survivors[0].radius)}, ${num(survivors[survivors.length - 1].radius)}]`,
  );
  row(
    "prediction",
    (band === null) === (survivors.length === 0)
      ? "CONFIRMED — paper and run agree"
      : "REFUTED — paper and run disagree",
  );
}
