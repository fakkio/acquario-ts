# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
