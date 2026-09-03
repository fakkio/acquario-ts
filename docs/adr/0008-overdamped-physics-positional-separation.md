# Overdamped physics and positional collision separation

Motion is overdamped: velocity is proportional to force rather than to its derivative, with drag following Stokes' law (`drag ∝ radius`). Collisions are resolved by displacing overlapping bodies apart along their normal in proportion to `1/area`, with no impulses and no restitution; corrections accumulate in a buffer and are applied once.

## Considered options

Inertia, friction and bouncing collisions, as the earlier draft specified. Rejected on physical grounds: at the scale of microorganisms in water, inertia is irrelevant — Purcell's _Life at Low Reynolds Number_ — and a bacterium that stops swimming coasts roughly an atom's width. Momentum-based motion is not a simplification of that world, it is a different one.

Dropping collisions from v0.1 entirely was also considered, since nothing yet has a reason to interact. Rejected because light is the only spatially localised resource, so volume exclusion is what makes the photic zone finite and the only way one organism's existence costs another anything. Without it v0.1 has zero organism–organism interaction and the uniform grid is untestable dead code.

## Consequences

- No momentum state to integrate, hence an entire class of numerical failure removed: no oscillation, no restitution coefficient, no energy injected through collisions, no tunnelling. Valuable given that runs are unattended for 100k ticks against a conservation assertion.
- It matches what microscopy actually looks like — jittering, drifting, nudging apart — where bouncing billiard balls would read as wrong.
- Stokes drag reinforces ADR-0004: the diffusion coefficient goes as `1/r`, so large organisms stay near where they were born.
- v0.2 thrusters map output directly to a speed rather than an acceleration.
- The cost: an organism that stops pushing stops instantly, so inertial gliding can never become an evolvable strategy.
- **A single buffered pass per tick does not make overlap decrease monotonically.** Buffering is what makes the result independent of visit order, and the same buffering means a body's correction is the sum of its pushes out of every neighbour at once. Summed, those pushes can carry it further into a neighbour it was only grazing — so in a crowd deep enough that bodies overlap five or six others, the worst overlap in the aquarium climbs for a tick here and there on the way down. Measured on a fifty-body pile-up: transient, a few per cent above where it started, and it still settles to touching within a few hundred ticks. Sparse crowds, including anything v0.1 actually runs, decrease every tick.
- The milestone invariant is therefore a bound rather than an equality, in two parts: with motion off, a crowd settles to touching within a bounded number of ticks; with motion on, the worst overlap stays under a ceiling of about two ticks' worth of brownian step, which is exactly as deep as one tick of two bodies converging can put them. Settling is asymptotic — the pass halves what is left rather than zeroing it — so "no overlaps" is never an equality to assert.
- The way out, if a dense run ever holds an overlap floor instead of settling, is a small fixed number of passes. The buffered structure supports it without redesign; it multiplies the per-tick pair-finding cost by K, which is the budget this decision spends elsewhere.
