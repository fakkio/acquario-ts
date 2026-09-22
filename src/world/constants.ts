/**
 * M2's physical constants: provisional but internally consistent, each with
 * its derivation written beside it. None of these are claimed to be
 * *right* yet — only of the same order as each other, so a run neither
 * dies out in the first few hundred ticks nor pegs at the carbon ceiling
 * and freezes before it says anything. M5 re-solves several of them
 * against a measured α; each entry below says whether it is fixed by
 * construction or open for that.
 *
 * Every entry the calibration can move is wrapped in `tunable` and can be
 * overridden from the environment — `ACQUARIO_<NAME>` — read **once, at
 * module import** (ADR-0024). That is what lets the harness sweep by
 * re-invoking itself per candidate instead of hand-editing this file
 * between runs, and it is the cost ADR-0024 said would have to be paid
 * somewhere: the alternative was threading a `WorldConstants` record
 * through `createWorld` and into every module that reads this one,
 * permanently, for an instrument used in a single milestone. An override
 * never changes a committed value; it changes what one process sees.
 *
 * The constants that *fix a unit* are deliberately left outside the
 * mechanism, so a sweep cannot reach them at all — see `RHO`,
 * `LIGHT_SURFACE_INTENSITY`, `BODY_COST_COEFFICIENT` and
 * `LIGHT_ATTENUATION_K` below.
 *
 * This module still imports nothing, and the property is worth keeping:
 * nothing it holds can depend on anything that reads it. `globalThis` is
 * not an import, and the browser — where there is no `process` at all —
 * reads an empty table and every committed value.
 */

/** The one prefix the environment is read through, so a variable meant for
 * something else can never be mistaken for a constant. */
const OVERRIDE_PREFIX = "ACQUARIO_";

const environmentOverrides: Readonly<Record<string, string | undefined>> =
  (globalThis as {process?: {env?: Record<string, string | undefined>}}).process
    ?.env ?? {};

/** Every name `tunable` has been asked for, so the check at the bottom of
 * this file can tell an override of a real constant from a typo. */
const tunableNames = new Set<string>();

/**
 * One constant, overridable from `ACQUARIO_<name>`.
 *
 * A bad value throws at import rather than falling back to the committed
 * one. A sweep is a loop of child processes whose only output is a report,
 * and a run that silently ignored the candidate it was asked for would put
 * a number in that report under the wrong label — the one failure mode an
 * instrument must not have.
 */
function tunable(name: string, committed: number): number {
  tunableNames.add(name);
  const override = environmentOverrides[OVERRIDE_PREFIX + name];
  if (override === undefined) {
    return committed;
  }

  const parsed = Number(override);
  if (override.trim() === "" || !Number.isFinite(parsed)) {
    throw new Error(
      `${OVERRIDE_PREFIX}${name} is not a finite number: ${JSON.stringify(override)}`,
    );
  }

  return parsed;
}

/**
 * Each diffusible's cap coefficient: a cap of `K_CAP[resource] × bodyArea`
 * is a maximum internal *concentration*, not a bucket size (ADR-0003).
 *
 * Per-resource rather than a single scalar, because `kCap` was never a unit
 * (ADR-0022). It carries `ρ`'s own dimension — carbon per area — so fixing
 * both at 1 was one unit choice *plus* one silent physical assertion: that
 * an organism can hold exactly its own body's worth of a diffusible. That
 * assertion is load-bearing at mitosis, where it forces a parent to sit at
 * exactly 100% of its food store to afford a same-sized child, and it
 * collides with the throttle-never-spill rule at precisely the tick it
 * matters. Only the ratio `kCap/ρ` is physical, and `RHO` alone carries the
 * carbon unit from here on.
 *
 * Every entry is still 1: food's headroom above `ρ` is the calibration's
 * change, not this one's. Widening the shape first is what keeps the value's
 * change attributable to the ticket that makes it.
 *
 * Deliberately not annotated `Record<Diffusible, number>`, which would cost
 * this module the one property it has always had: it imports nothing, so
 * nothing it holds can depend on anything that reads it. The table's
 * completeness is checked where it is consumed instead — `organism.ts`
 * spreads it into a `Record<Resource, number>`, so a diffusible missing an
 * entry here is a compile error there.
 */
export const K_CAP = {
  oxygen: tunable("K_CAP_OXYGEN", 1),
  carbonDioxide: tunable("K_CAP_CARBON_DIOXIDE", 1),
  food: tunable("K_CAP_FOOD", 1),
};

/**
 * Body density, and the constant that fixes the carbon unit on its own
 * (ADR-0022). `ρ = 1` collapses body mass onto body area; `K_CAP` used to
 * be described as making the same move for concentration, and does not —
 * see its comment above.
 *
 * **Not tunable, absolutely.** It is the carbon unit. Overriding it would
 * calibrate nothing: `s` is proportional to `ρ` through the budget, so
 * `s/ρ` — the only ratio that matters — never moves (ADR-0022).
 */
export const RHO = 1;

/**
 * Energy's own cap coefficient, outside `K_CAP`'s table because energy is
 * neither a carbon nor an oxygen quantity: its unit is fixed separately, by
 * `β = 1`, rather than by coincidence of notation. About 240 ticks of
 * autonomy for a baseline body at the respiration rate M2's later slices
 * land. Open for M5 to move.
 */
export const K_CAP_ENERGY = tunable("K_CAP_ENERGY", 400);

/**
 * The carbon budget, phrased as "enough carbon for K baseline organisms" —
 * ADR-0001's ecological knob. Chosen well above `STARTING_POPULATION`
 * (40) so generation 0 begins comfortably under the carbon ceiling, with
 * headroom for M4's mitosis to grow the population before M5 tunes this
 * for real. Open for M5 to move.
 */
export const CARBON_BUDGET_BASELINE_ORGANISMS = tunable(
  "CARBON_BUDGET_BASELINE_ORGANISMS",
  200,
);

/**
 * How initial ambient carbon splits between CO₂ and food: in favour of
 * CO₂, so the world starts carbon-rich and food-poor and a run's first
 * story, once M2's later slices land, is fixation in the photic zone
 * rather than an already-full food pool. Open for M5 to move.
 */
export const AMBIENT_CO2_SHARE = tunable("AMBIENT_CO2_SHARE", 0.75);

/**
 * Oxygen's ambient concentration, chosen directly rather than derived: the
 * CO₂ term already carries oxygen of its own (ADR-0001), so oxygen needs
 * no closed-form tie to the carbon budget. Open for M5 to move.
 */
export const AMBIENT_OXYGEN_CONCENTRATION = tunable(
  "AMBIENT_OXYGEN_CONCENTRATION",
  0.5,
);

/**
 * Passive exchange's rate coefficient (ADR-0003): `flux = kDiffusion ×
 * perimeter × (C_external − C_internal)`. Chosen against the time constant
 * `r / (2·kDiffusion)` — 100 ticks for a baseline body to reach diffusive
 * equilibrium from a standing start, which is fast enough that a run's
 * opening transient is over quickly and slow enough to read as diffusion
 * rather than as a snap to equilibrium.
 *
 * Reachable from the environment, and deliberately **out of M5's sweep**
 * (ADR-0022): that same time constant is how long a parent takes to reach
 * the mitosis mass gate, so it sets the reproductive period, and moving it
 * rescales every other measurement in the run rather than changing one of
 * them.
 */
export const K_DIFFUSION = tunable("K_DIFFUSION", 0.005);

/**
 * The light unit: fixed by construction, the same move `RHO` makes for
 * carbon. Surface light is exactly 1.
 *
 * **Not tunable, absolutely**, for the same reason `RHO` is not.
 */
export const LIGHT_SURFACE_INTENSITY = 1;

/**
 * Light's exponential attenuation coefficient with depth (ADR-0004):
 * `ln(10)/10`, chosen so light falls to a tenth of its surface value ten
 * baseline radii down. With `AQUARIUM_HEIGHT` at 40 baseline radii, that
 * puts the photic zone at the aquarium's top quarter — enough of a split
 * that depth is worth something, without every organism below it sitting
 * in total darkness.
 *
 * **Not tunable.** `PHOTIC_BAND_DEPTH` is derived from this value and is
 * fixed before any calibration run (ADR-0023), so a sweep able to move
 * this one would be moving the window `α` is measured through. Reopenable
 * only with an ADR, which means editing this line.
 */
export const LIGHT_ATTENUATION_K = Math.log(10) / 10;

/**
 * Photosynthesis's rate coefficient (ADR-0003's mass-action shape, applied
 * to carbon fixation): `rate = kPhoto × C_internal(CO₂) × light ×
 * diameter`. Chosen so a baseline body (diameter 2) near the surface fixes
 * on the order of a few hundredths of a unit of carbon per tick — the same
 * order as `K_DIFFUSION`'s passive flux, so fixation and passive exchange
 * move mass at comparable rates rather than one swamping the other. Hand-
 * computed rather than measured, like every constant in this table; the
 * next M2 slice re-derives it once respiration closes the cycle and a run
 * exists to read.
 */
export const K_PHOTO = tunable("K_PHOTO", 0.03);

/**
 * Respiration's rate coefficient: `rate = kResp × C_internal(food) ×
 * C_internal(O₂) × area`, mass action on both internal reactant
 * concentrations (ADR-0003's shape extended to two reactants), scaled by
 * body area rather than by a perimeter-like geometric factor. That choice
 * is what keeps energy income linear in `r`: respiration's *capacity*
 * grows with area while passive exchange's *supply* grows only with
 * perimeter, so a large body's respiration stays supply-limited rather
 * than substrate-limited, and consumption settles wherever it matches
 * what is arriving rather than at some internal ceiling.
 *
 * Reachable from the environment, and **not a lever M5 pulls** (ADR-0025).
 * Lowering it is the obvious-looking way to let food pile up toward the
 * mass gate and it is backwards: it pushes respiration out of the
 * supply-limited regime, and supply-limitation is the only reason income
 * is linear in `r`. `K_PHOTO` is the lever instead.
 */
export const K_RESP = tunable("K_RESP", 1.0);

/**
 * Carbon-to-energy conversion: every unit of food (and matching O₂)
 * respiration consumes yields this many units of energy. Forced by `β = 1`
 * making a baseline body's body cost ≈ π per tick (ADR-0009), so this is
 * the term that has to make that cost affordable out of a plausible
 * respiration rate.
 *
 * Measured, not hand-computed, per this ticket's instruction to re-derive
 * the table against what a run actually does. The milestone's paper table
 * put this at 100, which starved the entire population within a few
 * hundred ticks: photosynthetic carbon income, averaged over a population
 * spread across the aquarium's full depth, is small enough that even a
 * baseline body sitting in full surface light could not out-earn its own
 * body cost at that yield. 800 is the order that lets a body in the photic
 * zone run a genuine energy surplus while a body on the floor still
 * starves — the legible gradient the milestone is after — found by running
 * `createWorld` out to 100k ticks and reading where the population
 * settles rather than by solving for it on paper.
 */
export const RESPIRATION_ENERGY_YIELD = tunable(
  "RESPIRATION_ENERGY_YIELD",
  800,
);

/**
 * The flat existence cost `c₀` (ADR-0009): the size-independent half of
 * maintenance, and the term that creates a minimum viable body size.
 *
 * The milestone's paper table put this at 2.2, from `c₀ = α·r_opt/2` with
 * a hand-computed `α ≈ 2.95` and a target `r_opt` of 1.5 — arithmetic that
 * predates a working respiration reaction to measure `α` against. Lowered
 * here alongside `RESPIRATION_ENERGY_YIELD` for the same reason: measured
 * against a real run rather than trusted on paper (ADR-0015). Still open
 * for M5 to re-derive properly against the *measured* `α`, which this
 * milestone's HUD now exposes.
 */
export const EXISTENCE_COST = tunable("EXISTENCE_COST", 1.0);

/**
 * The body-cost coefficient `β` in maintenance's area-scaled half, `β ×
 * area`. Fixed at 1 by construction, the same calibration move that fixes
 * `ρ`: it is what lets a baseline body's body cost read simply as its own
 * area. (`K_CAP` was once described as a third such move and is not — see
 * its own comment.)
 *
 * **Not tunable, absolutely.** It is the energy unit, and `c₀` is solved
 * against an `α` measured in that unit; moving it would move the scale the
 * prediction is stated in.
 */
export const BODY_COST_COEFFICIENT = 1;

/**
 * M4's mutation constants (ADR-0021): every one provisional, open for M5 to
 * move, in the style this table already established for M2's constants.
 */

/**
 * The probability that any one gene mutates at all, drawn independently per
 * gene. At four genes, this leaves roughly a third of births exact clones —
 * `docs/vision.md`'s "some births are exact clones".
 */
export const MUTATION_PROBABILITY = tunable("MUTATION_PROBABILITY", 0.25);

/**
 * `bodyRadius`'s multiplicative step size: a mutation applies `× (1 +
 * u·δ)` or its reciprocal with equal probability. Chosen, together with
 * `GENERATION_0_MUTATION_SCALE`, so that scaling it by 5 reproduces
 * generation 0's `[1/1.4, 1.4]` spread — the range M1 already calibrated —
 * from a single ordinary birth's step.
 */
export const DELTA_BODY_RADIUS = tunable("DELTA_BODY_RADIUS", 0.08);

/**
 * `mitosisEnergyThreshold`'s additive step size, clamped to `[0, 1]`. Small
 * enough that a lineage's threshold drifts rather than jumps between
 * strategies in one birth.
 */
export const DELTA_MITOSIS_ENERGY_THRESHOLD = tunable(
  "DELTA_MITOSIS_ENERGY_THRESHOLD",
  0.05,
);

/**
 * `childAllocationRatio`'s additive step size, clamped to `[0, 1]`. Same
 * order as `DELTA_MITOSIS_ENERGY_THRESHOLD`, for the same reason: both are
 * dimensionless ratio genes mutating by the same law (ADR-0002).
 */
export const DELTA_CHILD_ALLOCATION_RATIO = tunable(
  "DELTA_CHILD_ALLOCATION_RATIO",
  0.05,
);

/**
 * `lineageHue`'s additive drift, wrapping modulo 1. Slow enough that a
 * clade reads as one colour from birth to birth, fast enough that a sweep
 * across the population is visible over hundreds of generations.
 */
export const DELTA_LINEAGE_HUE = tunable("DELTA_LINEAGE_HUE", 0.02);

/**
 * Multiplies every δ above for generation 0 only, so founders spread across
 * the range a lineage would otherwise take many generations to explore.
 * Derived, not picked: `DELTA_BODY_RADIUS × 5 = 0.4` puts founder radii in
 * `[1/1.4, 1.4]` of the baseline, whose top end is exactly
 * `MAX_RADIUS_FACTOR` — generation 0's spread stays what M1 calibrated it
 * to.
 */
export const GENERATION_0_MUTATION_SCALE = tunable(
  "GENERATION_0_MUTATION_SCALE",
  5,
);

/**
 * Mitosis's energy price, `MITOSIS_ENERGY_COST × childArea` (ADR-0019):
 * strictly proportional, with no flat term, unlike maintenance. The
 * asymmetry is load-bearing rather than an oversight — `r_opt = 2·c₀/α` is
 * derived from `reproductiveRate(r) ∝ (α·r − c₀ − β·r²) / r²`, and the
 * `/ r²` *is* the assumption that a child costs in proportion to its area.
 * A flat term would put a second knee in that curve and cost M5 its closed
 * form. Provisional, marked for M5 like the rest of this table: chosen so a
 * baseline-sized child (area ≈ π) costs on the order of a quarter of a
 * baseline parent's energy cap (`K_CAP_ENERGY × π ≈ 1257`), affordable at
 * `BASELINE_GENOME`'s `mitosisEnergyThreshold` without being free.
 */
export const MITOSIS_ENERGY_COST = tunable("MITOSIS_ENERGY_COST", 100);

/**
 * Last, once every `tunable` above has registered its name: an
 * `ACQUARIO_`-prefixed variable that matched nothing is a typo, or a
 * constant somebody expected to be reachable and is not, and either way
 * the run about to start is not the run that was asked for. It throws
 * rather than warns, because a sweep's output is a table of numbers under
 * labels, and a candidate silently run at the committed value lands in
 * that table under the wrong one.
 */
for (const key of Object.keys(environmentOverrides)) {
  if (
    key.startsWith(OVERRIDE_PREFIX) &&
    !tunableNames.has(key.slice(OVERRIDE_PREFIX.length))
  ) {
    throw new Error(
      `${key} does not name a tunable constant. The constants that fix a unit — RHO, LIGHT_SURFACE_INTENSITY, BODY_COST_COEFFICIENT — and LIGHT_ATTENUATION_K are deliberately unreachable; see src/world/constants.ts.`,
    );
  }
}
