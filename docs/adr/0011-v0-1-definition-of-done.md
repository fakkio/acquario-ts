# v0.1 is done when it demonstrates selection, not when it looks alive

Three criteria: carbon and oxygen conserved to floating-point tolerance over 100k ticks; the same seed producing an identical state hash at tick N; and population gene means converging to the same neighbourhood from different seeds and different baseline genomes — decisively, converging on the `r_opt = 2·c₀/α` computed on paper beforehand.

## Why

v0.1 has roughly fifteen free constants, and nearly every combination produces one of two boring outcomes: extinction within a few hundred ticks, or a population pinned to the carbon ceiling and frozen. Without a target fixed in advance, tuning drifts toward whatever was seen first. "It looks alive" cannot distinguish selection from drift, nor from a gene collapsing into a numerical floor.

Convergence on a number predicted in advance is the strong form of the test: drift does not land on a value derived from the constants, only selection does.

## Considered options

A `selectionDisabled` control mode — reproduction on a timer, ignoring the energy gate — as a null model to compare gene distributions against. Dropped: the analytic `r_opt` prediction is a strictly stronger control for less code, since a null model can only show that *something* differs, while the closed form says exactly where the population should land.

## Consequences

- Requires a minimal HUD: tick, seed, population, pool levels, live total carbon, and mean ± σ of each gene.
- Requires CSV export of that time series, the single deliberate exception to having no persistence — it stores observations rather than simulation state, so there is no schema to version, and it is the only way to compare runs offline.
- The conservation assertion outlives v0.1: it is what will catch the v0.2 fluid solver quietly eating a few percent of the world's CO₂ per thousand ticks.