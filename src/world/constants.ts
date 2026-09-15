/**
 * M2's physical constants: provisional but internally consistent, each with
 * its derivation written beside it. None of these are claimed to be
 * *right* yet — only of the same order as each other, so a run neither
 * dies out in the first few hundred ticks nor pegs at the carbon ceiling
 * and freezes before it says anything. M5 re-solves several of them
 * against a measured α; each entry below says whether it is fixed by
 * construction or open for that.
 */

/**
 * The concentration unit for the three diffusibles: fixed by construction,
 * the calibration method's choice of unit rather than a tuned value. A
 * cap of `K_CAP × bodyArea` is then a maximum internal *concentration* of
 * exactly 1.
 */
export const K_CAP = 1;

/**
 * Body density. `ρ = 1` collapses body mass onto body area, fixed by
 * construction alongside `K_CAP` so the mass unit and the concentration
 * unit agree by the same move.
 */
export const RHO = 1;

/**
 * Energy's own cap coefficient, independent of `K_CAP` because energy's
 * unit is fixed separately — by `β = 1`, M2's maintenance ticket — rather
 * than by coincidence of notation. About 240 ticks of autonomy for a
 * baseline body at the respiration rate M2's later slices land. Open for
 * M5 to move.
 */
export const K_CAP_ENERGY = 400;

/**
 * The carbon budget, phrased as "enough carbon for K baseline organisms" —
 * ADR-0001's ecological knob. Chosen well above `STARTING_POPULATION`
 * (40) so generation 0 begins comfortably under the carbon ceiling, with
 * headroom for M4's mitosis to grow the population before M5 tunes this
 * for real. Open for M5 to move.
 */
export const CARBON_BUDGET_BASELINE_ORGANISMS = 200;

/**
 * How initial ambient carbon splits between CO₂ and food: in favour of
 * CO₂, so the world starts carbon-rich and food-poor and a run's first
 * story, once M2's later slices land, is fixation in the photic zone
 * rather than an already-full food pool. Open for M5 to move.
 */
export const AMBIENT_CO2_SHARE = 0.75;

/**
 * Oxygen's ambient concentration, chosen directly rather than derived: the
 * CO₂ term already carries oxygen of its own (ADR-0001), so oxygen needs
 * no closed-form tie to the carbon budget. Open for M5 to move.
 */
export const AMBIENT_OXYGEN_CONCENTRATION = 0.5;

/**
 * Passive exchange's rate coefficient (ADR-0003): `flux = kDiffusion ×
 * perimeter × (C_external − C_internal)`. Chosen against the time constant
 * `r / (2·kDiffusion)` — 100 ticks for a baseline body to reach diffusive
 * equilibrium from a standing start, which is fast enough that a run's
 * opening transient is over quickly and slow enough to read as diffusion
 * rather than as a snap to equilibrium. Open for M5 to move.
 */
export const K_DIFFUSION = 0.005;

/**
 * The light unit: fixed by construction, the same move `K_CAP` makes for
 * concentration. Surface light is exactly 1.
 */
export const LIGHT_SURFACE_INTENSITY = 1;

/**
 * Light's exponential attenuation coefficient with depth (ADR-0004):
 * `ln(10)/10`, chosen so light falls to a tenth of its surface value ten
 * baseline radii down. With `AQUARIUM_HEIGHT` at 40 baseline radii, that
 * puts the photic zone at the aquarium's top quarter — enough of a split
 * that depth is worth something, without every organism below it sitting
 * in total darkness.
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
export const K_PHOTO = 0.03;

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
 */
export const K_RESP = 1.0;

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
export const RESPIRATION_ENERGY_YIELD = 800;

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
export const EXISTENCE_COST = 1.0;

/**
 * The body-cost coefficient `β` in maintenance's area-scaled half, `β ×
 * area`. Fixed at 1 by construction, the same calibration move that fixes
 * `K_CAP` and `ρ`: it is what lets a baseline body's body cost read simply
 * as its own area.
 */
export const BODY_COST_COEFFICIENT = 1;
