# M5 ends without convergence, and v0.1 ships that way

`#38`'s done-criteria runs are M5's own verdict on v0.1 (ADR-0025): fifteen worlds, five seeds across three baseline genomes, all extinct before ever reaching a living population inside the last-10k-tick window. `docs/vision.md`'s third done-criterion, "Selection, not drift", is not met, and it is not going to be. `#36`'s own constant sweep already found the proximate cause: `r_max` (2.59 ± 0.63 against a `≥ 3` floor) and `tenancy` (3.06 against `≥ 5`) never cleared under any combination tried, short of ADR-0025's pre-authorised CO₂ fallback, which `#36` declined on a principled objection (it pays a food-denominated structural cost out of CO₂, the one place in mitosis where what the parent gives up and what the child receives are not the same resource type).

**Decision.** Accept the negative verdict as final for v0.1. No further tuning of v0.1's constants or initial conditions to force convergence. `#32`, `#36` and `#31` close on the milestone's own terms — "if the population does not converge, that is a publishable result... it spawns the next milestone" — rather than staying open pending a fix that keeps not arriving. Survivability work resumes, if at all, in v0.2.

**Why no lever was left to pull.** Every option considered after the verdict either reopens ground already fenced for a specific reason, or was already measured and found wanting:

- **Raise `RESPIRATION_ENERGY_YIELD` further.** Already tried during `#36`, up to 900: it broke the income exponent `n` outright (0.34, against a `[0.9, 1.15]` gate) once paired with a lower `AMBIENT_CO2_SHARE`. More energy income does not clear tenancy or `r_max`; it removes the linearity `r_opt` is derived from.
- **Widen the bright band (`LIGHT_ATTENUATION_K`).** Would plausibly help tenancy — more vertical room means longer before brownian motion carries a small body out of the light — but `LIGHT_ATTENUATION_K` is not an ordinary constant: it is the definition of the window `α` is measured through (ADR-0015, ADR-0023). Moving it means re-measuring `α`, re-deriving `EXISTENCE_COST`, and restarting the calibration chain from `#35` on. Reopening the measurement instrument to save the measurement is the failure ADR-0011 was written to prevent.
- **Accept ADR-0025's CO₂ fallback after all.** It works — measured, it closed `r_max` outright. Still declined: it is the one place in mitosis where `childAllocationRatio`'s split stops being type-preserving (food-for-food, oxygen-for-oxygen, CO₂-for-CO₂ everywhere else), for food alone.
- **Prime generation 0 and check it against `#38`'s own accuracy/convergence gates**, rather than only against `reproduction.long.test.ts`'s conservation/determinism gate. Not run. That existing primed gate already documents the answer in miniature: a population primed to full caps still runs down toward extinction, because natural reproduction "essentially never re-fires once the initial, artificial food surplus is spent" — under `#36`'s committed constants it booms bigger first, then collapses the same way. Priming changes the shape of the collapse, not whether one happens.

No remaining lever both respects the principles already committed to (type-preserving mitosis, a measurement window fixed before it is used, no gate loosened to pass) and is untested. `docs/vision.md` already frames v0.1's dark-band reproduction gap as a limit v0.2's eating opens rather than one v0.1's constants were meant to close; this extends the same reasoning to the light-band collapse.

## Consequences

- `#32`, `#36` and `#31` close referencing this ADR, without their acceptance criteria met.
- `docs/vision.md`'s "Definition of done for v0.1" is corrected to state the measured result under criterion 3, rather than reading as still pending.
- Any future attempt at v0.1-era survivability — before or independent of organelles — starts by re-reading this ADR, not by re-deriving the four bullets above from scratch.
