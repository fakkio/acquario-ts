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
 * Each diffusible's cap coefficient: a cap of `K_CAP[resource] ×
 * cytoplasmArea` is a maximum internal *concentration*, not a bucket size
 * (ADR-0003, taken over the Cytoplasm Area from v0.2 by ADR-0029).
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
 * Food is the one entry #36 moves, to 1.5: the headroom this comment always
 * promised. Diffusion itself never consults this table — `ExchangeSettlement`
 * only ever checks a pool's own non-negativity (`environment.ts`), so raising
 * a body's cap does not by itself pull ambient carbon in any faster, and it
 * does not by itself move `r_max` either: measured directly, `1` and `1.5`
 * give the identical peak `C_food/ρ` (1.19, seed 7) at `AMBIENT_CO2_SHARE`'s
 * own committed value (below), because a body's food concentration settles
 * below even the old cap of 1 well before diffusion or
 * `applyPhotosynthesis`'s own headroom throttle would bind. What this move
 * buys instead is ADR-0022's own promise, independent of `r_max`: a store
 * that can hold more than a same-sized child needs without every future
 * ambient split having to stay just under 1 to avoid clipping it.
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
  food: tunable("K_CAP_FOOD", 1.5),
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
 * land.
 *
 * **A trap #36 found and steered around, worth recording here.** Reaching
 * `C_food = ρ` by enriching the ambient split (lower `AMBIENT_CO2_SHARE`,
 * higher `AMBIENT_OXYGEN_CONCENTRATION`, higher `RESPIRATION_ENERGY_YIELD`)
 * was tried first, and it worked for `r_max` — every radius on the ladder
 * cleared `ρ` — but it also raised a tick's uncapped respiration output far
 * enough past this cap that `throttledByFullEnergyStore` fired from tick 0
 * onward, at every radius, forever: the reaction was left refilling exactly
 * what maintenance drains, never more. `getMeasuredAlpha` excludes exactly
 * that case for exactly this reason, and a population capacity-pegged from
 * tick 0 has zero ticks left outside the exclusion to measure — `n`'s
 * reported value would have been `(c₀ + β·area)/r`'s own shape, not
 * respiration's. Raising this cap to chase that richness back out of
 * pathology was the next thing tried, and it broke `BASELINE_GENOME`'s
 * `mitosisEnergyThreshold` gate — a fraction of this same cap — badly enough
 * to collapse tenancy instead. Left at 400: `AMBIENT_CO2_SHARE`'s own move
 * (see its comment) stays mild enough not to need this cap raised at all —
 * the trade that made the mass gate reachable this way was declined for a
 * different reason than this one, but this cap would have had to move again
 * if it had been taken.
 */
export const K_CAP_ENERGY = tunable("K_CAP_ENERGY", 400);

/**
 * The carbon budget, phrased as "enough carbon for K baseline organisms" —
 * ADR-0001's ecological knob, solved for rather than chosen by eye (#35).
 *
 * `vision.md`'s calibration method runs the ceiling backwards: reproduction
 * halts once the ambient concentration `s` falls to `ρ`, which happens in
 * closed form once the population's summed body area reaches `N_max`
 * baseline-sized bodies at the target `r_opt`,
 *
 *     N_max = K/(2·r²) − aquariumArea/(2π·r²)      →      K = 2·r²·N_max + aquariumArea/π
 *
 * with `K` this same constant throughout — the `·π` that turns a count of
 * baseline organisms into an amount of carbon belongs to the *other*
 * closed form, `s = (K·π − A)/(A + aquariumArea)`, and appears nowhere
 * here. The chosen ceiling is `N_max = 150`, roughly four times
 * `STARTING_POPULATION` (40) and well clear of the ~340 bodies the
 * aquarium would physically pack at `r_opt`. `AQUARIUM_AREA` (2400, i.e.
 * 60 × 40 baseline radii) is written as a literal rather than imported,
 * for the same reason `LIGHT_ATTENUATION_K` computes its own value below
 * instead of importing one: this module holds nothing that depends on
 * anything that reads it.
 *
 * `npm run calibrate` reads this same K back out as "N_max at r = 1.5" —
 * 150.0 at this value — and as `s / ρ` at tick 0, which is 1.74 for
 * generation 0's actual founders (well above ADR-0022's ≥ 1, since 40
 * founders near `bodyRadius = 1` are far short of `N_max` bodies at
 * `r_opt = 1.5`).
 */
export const CARBON_BUDGET_BASELINE_ORGANISMS = tunable(
  "CARBON_BUDGET_BASELINE_ORGANISMS",
  2 * 1.5 ** 2 * 150 + (60 * 40) / Math.PI,
);

/**
 * How initial ambient carbon splits between CO₂ and food. M2 put this in
 * favour of CO₂ at 0.75, so the world opens carbon-rich and food-poor.
 *
 * **#36 moves it to 0.6 — better than M2's value, but not enough to clear
 * `r_max` or `tenancy`, by decision rather than by a gap left unnoticed.**
 * ADR-0025's fallback (mitosis draws a child's mass from CO₂ once food runs
 * short) would close `r_max` outright — measured with it in place, every
 * radius on the ladder clears `ρ`, `r_max` reads above the ladder's own top
 * of 4 baseline radii. It was tried, it worked, and it was declined anyway:
 * a parent hands its child the *same* resource it gives up everywhere else
 * in mitosis (`childAllocationRatio`'s split is food-for-food, oxygen-for-
 * oxygen, CO₂-for-CO₂), and converting CO₂ into mass at the exact moment of
 * birth is a cross-type exception to that rule, for food alone. See
 * `mitosis.ts`'s own comment and ADR-0019's amendment history for the
 * reasoning.
 *
 * Without the fallback, food alone has to reach `ρ` on its own, and no
 * combination found clears every gate at once: `AMBIENT_CO2_SHARE` pulls
 * `n` and `r_max` in opposite directions (0.6 keeps `n` mid-window at 1.07;
 * 0.5 pushes `r_max` to a barely-passing 3.12 but `n` to 1.15, the gate's
 * own ceiling), and `tenancy` stayed under 5 in every combination tried —
 * `AMBIENT_CO2_SHARE` from 0.4 to 0.6, `MITOSIS_ENERGY_COST` from 10 to 100,
 * `RESPIRATION_ENERGY_YIELD` up to 900 (which broke `n` outright once
 * paired with a lower share) — topping out at 4.25, short of the gate.
 *
 * 0.6 is committed as the better-than-default value it measurably is, not
 * as a value that clears the gates: at 0.6, `n = 1.07` (inside the window),
 * but `r_max = 2.59 ± 0.63` and `tenancy = 3.06`, both short of ADR-0025's
 * `≥ 3` and `≥ 5`. This is recorded as a finding on #36 rather than forced
 * into a passing number — the population trending toward small bodies that
 * a live run shows is consistent with `tenancy` failing (small bodies leave
 * the bright band before proving their fitness through several
 * reproductions), not necessarily with genuine convergence on `r_opt`.
 */
export const AMBIENT_CO2_SHARE = tunable("AMBIENT_CO2_SHARE", 0.6);

/**
 * Oxygen's ambient concentration, chosen directly rather than derived: the
 * CO₂ term already carries oxygen of its own (ADR-0001), so oxygen needs
 * no closed-form tie to the carbon budget.
 *
 * Swept at #36 and left unmoved. Raising it was part of a more aggressive
 * ambient-enrichment path the milestone tried and rejected (see
 * `AMBIENT_CO2_SHARE`'s and `K_CAP_ENERGY`'s own comments); on its own, at
 * `AMBIENT_CO2_SHARE`'s committed value, it did not move `tenancy` enough to
 * matter against `r_max`'s own shortfall.
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
 * puts the bright zone at the aquarium's top quarter — enough of a split
 * that depth is worth something, without every organism below it sitting
 * in total darkness.
 *
 * **Not tunable.** `BRIGHT_BAND_DEPTH` is derived from this value and is
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
 *
 * Swept at #36 — ADR-0025 calls this one "the lever" for `n` and `r_max`
 * specifically — and left unmoved. `n` is measured in the fixed, infertile
 * population the income ladder places (ADR-0015), so this reading does not
 * depend on how mitosis pays for a birth: `0.02` reads `n = 0.858`, already
 * below ADR-0025's `0.9` floor; `0.04` swings the other way, `n = 1.238`,
 * above the `1.15` ceiling. `0.03` sits inside the narrow window `n` needs;
 * the lever this sweep actually pulled for `r_max` and `tenancy` was
 * `AMBIENT_CO2_SHARE` (see its own comment for where that landed), and this
 * one moves `n` too sharply in either direction to also serve as a lever
 * for them.
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
 * body cost at that yield. 800 is the order that lets a body in the bright
 * zone run a genuine energy surplus while a body on the floor still
 * starves — the legible gradient the milestone is after — found by running
 * `createWorld` out to 100k ticks and reading where the population
 * settles rather than by solving for it on paper.
 *
 * Swept at #36, against tenancy, and left unmoved. `900` alone (paired with
 * `AMBIENT_CO2_SHARE` at 0.6) was part of the more aggressive path the
 * milestone tried and rejected (`K_CAP_ENERGY`'s own comment). Paired
 * instead with a lower `AMBIENT_CO2_SHARE` (0.5) to help `tenancy` without
 * that path, `900` broke `n` outright — `0.34`, far below ADR-0025's `0.9`
 * floor, on only 3 settled rungs. `tenancy` stayed short of `5` in every
 * combination tried regardless (`AMBIENT_CO2_SHARE`'s own comment records
 * the sweep); this constant was not the lever that closed the gap.
 */
export const RESPIRATION_ENERGY_YIELD = tunable(
  "RESPIRATION_ENERGY_YIELD",
  800,
);

/**
 * The flat existence cost `c₀` (ADR-0009): the size-independent half of
 * maintenance, and the term that creates a minimum viable body size.
 *
 * Solved as `c₀ = α_bright · r_opt / 2` (#35), against `α` measured over
 * the **bright band** in a **fixed population** — mortality and fertility
 * both off, nothing able to select (ADR-0015, ADR-0023). `α` depends on
 * the ambient environment respiration draws from, which is what
 * `CARBON_BUDGET_BASELINE_ORGANISMS` sets — so it is measured with `npm
 * run calibrate` **after** that constant's new value lands, never before,
 * or the two would be calibrated against different worlds. The target is
 * `r_opt = 1.5` (ADR-0025), fixed before any fertile world is run to judge
 * it against.
 *
 * #35's own reading — seeds 7–11, `α_bright = 6.067 ± 0.40`, giving 4.55 —
 * was measured before `AMBIENT_CO2_SHARE` moved, and it said so at the
 * time: that noise came from every founder's internal CO₂ starting above
 * `K_CAP.carbonDioxide`'s ceiling of 1, throttling respiration until
 * photosynthesis drew it back down, and retuning `AMBIENT_CO2_SHARE` was
 * explicitly left to #36. #36's own retuning — `AMBIENT_CO2_SHARE` to 0.6,
 * `K_CAP.food` to 1.5, everything else unmoved (see their own comments) —
 * changes the ambient environment `α` is measured against, so it is
 * re-measured against that calibrated world: same seeds, `SETTLE_TICKS`
 * shortened for the same reason its own comment records,
 * `α_bright = 8.320 ± 0.25`, giving `8.320 × 1.5 / 2 = 6.24`.
 *
 * Not chased to the fixed point exactly, on the same grounds #35 already
 * measured once and moved on: re-measuring `α` against a world built with
 * `EXISTENCE_COST = 6.24` reads 8.228 and would suggest 6.17, close enough
 * (`n` and tenancy both moved by less than their own gate's margin across
 * that step) that a second iteration bought no finding worth the extra
 * calibration run.
 *
 * The milestone's paper table put this at 2.2, from a hand-computed
 * `α ≈ 2.95` that predates a working respiration reaction to measure `α`
 * against; the committed value below replaces that estimate with the
 * harness's own reading rather than adjusting it.
 */
export const EXISTENCE_COST = tunable("EXISTENCE_COST", 6.24);

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
 * `cytoplasmThickness`'s multiplicative step size: a mutation applies `× (1 +
 * u·δ)` or its reciprocal with equal probability. Chosen, together with
 * `GENERATION_0_MUTATION_SCALE`, so that scaling it by 5 reproduces
 * generation 0's `[1/1.4, 1.4]` spread — the range M1 already calibrated —
 * from a single ordinary birth's step. It was v0.1's `bodyRadius` step, and
 * the thickness inherits it unchanged (ADR-0028): with no organelles the
 * thickness is the whole radius.
 */
export const DELTA_CYTOPLASM_THICKNESS = tunable(
  "DELTA_CYTOPLASM_THICKNESS",
  0.08,
);

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
 * Derived, not picked: `DELTA_CYTOPLASM_THICKNESS × 5 = 0.4` puts founder
 * radii in `[1/1.4, 1.4]` of the baseline, whose top end is exactly
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
 *
 * Swept at #36, though it is the constant ADR-0025 names as free to tune for
 * tenancy: tried from 10 to 100 alongside `AMBIENT_CO2_SHARE` at 0.5, with
 * `30` the best of that search (tenancy `4.25`, the closest any combination
 * found came to the `≥ 5` gate — see `AMBIENT_CO2_SHARE`'s own comment for
 * the fuller sweep). Not a clean lever, though: at the *committed*
 * `AMBIENT_CO2_SHARE` of 0.6, `30` reads `2.98` — worse than `100`'s `3.06`
 * — so the improvement found at 0.5 does not carry over. Left at its M2
 * value for that reason; the ADR-0025 proof that this constant cancels out
 * of `r_opt`'s own maximisation still makes it free to revisit without
 * touching where `bodyRadius` is predicted to converge.
 */
export const MITOSIS_ENERGY_COST = tunable("MITOSIS_ENERGY_COST", 100);

/**
 * M7's structural constants (ADR-0028, ADR-0034), the ones the neuron's
 * declaration names (`organelles.ts`). Lengths are in baseline radii, like
 * every length in the world. Persistence on the Reference World arbitrates
 * them (#63): if it fails, `MAX_STRUCTURAL_EVENTS` moves first, then
 * `R_NEW`, and no world constant moves. It failed and both moved: see their
 * own notes.
 */

/**
 * `M_max`, the most structural events one birth can draw: `n ~
 * Binomial(M_max, p)`, so the structural mutations a birth undergoes are
 * bounded and do not grow with the genome (ADR-0028). The Birth Cost
 * Ceiling prices `M_max` worst-case events, so it is the first constant
 * persistence lowers.
 *
 * 1, not the 2 #58 started from. Persistence on the Reference World (#63,
 * seeds 7–11, 100k ticks, neuron roster) arbitrated it, and the ceiling is a
 * cliff rather than a slope: at `M_max = 2`, `r_new = 0.05` every seed went
 * extinct with no birth at all, `M_max = 1` alone did not save it, and at
 * `M_max = 2` `r_new` had to fall to 0.01 before all five persisted, against
 * 0.03 at `M_max = 1`. So `M_max = 1` kept the larger `r_new`.
 */
export const MAX_STRUCTURAL_EVENTS = tunable("MAX_STRUCTURAL_EVENTS", 1);

/** `p`, each of the `M_max` trials' chance of becoming an event. At 1 and
 * 0.25, a birth draws no event 75% of the time and one 25%. */
export const STRUCTURAL_EVENT_PROBABILITY = tunable(
  "STRUCTURAL_EVENT_PROBABILITY",
  0.25,
);

/**
 * The structural operators' rate weights: an event picks its operator in
 * proportion to them, before it picks a target. #58's starting values, not
 * derived: insertion and deletion weigh the same, so structure does not
 * accumulate from a rate imbalance alone, and half of all events reshape an
 * organelle rather than add or remove one. The rates set how often each
 * event happens, never how far one can grow the body, so the Birth Cost
 * Ceiling does not read them.
 */
export const PARAMETER_CHANGE_WEIGHT = tunable("PARAMETER_CHANGE_WEIGHT", 0.5);
export const INSERTION_WEIGHT = tunable("INSERTION_WEIGHT", 0.2);
export const DELETION_WEIGHT = tunable("DELETION_WEIGHT", 0.2);
export const SPLIT_WEIGHT = tunable("SPLIT_WEIGHT", 0.1);

/**
 * `w`, the half-width of a Split's triangular bell, `f = 0.5 + (u₁ + u₂ −
 * 1)·w` (ADR-0028): at 0.3 the larger piece takes between 50% and 80% of
 * the area, never more, with no truncation needed.
 */
export const SPLIT_HALF_WIDTH = tunable("SPLIT_HALF_WIDTH", 0.3);

/** The radius an inserted organelle is born at, one for every type. Small,
 * so an insertion grows the Enclosing Circle by at most `2·r_new`.
 *
 * 0.02, not the 0.05 #58 started from, for the reason `M_max` is 1. At
 * `M_max = 1` on the Reference World (#63, seeds 7–11, 100k ticks): 0.05
 * went extinct on all five, 0.04 on two, 0.03 persisted with one seed down
 * to a single organism, and 0.02 and below kept minimum populations of 4–9,
 * M6's own. 0.02 is the largest value with that margin. An organelle this
 * small is invisible on screen at the starting zoom: it grows by mutation
 * or shows when the camera is close. */
export const R_NEW = tunable("R_NEW", 0.02);

/**
 * The floor organelle radius clamps at under its size law (ADR-0034), and
 * below which a Split piece makes its organelle no valid target. Half the
 * birth radius: room to shrink, with a neuron resting at the floor doing no
 * harm.
 */
export const R_MIN = tunable("R_MIN", R_NEW / 2);

/** An organelle radius's symmetric multiplicative step, `× (1 + u·δ)` or its
 * reciprocal: the same law and the same step as `cytoplasmThickness`. */
export const DELTA_ORGANELLE_RADIUS = tunable("DELTA_ORGANELLE_RADIUS", 0.08);

/** An organelle position's Cartesian step, at most this many of the
 * organelle's own radii, so a small organelle moves a small distance. */
export const DELTA_ORGANELLE_POSITION = tunable(
  "DELTA_ORGANELLE_POSITION",
  0.5,
);

/**
 * The neuron's Organelle Overhead `c_neuron` (ADR-0029), per tick, whatever
 * its size. Provisional at a hundredth of `c₀`: small enough for M11's
 * near-neutral structure, large enough to bite. Its value is chosen in the
 * harness later in M7 (#66).
 */
export const C_NEURON = tunable("C_NEURON", 0.01 * EXISTENCE_COST);

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
