# Per-organism PRNG streams; determinism guaranteed per engine only

One master seed drives all randomness, split into a global stream (initial placement, baseline genomes) and a per-organism stream: each organism carries its own PRNG state, and a child's state is drawn from its parent's stream at birth. The guarantee is **same seed + same build + same engine ⇒ identical run**, not bit-identical results across JavaScript engines.

## Considered options

A single global PRNG, as originally drafted. Deterministic, but fragile: draw order depends on population size and array position, so changing brownian motion to consume three random numbers instead of two shifts *every mutation in the run* and invalidates every seed saved as an interesting run. On a project whose point is finding and replaying interesting runs, that is the wrong fragility.

Strict cross-engine determinism was also considered: own implementations of every transcendental, frozen tables, and a rule banning `Math.*` beyond `+ − × ÷ sqrt` in simulation code. Real cost and real ongoing discipline, for a guarantee a single-developer project does not need.

## Consequences

- An organism's random sequence depends only on its own lineage, so reordering the population changes nothing, world-level code changes do not shift organism streams, and a single lineage can be replayed in isolation to debug it. Cost is four bytes per organism.
- IEEE-754 guarantees `+ − × ÷ sqrt` are bit-identical everywhere, but `Math.exp`, `Math.pow`, `Math.sin` and `tanh` are implementation-defined to the last ulp — and in a chaotic system one ulp diverges completely over a million ticks.
- Light attenuation is therefore precomputed into a lookup table (ADR-0004), which is also faster and leaves v0.1's inner loop using arithmetic only. If bit-portability is ever wanted, the remaining gap is one table to freeze rather than an audit of every formula.