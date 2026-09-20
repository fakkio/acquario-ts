# The mutation laws, and why bodyRadius is not log-normal

A pure `(Genome, RngStream) => {Genome, RngStream}` (glossary: Mutation) is the only thing in the world allowed to produce a new genome. It runs at birth, on the child, never on a living organism. Each of the four genes takes an independent probability draw (`MUTATION_PROBABILITY = 0.25`) before its own magnitude draw; `bodyRadius` mutates multiplicatively and symmetrically, the two ratio genes mutate additively with clamping, and `lineageHue` drifts additively and wraps. Every operation is `+ − × ÷`.

## Why bodyRadius draws a magnitude, then a direction

The obvious form for a multiplicative gene is the one already used for the ratio genes, adapted: `radius × (1 + (2u−1)·δ)`. It is wrong, and not just stylistically. A gene meant to random-walk in log space has to be _symmetric_ in log space — an equal chance of moving up or down by the same factor — and this form is not: `×1.08` then `×0.92` does not return to 1, it lands at `0.9936`. That is a free downward drift sitting directly on top of the signal M5 measures (`r_opt = 2·c₀/α`), indistinguishable in a single run from genuine selection against size.

The fix draws a magnitude first, `m = 1 + u·δ`, then a second draw applies it as `× m` or `÷ m` with equal probability. `m` and `1/m` are exact reciprocals by construction, so the walk is symmetric in log space: there is no move whose inverse is not equally likely.

Log-normal sampling is the textbook answer to "symmetric multiplicative noise", and it is rejected on ADR-0007's grounds — the same grounds `motion.ts` already rejects `cos`/`sin` on. It needs a transcendental (`Math.log`/`Math.exp` or a Box–Muller `sin`/`cos`), and v0.1's inner loop uses arithmetic only so that determinism holds within one engine without needing every formula audited for cross-platform bit-identity. The `×m`/`÷m` construction buys the same symmetry with two uniform draws and no transcendental.

## Why the ratio genes clamp and lineageHue wraps

`mitosisEnergyThreshold` and `childAllocationRatio` are ADR-0002's dimensionless ratios in `[0, 1]`. Clamping rather than rejecting an out-of-range draw is what that ADR requires: `1.0` has to stay reachable and viable, or a boundary becomes a wall a lineage can approach but never touch, and rejecting the draw entirely would make the mutation rate depend on how close to the boundary a genome already sits.

`lineageHue` has no physiological effect to saturate — it is a marker, not a strategy — so clamping it would pile drift up at 0 or 1 for no reason connected to fitness. Wrapping modulo 1 keeps every value in the gene's own `[0, 1)`, cleaner than modulo 360 now that the gene is unitless (see below).

## Why lineageHue moved to [0, 1)

`docs/vision.md` and `CONTEXT.md` both specified `[0, 1)` from the start; only the code disagreed, drawing `unit() * 360` and rendering degrees directly. The render layer is the only place that has ever cared about degrees, so it is the only place that now multiplies by 360 when it builds an `hsl()`/`hsla()` string. The genome itself stays unitless, consistent with every other gene, and a wrapping drift is simpler modulo 1 than modulo 360.

## Considered options

**Rejecting an out-of-range draw for the ratio genes** instead of clamping. Rejected by ADR-0002 already: it can sterilise a lineage whose threshold random-walked outside `[0, 1]` before this ticket existed to fix it, and clamping is the cheaper, already-settled answer.

**Keeping degrees in the genome** and converting only for storage. Rejected: it leaves two unit systems for the same quantity depending on which layer is asked, for no benefit — nothing outside rendering has ever used degrees.

## Consequences

- `bodyRadius`'s mutation costs two draws when it fires (magnitude, then direction) instead of one; the ratio and hue genes cost one each. Draw order is fixed by the gene record's own declaration order and is a law of the world: reordering it reseeds every child mutated from that point on.
- Generation 0 reuses the same operator with `probability` forced to `1` and every δ scaled by `GENERATION_0_MUTATION_SCALE`, rather than a separate placement rule — one law, not two.
- The render layer (`bodyFillFor` in `render.ts`, `DeathEffects.draw` in `deathEffects.ts`) is the sole place multiplying `lineageHue` by 360; every other reader of the gene sees `[0, 1)`.
