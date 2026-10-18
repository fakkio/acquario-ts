# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The thruster**, the only actuator of v0.2 and the second weightless type. It pushes the body along its own orientation from its own position, with `kForce × drive × 2·r` (`kForce ≈ 1.32`, derived so a new thruster pushes as hard as a new float lifts at the surface). Each thruster's push moves the body over its drag and adds `p × F` to the torque that turns the Body Axis. With no signal wired to it, it pushes at its drive.
- The **Thrust Cost** (ADR-0006): a thruster pays `k_thrust × |F|` per tick (`k_thrust ≈ 11.8`, derived from the thruster's own price), charged in step 5 as its own flow and not part of Maintenance. A type declares force and cost as one `thrust: {force, cost}` field, so the cost cannot be missing.
- The default roster is the neuron, the float, the chloroplast and the thruster, a quarter of the insertions each. An empty roster still moves exactly as M9's world.
- `WorldOptions.brownian`, so a measurement can run without diffusion.
- The inspector shows what thrusters do, thrust per thruster and per body.
- `npm run thrusters`: a lone thruster in Fixed Populations, pointing up against `exp(−y/L)`, pointing down against a floor pile, and tangential at the rim against its period and orbit radius (#94), then the Reference World over seeds 7–11 by thrust (#95). Reported, never gated (ADR-0024).
- Devlog article 014, _Una spinta gratis non si vede_.

### Changed

- ADR-0006 says where the Thrust Cost is charged (step 5) and where the push is applied (step 6).
- The golden hash keeps M9's value: a body with no thruster moves and pays exactly as before.

## [0.1.5] - 2026-10-13

### Added

- **The chloroplast** (ADR-0029, ADR-0032), the first organelle that moves carbon and the second that weighs. Each chloroplast fixes `kChloro × light × 2·r × C_cytoplasm(CO₂)` on its own disc, reading the light at its own world position (the body's position plus its body-frame position turned through the Body Axis). The body's passive term keeps its arithmetic; all terms read the same internal CO₂ and share one throttle, scaled in proportion when it binds. Density `+3/2`, overhead `c_organelle`, no ports.
- An organelle type declaration states its photosynthesis coefficient (the chloroplast's is `kChloro`, every other type's none). `kChloro` is an exported tunable derived as `2·kPhoto`.
- The default roster is the neuron, the float and the chloroplast, a third of the insertions each. An empty roster still moves exactly as M8's world.
- The tick's flow record splits photosynthesis into the body's share and the chloroplasts'. The inspector shows both, and each chloroplast's light and fixation. Chloroplasts are drawn green, opaque, with a dark outline; the HUD shows their carrier fraction.
- `npm run chloroplast`: `X(y)` and `r*(y)` by depth in a Fixed Population, the Resting Depth by composition (1 float + 1 chloroplast, 1 float + 2 chloroplasts) over 300k ticks, and the Reference World over seeds 7–11 by composition. Reported, never gated (ADR-0024). `npm run buoyancy` and `npm run neuron` count organelles by type.
- A 100k-tick conservation run whose founders all carry chloroplasts, some at the surface where the CO₂ throttle binds.
- The HUD shows rows for restarts and session ticks.
- Devlog article 013, _Il cloroplasto che non regge_.

### Changed

- The golden hash keeps M8's value: a body with no chloroplast fixes exactly what it did.

## [0.1.4] - 2026-10-11

### Added

- **Gravity and buoyancy** (ADR-0030, ADR-0032). The water's density rises linearly from the surface to the floor; each organelle type declares a density (in units of the water's span) or that it is weightless. The **float**, density `−1`, is the first type that weighs, and joins the neuron in the default roster. A body feels the **Buoyant Weight** of its weighing organelles, each at its own depth, and is pushed towards its **Resting Depth**. `g` is derived in closed form (≈ 4.22) so a float at `r_new` on a baseline body has a scale height of the Bright Band's thickness. `Δ` and `ρ_w(0)` are fixed units, unreachable from the environment.
- The **Body Axis**: every organism carries an orientation as physical state, a unit vector turned by weight's torque over the rotational drag `8π·R³`. Founders start aligned with the world, a child inherits its parent's axis, and no new draw enters any stream.
- Step 6 is **motion**: the same Brownian draw, plus the Buoyant Weight's force and torque, integrated once into position and axis.
- `c_organelle` committed at ≈ 0.62, derived from the chloroplast's `r_new ≈ r*/2` rule with `kChloro = 2·kPhoto`.
- The float drawn as a pale, translucent bubble; organelles drawn through the Body Axis. The inspector shows the axis, Buoyant Weight with torque, Resting Depth and a density column.
- `npm run buoyancy`: the `g` check (a Fixed Population of float carriers against the predicted depth profile) and the Reference World over seeds 7–11 at 100k ticks (float and neuron carrier fractions, carriers against non-carriers by depth, the axis and the float's lever against the vertical, worst penetration). Reported, never gated (ADR-0024).
- Devlog article 012, _La domanda sbagliata, tre volte_.

### Changed

- Separation runs three passes per tick, each followed by the wall clamp, the smallest number that holds M1's ceiling of 0.5 on a crowd of 160 bodies each carrying a float of radius 0.1 pinned to the surface (ADR-0008). It moves every world, the empty-roster one included.
- The state hash folds each organism's Body Axis. The golden value is re-recorded (`fd8594ce`) after the empty-roster world, hashed the old way, was checked to still match M7.5's.
- A type declaration states a density or `weightless`, replacing the boolean flag.

## [0.1.3] - 2026-10-08

### Added

- `npm run caps`: the Reference World over seeds 7–11 at 100k ticks, reporting each seed's minimum population, births, mean Generation, each diffusible's highest internal concentration next to its ledger's ambient total, `α_bright` and population `α` in a Fixed Population, and the dark ladder. Reported, never gated (ADR-0024).
- `npm run neuron` also reports how often the Reach exceeds the area radius among carriers, which term (area or reach) sets the Birth Cost Ceiling, and the neuron's carrier fraction next to #66's figure (ADR-0036).
- Devlog article 011, _Il tappo che nessuno aveva deciso_.

### Changed

- **Only the energy store has a hard cap** (ADR-0035). Photosynthesis runs at `min(rate, CO₂ available)`, respiration at `min(rate, food, O₂, energy headroom)`. Food, O₂ and CO₂ have no cap: a diffusible store is read as a Concentration, and passive exchange corrects any excess. `K_CAP` for the diffusibles is deleted; `K_CAP_ENERGY` is the only cap coefficient. A child's allocation is clipped on energy only.
- The body is its cytoplasm plus its organelles, an organelle can be born anywhere in it, and the relaxation contract holds on the Reach from the body's fixed origin (ADR-0036). The Enclosing Circle is retired.
- `α` measures the potential rate (`min(rate, food, O₂)·yield` per unit radius, nobody excluded), since a world with a single cap puts every organism under ADR-0015's exclusion. Its linearity test is skipped, with ADR-0015 amended.
- The inspector reads each diffusible store as its internal concentration against ambient; energy keeps its cap and percentage.
- The golden hash is re-recorded on M7.5's world and runs 8000 ticks, since the first birth now falls after tick 6000.
- `vision.md` and ADR-0035 carry the measured before/after: persistence holds on all five seeds, `α_bright` 1594 → 901, population `α` 1159 → 251, births 2,893 → 588, mean Generation 4.0–6.1, and the dark ladder is still empty at 30k ticks. No world constant moved.

## [0.1.2] - 2026-10-06

### Added

- A structural genome (ADR-0028, ADR-0034): the genome is a fixed header of Organism Genes plus a `Gene[]` of Organelle Genes, each with a type, a position, a radius and an Innovation Id. `cytoplasmThickness` replaces `bodyRadius` in the header with the same law, and a body's radius is its **Enclosing Circle**'s plus the thickness, derived from the genome by a pure function.
- The structural mutation law: each birth draws `n ~ Binomial(M_max, p)` events, each a parameter change, insertion, deletion or split, with the layout relaxed after every event and recentred at the end. The relaxation (a push or a slide from the most-overlapped disc) keeps ADR-0028's contract, an event grows the Enclosing Circle by at most `Δd + d`.
- The **Birth Cost Ceiling** as a closed-form bound read from the parent's own genome, taken only over the operators that have a valid target (ADR-0034); mitosis still throws if a child exceeds it.
- The **neuron**, M7's one organelle type: a disc with a radius and a position, no synapses, weightless, paying an Organelle Overhead `c_neuron` (0.01·c₀). Maintenance charges `β` on the Cytoplasm Area plus each organelle's overhead and tissue; caps and internal concentrations read the Cytoplasm Area.
- A `roster` option on the world, defaulting to the neuron. An empty roster draws no structural events and reproduces M6's state hash bit for bit, pinned by a golden hash recorded before M7 changed any code.
- Innovation Ids minted from a per-world counter when a pending birth is committed, in population order, and kept out of the state hash.
- The inspector: click an organism to select it, with a highlight ring; a panel shows its genes, derived body radius, Cytoplasm Area, maintenance breakdown, the four stores with each against its cap, the last tick's effect on them, its Generation and an organelle table. Esc or a click on empty water clears it.
- The HUD shows `cytoplasmThickness` and the derived body radius as mean ± σ, each roster type's carrier fraction and mean count per carrier, and each pool's level against its capacity, percentage full and ambient concentration.
- `npm run neuron`: the neuron's carrier fraction and mean count per carrier against a run with `c_neuron = 0` on the same seeds, and the ratio of each organism's Birth Cost Ceiling to its own body area, reported and never gated. At `c_neuron` from 0.01 to 0.3 of `c₀` the carrier fraction sits 1–2 points below the 5.1% of the free world, within the seeds' spread.
- Devlog article 010, _Il neurone che non fa niente_.

### Changed

- Bodies are drawn in the v0.2 look: the cytoplasm in `lineageHue` at a lower saturation, neurons as opaque light-grey discs with a dark outline, and the energy fraction dimming the whole body, organelles included.
- `.gitattributes` pins line endings to LF.
- `M_max = 1` and `r_new = 0.02`, not the 2 and 0.05 the milestone started from. At the starting constants every Reference World seed went extinct with no birth at all; the ceiling is a cliff, and 0.02 is the largest `r_new` that keeps M6's minimum populations. No world constant moved.

### Fixed

- `vision.md`'s insertion domain: an organelle is inserted inside the Enclosing Circle, not inside the body (ADR-0034).

This is **M7 — Structural genome**.

## [0.1.1] - 2026-10-02

### Added

- `birthCostCeiling` in the genome module: the largest child area an ordinary birth can produce, the area at `r·(1+δ)` under v0.1's radius law (ADR-0027).
- An anti-sieve unit test: over committed births from marginal parents, the mean log ratio of child to parent area must be zero within four standard errors, so a reintroduced Birth Sieve fails a test rather than an ecosystem.
- **Persistence** as a standing long-suite gate: the Reference World, unprimed, seeds 7–11, 100k ticks, every seed alive at the end. Each seed's minimum and final population size is printed, ungated.
- `npm run done-criteria`: ADR-0025's fifteen done-criteria runs as a Calibration Harness entry point of their own, reported and never gated. On the gated world 14 of 15 runs survive, accuracy fails (6 of 15) and convergence fails on the one extinct run. `r_opt` is retired after this measurement.

### Changed

- An extinct done-criteria run now fails convergence as well as accuracy, instead of dropping out of the spread.

### Removed

- The done-criteria long-suite file, red on purpose since v0.1's verdict. The long suite is green again.

### Fixed

- Every unprimed world going extinct. Mitosis drew the child's mutation first and retried on a failed payment, so only cheap children were born and each generation shrank by mechanism (the Birth Sieve). The Worst-Case Birth Gate replaces it: a parent attempts a birth only when it can already pay, in energy and food, for the most expensive child its mutation law could produce, so the draw cannot fail and the children born are an unbiased sample (ADR-0027). A drawn child above the ceiling now throws.

This is **M6 — Worst-Case Birth Gate**, the first milestone of v0.2.

## [0.1.0] - 2026-09-26

### Added

- Death by starvation: energy reaching zero kills an organism. Its position, diffusible stores and body mass are frozen as remains at step 8 and returned to the pools at step 11. Mortality is a world mode (`"on"`/`"off"`), independent of the milestone that introduced it (ADR-0017).
- Session restart: on population extinction, a new world seeds itself from the last, with an auto-restart toggle and a cumulative-deaths HUD row (ADR-0018).
- A four-gene genome (`bodyRadius`, `mitosisEnergyThreshold`, `childAllocationRatio`, `lineageHue`), mutated independently per gene at birth, and a generation-0 population independently mutated from a common baseline genome (ADR-0021).
- Mitosis: a parent pays energy and food-mass at resolve time with no flat term (ADR-0019), splits its remaining resources with a child by `childAllocationRatio`, and the child is born tangent to it. Fertility is a world mode independent of mortality (ADR-0020). A child costs the world carbon at body density (ADR-0022).
- Cumulative births HUD row, beside cumulative deaths.
- The calibration harness: a headless script that constructs worlds, runs them and reports the numbers M5's constants are chosen against — an instrument, never a gate (ADR-0024).
- `α`, the energy income coefficient, measured rather than declared over a fixed, selection-free population (ADR-0015), narrowed to the **Bright Band** once reproduction only happens there (ADR-0023); `r_opt` gated on a measured income exponent, on the maximum reproductive radius and on tenancy (ADR-0025).
- HUD rows for gene mean ± σ, and `α` reported over both the bright band and the whole population.
- Fifteen done-criteria runs — five seeds across three baseline genomes — as v0.1's verdict on the "selection, not drift" criterion (ADR-0026).

### Changed

- The uniform grid's cell size tracks the population's largest body radius each tick, instead of a fixed constant.
- "Photic" renamed to "bright" throughout (**Bright Zone**, **Bright Band**).

### Fixed

- Exchange settlement no longer lets a pool's grants push its balance below zero under contended demand.

This closes **v0.1** (M3 — Death, M4 — Reproduction, M5 — Calibration). Conservation and determinism both hold across the milestone. The third criterion does not: all fifteen done-criteria runs went extinct before ever reaching a living population inside the measurement window, so there is no `bodyRadius` mean to check against the predicted `r_opt`. Accepted as v0.1's final, published result (ADR-0026) rather than chased further inside v0.1's own constants; survivability work resumes, if at all, in v0.2.

## [0.0.4] - 2026-09-17

### Added

- `Environment` seam: shared pools of CO₂, food and O₂ across the aquarium, plus per-organism internal reserves and caps, each generation-0 organism seeded at tick 0 in diffusive equilibrium with the ambient concentration (the carbon ledger).
- A light attenuation lookup table producing the on-screen depth gradient, feeding photosynthesis.
- Photosynthesis: light and CO₂ convert to food and O₂ inside each organism.
- Passive exchange between an organism's internal reserves and the shared pools, settled in two sub-passes per tick (ADR-0016) so caps and floors are exact rather than argued.
- Respiration and maintenance: food and O₂ convert to energy, spent on a fixed existence cost each tick — the metabolic cycle closes.
- An FPS indicator in the HUD.
- A hundred-thousand-tick conservation run: total carbon and total oxygen hold constant to floating-point tolerance across the whole run.

### Changed

- Exchange settlement sums each pool's grants in a fixed order before totalling, so the result no longer depends on population iteration order.
- `bodyArea`/`capFor` tightened from a loose numeric signature to `Organism | OrganismView`.

This closes **M2 — Metabolism**: carbon and oxygen conserved over 100k ticks, with a fixed, immortal population.

## [0.0.3] - 2026-09-13

### Added

- Circular organisms, each carrying a position, a `bodyRadius`, a `lineageHue` and its own PRNG stream, placed as a generation-0 population in a finite, hard-walled aquarium whose dimensions are expressed in baseline body radii.
- Brownian motion under overdamped Stokes drag (ADR-0008): velocity is force over drag times radius, so large bodies visibly wander less than small ones, and no body ever crosses the aquarium boundary.
- A uniform grid over the population (ADR-0012), rebuilt from scratch each tick, with a toggleable debug overlay drawing the cells.
- Positional separation: overlapping bodies are pushed apart along their pair normal in proportion to `1/area`, with corrections buffered and applied once per tick so the result does not depend on visit order.
- HUD rows for the population count and the worst penetration depth.

### Changed

- `advance` runs discrete per-tick steps through ADR-0006's read / resolve / commit phases, instead of converting elapsed time into a tick count and adding it in a single step.
- `hashState` folds in every organism's position, radius and stream state, so the determinism invariant covers bodies and not only the clock.

### Removed

- M0's placeholder background grid and hash-derived background hue, now that the aquarium wall and the population are what the canvas shows.

This closes **M1 — Bodies and motion**: the aquarium holds bodies that drift, jostle each other apart and stay inside hard walls, with no metabolism of any kind.

## [0.0.2] - 2026-08-10

### Added

- Toolchain: Vite, Vitest, TypeScript (strict mode), ESLint + Prettier, Husky pre-commit hook.
- Deterministic `World` core (`createWorld`/`advance`/`hashState`) with a fixed-step accumulator, a catch-up cap, and per-organism PRNG streams derived from a single master seed (ADR-0007).
- Canvas2D render loop with play/pause/single-tick-step controls.
- HUD shell showing the live tick count and active seed.
- Pan and zoom on the canvas, with touch support.

This closes **M0 — Simulation skeleton**: same seed now yields the same state hash at tick N.
